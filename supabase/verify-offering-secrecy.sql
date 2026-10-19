-- Is a member's wine actually secret?
--
-- The app has always said a sealed offering is "hidden from every other soul,
-- even the Keiser, until the reveal". Until 19 Oct 2026 the app kept that
-- promise and the vault did not: `offerings read` was `auth.uid() is not
-- null`, so any signed-in soul could read every wine logged for the coming
-- night straight from the database.
--
-- This proves the new rule as a GENUINE non-Keiser member, which is the only
-- way to test it: the Keiser's own account passes most things whether or not
-- they work, and the anon key returns an empty list for everything, which
-- looks exactly like "no data".
--
--   ./scripts/local-replica.sh && psql -d lcv_probe -f supabase/verify-offering-secrecy.sql
--
-- Safe against production: the whole run is one DO block that always ends by
-- raising, so every row it made is rolled back.

\set ON_ERROR_STOP on

-- plpgsql has no nested procedures, so the checker is a plain helper.
create or replace function _chk(label text, ok boolean, detail text default '')
returns void language plpgsql as $$
begin
  raise notice '%  % %', case when ok then 'PASS' else 'FAIL' end, label,
    case when detail <> '' then ': ' || detail else '' end;
  if not ok then
    perform set_config('lcv.fail', (coalesce(current_setting('lcv.fail', true), '0')::int + 1)::text, false);
  else
    perform set_config('lcv.pass', (coalesce(current_setting('lcv.pass', true), '0')::int + 1)::text, false);
  end if;
end $$;

do $$
declare
  keiser uuid := gen_random_uuid();
  alice  uuid := gen_random_uuid();
  bob    uuid := gen_random_uuid();
  dozing uuid := gen_random_uuid();
  night  uuid := gen_random_uuid();
  past   uuid := gen_random_uuid();
  seen   int;
begin
  perform set_config('lcv.pass', '0', false);
  perform set_config('lcv.fail', '0', false);

  -- A table, four souls, two nights.
  insert into members (id, email, cult_name, short_name, role, active) values
    (keiser, 'keiser@probe.test', 'The Keiser', 'Keiser', 'keiser', true),
    (alice,  'alice@probe.test',  'Priestess Alice', 'Alice', 'member', true),
    (bob,    'bob@probe.test',    'Adept Bob',   'Bob',   'member', true),
    (dozing, 'dozing@probe.test', 'Elder Dozing','Dozing','member', false);

  insert into gatherings (id, number, moon_label, theme_title, gather_date, status, wine_count, attendees)
  values (night, 90, 'probe moon', 'Probe Reds', current_date + 7, 'upcoming', 3,
          array[alice, bob, dozing]::uuid[]);
  insert into gatherings (id, number, moon_label, theme_title, gather_date, status, wine_count, attendees)
  values (past, 89, 'probe moon', 'Past Reds', current_date - 30, 'revealed', 3, array[alice, bob]::uuid[]);

  insert into offerings (gathering_id, member_id, title, price) values
    (night, alice, 'Alice Secret Syrah 2021', 400),
    (night, bob,   'Bob Secret Cabernet 2019', 300),
    (past,  alice, 'Alice Old Syrah 2018', 250);

  -- ── Before the cloths lift ───────────────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', 'alice@probe.test', 'sub', alice::text)::text, true);

  select count(*) into seen from offerings where gathering_id = night;
  perform _chk('a member sees only their own wine before the lift', seen = 1, 'saw ' || seen);

  select count(*) into seen from offerings where gathering_id = night and member_id = bob;
  perform _chk('and cannot read another soul''s wine at all', seen = 0);

  select count(*) into seen from offerings where title ilike '%Bob Secret%';
  perform _chk('nor find it by its name', seen = 0);

  -- The exact attack the old policy allowed: read the whole table.
  select count(*) into seen from offerings;
  perform _chk('nor sweep the whole table', seen = 2, 'saw ' || seen || ' (their own two)');

  -- ── The Keiser is not exempt ─────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('email', 'keiser@probe.test', 'sub', keiser::text)::text, true);
  select count(*) into seen from offerings where gathering_id = night;
  perform _chk('THE KEISER cannot read the coming night either', seen = 0, 'saw ' || seen);

  -- ── A stranger, and a sleeping seat ──────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('email', 'nobody@probe.test', 'sub', gen_random_uuid()::text)::text, true);
  select count(*) into seen from offerings;
  perform _chk('a stranger reads nothing', seen = 0);

  perform set_config('request.jwt.claims', json_build_object('email', 'dozing@probe.test', 'sub', dozing::text)::text, true);
  select count(*) into seen from offerings where member_id = dozing;
  perform _chk('a sleeping seat may still read its own (it has none here)', seen = 0);

  -- ── A night already in the annals is open ────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('email', 'bob@probe.test', 'sub', bob::text)::text, true);
  select count(*) into seen from offerings where gathering_id = past;
  perform _chk('a past night is still shut without an annal', seen = 0, 'saw ' || seen);

  reset role;
  insert into annals (gathering_id, number, theme, date, rows, committed_at)
  values (past, 89, 'Past Reds', current_date - 30, '[]'::jsonb, now());

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', 'bob@probe.test', 'sub', bob::text)::text, true);
  select count(*) into seen from offerings where gathering_id = past;
  perform _chk('once committed, the night is open to the table', seen = 1, 'saw ' || seen);

  -- ── The lift itself: every awake soul has sealed ─────────────────────
  reset role;
  insert into ballots (gathering_id, member_id, scores, sealed) values (night, alice, '{}'::jsonb, true);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', 'bob@probe.test', 'sub', bob::text)::text, true);
  select count(*) into seen from offerings where gathering_id = night;
  perform _chk('one ballot short, the cloths stay on', seen = 1, 'saw ' || seen || ' (their own)');

  reset role;
  insert into ballots (gathering_id, member_id, scores, sealed) values (night, bob, '{}'::jsonb, true);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', 'bob@probe.test', 'sub', bob::text)::text, true);
  select count(*) into seen from offerings where gathering_id = night;
  perform _chk('THE SLEEPING SEAT IS NOT WAITED ON: the cloths lift', seen = 2, 'saw ' || seen);

  perform set_config('request.jwt.claims', json_build_object('email', 'keiser@probe.test', 'sub', keiser::text)::text, true);
  select count(*) into seen from offerings where gathering_id = night;
  perform _chk('and the Keiser may read them then', seen = 2, 'saw ' || seen);

  -- ── The counting door gives ids and nothing else ─────────────────────
  perform set_config('request.jwt.claims', json_build_object('email', 'alice@probe.test', 'sub', alice::text)::text, true);
  select count(*) into seen from sealed_offering_members(night);
  perform _chk('the vine can count who has sealed', seen = 2, 'counted ' || seen);

  -- A wine logged then erased must not be counted as sealed.
  reset role;
  update offerings set title = null where gathering_id = night and member_id = bob;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', 'alice@probe.test', 'sub', alice::text)::text, true);
  select count(*) into seen from sealed_offering_members(night);
  perform _chk('an erased wine is not counted', seen = 1, 'counted ' || seen);

  -- ── Writing is unchanged: still only your own row ────────────────────
  begin
    perform set_config('request.jwt.claims', json_build_object('email', 'alice@probe.test', 'sub', alice::text)::text, true);
    update offerings set title = 'stolen' where member_id = bob and gathering_id = night;
    get diagnostics seen = row_count;
    perform _chk('a member still cannot write another soul''s offering', seen = 0, 'wrote ' || seen);
  exception when insufficient_privilege then
    perform _chk('a member still cannot write another soul''s offering', true, 'refused');
  end;

  raise exception 'ROLLBACK: % passed, % failed',
    current_setting('lcv.pass', true), current_setting('lcv.fail', true);
end $$;
