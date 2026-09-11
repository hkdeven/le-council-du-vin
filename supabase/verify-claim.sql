-- ═══════════════════════════════════════════════════════════════════════════
-- THE CLAIM, PROVEN AS A REAL MEMBER, AGAINST THE REAL DATABASE.
--
-- On the first true gathering every member but the Keiser was refused when they
-- tried to claim their bottle: "new row violates row-level security policy for
-- table annals". The fix was claim_bottle(), a SECURITY DEFINER door. It could
-- never be proven, because the Keiser's own account passes this test whether or
-- not it works, which is exactly how the bug reached the gathering.
--
-- This proves it without a second person and without touching a single real row.
-- It builds a throwaway member, a throwaway night, and then BECOMES that member
-- (set local role authenticated + a forged request.jwt.claims, which is what
-- auth.jwt() and auth.uid() actually read), so every RLS policy and every
-- SECURITY DEFINER function sees a genuine non-Keiser member.
--
-- IT CANNOT COMMIT. The whole run is one DO block that always ends by raising
-- an exception, which prints the report AND rolls back everything it made.
-- There is no COMMIT anywhere in this file and no code path that reaches one.
-- Safe to run against production, repeatedly.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  r            text := E'\n';
  gid          uuid := gen_random_uuid();
  m_email      text := 'lcv-probe-member@example.invalid';
  s_email      text := 'lcv-probe-sleeper@example.invalid';
  x_email      text := 'lcv-probe-stranger@example.invalid';
  owner0       text;
  owner1       text;
  n            int;
  passed       int := 0;
  failed       int := 0;
begin
  -- ── Build an island: two throwaway souls and one night nobody has seen ───
  insert into members (id, email, cult_name, short_name, role, active) values
    (gen_random_uuid(), m_email, 'Probe the Waking',  'Probe',  'member', true),
    (gen_random_uuid(), s_email, 'Probe the Sleeping','Asleep', 'member', false);

  insert into gatherings (id, number, theme_title, gather_date, status, wine_count)
  values (gid, 999999, 'RLS probe night (rolled back)', current_date, 'revealed', 3);

  insert into annals (gathering_id, number, theme, date, rows, committed_at) values (
    gid, 999999, 'RLS probe night (rolled back)', current_date,
    '[{"cloth":1,"title":"Probe bottle one","owner":"","votes":3,"total":21},
      {"cloth":2,"title":"Probe bottle two","owner":"","votes":3,"total":18},
      {"cloth":3,"title":"Probe bottle three","owner":"","votes":3,"total":12}]'::jsonb,
    now());

  -- ── Become a genuine, waking, NON-KEISER member ─────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('email', m_email, 'sub', gen_random_uuid()::text,
                      'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- Sanity: we really are a member, and really are NOT the Keiser.
  if is_member() then passed := passed + 1; r := r || 'PASS  the probe is seen as a member of the Council' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  the probe is not seen as a member at all' || E'\n'; end if;

  if is_keiser() then failed := failed + 1; r := r || 'FAIL  the probe is being read as the KEISER, the test proves nothing' || E'\n';
  else passed := passed + 1; r := r || 'PASS  the probe is NOT the Keiser (this is the whole point)' || E'\n'; end if;

  -- ── 1. The original refusal must still stand ────────────────────────────
  -- The annals are the record. A member writing them directly is what failed
  -- on the night, and it must still fail, or the record is not the Keiser's.
  begin
    insert into annals (gathering_id, number, theme, date, rows, committed_at)
    values (gen_random_uuid(), 999998, 'should never exist', current_date, '[]'::jsonb, now());
    failed := failed + 1;
    r := r || 'FAIL  a member wrote the annals directly, the record is not sealed' || E'\n';
  exception when insufficient_privilege then
    passed := passed + 1;
    r := r || 'PASS  a member still cannot write the annals directly (42501, as on the night)' || E'\n';
  when others then
    passed := passed + 1;
    r := r || 'PASS  a member still cannot write the annals directly (' || SQLSTATE || ')' || E'\n';
  end;

  -- ── 2. THE ONE THAT MATTERS: the member CAN claim their bottle ──────────
  begin
    perform claim_bottle(gid, 0);
    passed := passed + 1;
    r := r || 'PASS  *** A REAL NON-KEISER MEMBER CLAIMED THEIR BOTTLE (bug #6) ***' || E'\n';
  exception when others then
    failed := failed + 1;
    r := r || 'FAIL  *** THE CLAIM IS STILL REFUSED: ' || SQLERRM || ' ***' || E'\n';
  end;

  select rows->0->>'owner' into owner0 from annals where gathering_id = gid;
  if owner0 = 'Probe the Waking' then
    passed := passed + 1; r := r || 'PASS  and the bottle now carries their name: ' || owner0 || E'\n';
  else
    failed := failed + 1; r := r || 'FAIL  the bottle''s owner reads ' || coalesce(quote_literal(owner0),'NULL') || E'\n';
  end if;

  -- The claim must touch ONE bottle and leave the others alone.
  select count(*) into n from jsonb_array_elements(
    (select rows from annals where gathering_id = gid)) e
   where coalesce(e->>'owner','') <> '';
  if n = 1 then passed := passed + 1; r := r || 'PASS  exactly one bottle was touched, the others are untouched' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  ' || n || ' bottles carry an owner after one claim' || E'\n'; end if;

  -- ── 3. A second bottle on the same night is refused ─────────────────────
  begin
    perform claim_bottle(gid, 1);
    failed := failed + 1;
    r := r || 'FAIL  the same member claimed a SECOND bottle that night' || E'\n';
  exception when others then
    passed := passed + 1;
    r := r || 'PASS  a second bottle is refused: ' || SQLERRM || E'\n';
  end;

  -- ── 4. A bottle already spoken for is refused ───────────────────────────
  begin
    perform claim_bottle(gid, 0);
    failed := failed + 1;
    r := r || 'FAIL  an already-claimed bottle was claimed again' || E'\n';
  exception when others then
    passed := passed + 1;
    r := r || 'PASS  an already-claimed bottle is refused: ' || SQLERRM || E'\n';
  end;

  -- ── 5. A sleeping hand is refused ───────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('email', s_email, 'sub', gen_random_uuid()::text,
                      'role', 'authenticated')::text, true);
  begin
    perform claim_bottle(gid, 1);
    failed := failed + 1;
    r := r || 'FAIL  a SLEEPING member claimed a bottle' || E'\n';
  exception when others then
    passed := passed + 1;
    r := r || 'PASS  a sleeping hand is refused: ' || SQLERRM || E'\n';
  end;

  -- ── 6. A stranger is refused ────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('email', x_email, 'sub', gen_random_uuid()::text,
                      'role', 'authenticated')::text, true);
  begin
    perform claim_bottle(gid, 1);
    failed := failed + 1;
    r := r || 'FAIL  a STRANGER claimed a bottle' || E'\n';
  exception when others then
    passed := passed + 1;
    r := r || 'PASS  a stranger is refused: ' || SQLERRM || E'\n';
  end;

  -- ── 7. A second member may still claim a DIFFERENT bottle ───────────────
  -- (the claim must narrow to one bottle, not lock the whole night)
  perform set_config('role', 'none', true);
  insert into members (id, email, cult_name, short_name, role, active)
  values (gen_random_uuid(), 'lcv-probe-second@example.invalid', 'Probe the Second', 'Second', 'member', true);
  perform set_config('request.jwt.claims',
    json_build_object('email', 'lcv-probe-second@example.invalid', 'sub', gen_random_uuid()::text,
                      'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform claim_bottle(gid, 1);
    passed := passed + 1;
    r := r || 'PASS  a second member claimed a different bottle on the same night' || E'\n';
  exception when others then
    failed := failed + 1;
    r := r || 'FAIL  a second member was refused a free bottle: ' || SQLERRM || E'\n';
  end;

  select rows->1->>'owner' into owner1 from annals where gathering_id = gid;
  select rows->0->>'owner' into owner0 from annals where gathering_id = gid;
  if owner0 = 'Probe the Waking' and owner1 = 'Probe the Second' then
    passed := passed + 1;
    r := r || 'PASS  BOTH claims stand together (the first was not erased)' || E'\n';
  else
    failed := failed + 1;
    r := r || 'FAIL  claims clobbered each other: bottle 1 = ' || coalesce(owner0,'NULL')
          || ', bottle 2 = ' || coalesce(owner1,'NULL') || E'\n';
  end if;

  -- ── 8. The lock that makes simultaneous claims safe ─────────────────────
  perform set_config('role', 'none', true);
  if exists (select 1 from pg_proc where proname = 'claim_bottle'
               and pg_get_functiondef(oid) ilike '%for update%') then
    passed := passed + 1; r := r || 'PASS  claim_bottle holds the row lock (for update), so claims queue' || E'\n';
  else
    failed := failed + 1; r := r || 'FAIL  claim_bottle has NO row lock: simultaneous claims will overwrite' || E'\n';
  end if;

  r := r || E'\n' || passed || ' passed, ' || failed || ' failed'
         || E'\n\nEverything this made is now rolled back. Nothing was committed.' || E'\n';

  -- Always. This is the rollback, and it is not optional.
  raise exception E'%', r;
end $$;
