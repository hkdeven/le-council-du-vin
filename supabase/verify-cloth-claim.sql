-- ═══════════════════════════════════════════════════════════════════════════
-- THE CLAIM ON THE NIGHT, PROVEN AS A REAL MEMBER, AGAINST THE REAL DATABASE.
--
-- On two gatherings running every hand but the Keiser's came up unclaimed at
-- the commit. Not a refusal this time: the reveal wrote a member's claim to
-- their own browser and nowhere else, so the Keiser's commit never saw it.
-- The claim is now a number on the claimant's own offering row
-- (offerings.cloth), which they may already write. This proves that door as a
-- genuine non-Keiser member, proves the vault's one-hand-per-bottle rule, and
-- proves that no other hand can move, take or erase a claim that is not theirs.
--
-- IT CANNOT COMMIT: one DO block that always ends by raising, which prints
-- the report and rolls everything back. Safe against production, repeatedly.
--   ./scripts/run-sql.sh supabase/verify-cloth-claim.sql
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  r        text := E'\n';
  gid      uuid := gen_random_uuid();
  m_id     uuid := gen_random_uuid();
  o_id     uuid := gen_random_uuid();
  s_id     uuid := gen_random_uuid();
  m_email  text := 'lcv-probe-member@example.invalid';
  o_email  text := 'lcv-probe-other@example.invalid';
  s_email  text := 'lcv-probe-sleeper@example.invalid';
  got      int;
  got_t    text;
  passed   int := 0;
  failed   int := 0;
begin
  -- ── Build an island ──────────────────────────────────────────────────────
  insert into members (id, email, cult_name, short_name, role, active) values
    (m_id, m_email, 'Probe the Waking',   'Probe',  'member', true),
    (o_id, o_email, 'Probe the Other',    'Other',  'member', true),
    (s_id, s_email, 'Probe the Sleeping', 'Asleep', 'member', false);
  insert into gatherings (id, number, theme_title, gather_date, status, wine_count)
  values (gid, 999999, 'Cloth probe night (rolled back)', current_date, 'revealed', 3);
  -- The waking member logged a wine before the night, as the form does: no cloth.
  insert into offerings (gathering_id, member_id, title, price, varietals) values (gid, m_id, 'Probe Rubicon', 350, array['Cabernet']);
  -- The sleeper logged one too, while still awake.
  insert into offerings (gathering_id, member_id, title) values (gid, s_id, 'Probe Sleeper Red');

  -- ── 0. The column and the rule exist ────────────────────────────────────
  if exists (select 1 from information_schema.columns where table_name='offerings' and column_name='cloth') then
    passed := passed + 1; r := r || 'PASS  offerings.cloth exists' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  offerings.cloth is missing: run schema.sql' || E'\n'; end if;
  if exists (select 1 from pg_indexes where tablename='offerings' and indexname='offerings_one_hand_per_cloth') then
    passed := passed + 1; r := r || 'PASS  one hand per cloth is a rule of the vault (unique index)' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  no unique index: two souls could hold one bottle' || E'\n'; end if;

  -- ── Become a genuine, waking, NON-KEISER member ─────────────────────────
  perform set_config('request.jwt.claims', json_build_object('email', m_email, 'sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if is_keiser() then failed := failed + 1; r := r || 'FAIL  the probe is being read as the KEISER, the test proves nothing' || E'\n';
  else passed := passed + 1; r := r || 'PASS  the probe is NOT the Keiser' || E'\n'; end if;

  -- ── 1. The claim, exactly as claimCloth() writes it ─────────────────────
  begin
    insert into offerings (gathering_id, member_id, cloth) values (gid, m_id, 2)
      on conflict (gathering_id, member_id) do update set cloth = excluded.cloth;
    select cloth, title into got, got_t from offerings where gathering_id = gid and member_id = m_id;
    if got = 2 and got_t = 'Probe Rubicon' then
      passed := passed + 1; r := r || 'PASS  a member claims cloth 2 on their own row, and their logged wine survives it' || E'\n';
    else failed := failed + 1; r := r || 'FAIL  claim wrote cloth=' || coalesce(got::text,'null') || ' title=' || coalesce(got_t,'null') || E'\n'; end if;
  exception when others then
    failed := failed + 1; r := r || 'FAIL  a member could not claim on their own offering (' || SQLSTATE || ' ' || SQLERRM || ')' || E'\n';
  end;

  -- ── 2. Re-saving the wine, as the form does, keeps the claim ────────────
  begin
    insert into offerings (gathering_id, member_id, title, price, varietals) values (gid, m_id, 'Probe Rubicon 2019', 360, array['Cabernet'])
      on conflict (gathering_id, member_id) do update set title = excluded.title, price = excluded.price, varietals = excluded.varietals;
    select cloth into got from offerings where gathering_id = gid and member_id = m_id;
    if got = 2 then passed := passed + 1; r := r || 'PASS  editing the wine after claiming does not drop the claim' || E'\n';
    else failed := failed + 1; r := r || 'FAIL  editing the wine reset cloth to ' || coalesce(got::text,'null') || E'\n'; end if;
  end;

  -- ── 3. A soul who never logged a wine may still claim ───────────────────
  perform set_config('request.jwt.claims', json_build_object('email', o_email, 'sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into offerings (gathering_id, member_id, cloth) values (gid, o_id, 3)
      on conflict (gathering_id, member_id) do update set cloth = excluded.cloth;
    passed := passed + 1; r := r || 'PASS  a member with no logged wine still lands a claim (cloth 3)' || E'\n';
  exception when others then
    failed := failed + 1; r := r || 'FAIL  a member with no offering row could not claim (' || SQLSTATE || ')' || E'\n';
  end;

  -- ── 4. One hand per bottle ──────────────────────────────────────────────
  begin
    insert into offerings (gathering_id, member_id, cloth) values (gid, o_id, 2)
      on conflict (gathering_id, member_id) do update set cloth = excluded.cloth;
    failed := failed + 1; r := r || 'FAIL  a second hand took cloth 2, which another soul already holds' || E'\n';
  exception when unique_violation then
    passed := passed + 1; r := r || 'PASS  a bottle already claimed is refused to a second hand (23505)' || E'\n';
  when others then
    failed := failed + 1; r := r || 'FAIL  second claim on cloth 2 failed for the wrong reason (' || SQLSTATE || ')' || E'\n';
  end;
  select cloth into got from offerings where gathering_id = gid and member_id = m_id;
  if got = 2 then passed := passed + 1; r := r || 'PASS  and the first hand still holds it' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  the first claim was disturbed: cloth=' || coalesce(got::text,'null') || E'\n'; end if;

  -- ── 5. Release, then claim another ──────────────────────────────────────
  insert into offerings (gathering_id, member_id, cloth) values (gid, o_id, null)
    on conflict (gathering_id, member_id) do update set cloth = excluded.cloth;
  select cloth into got from offerings where gathering_id = gid and member_id = o_id;
  if got is null then passed := passed + 1; r := r || 'PASS  a claim can be released' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  release left cloth=' || got || E'\n'; end if;
  insert into offerings (gathering_id, member_id, cloth) values (gid, o_id, 1)
    on conflict (gathering_id, member_id) do update set cloth = excluded.cloth;
  select count(*) into got from offerings where gathering_id = gid and cloth is not null;
  if got = 2 then passed := passed + 1; r := r || 'PASS  two members'' claims stand together (cloths 1 and 2)' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  expected 2 claims, found ' || got || E'\n'; end if;

  -- ── 6. A sleeping hand is refused ───────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('email', s_email, 'sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into offerings (gathering_id, member_id, cloth) values (gid, s_id, 3)
      on conflict (gathering_id, member_id) do update set cloth = excluded.cloth;
    select cloth into got from offerings where gathering_id = gid and member_id = s_id;
    if got is null then passed := passed + 1; r := r || 'PASS  a sleeping hand''s claim does not land (the seal holds)' || E'\n';
    else failed := failed + 1; r := r || 'FAIL  a sleeping member claimed a bottle' || E'\n'; end if;
  exception when others then
    passed := passed + 1; r := r || 'PASS  a sleeping hand is refused a claim (' || SQLSTATE || ')' || E'\n';
  end;

  -- ── 6b. Another hand cannot move or take my claim ───────────────────────
  -- Become the OTHER member and try to write the first member's row.
  perform set_config('request.jwt.claims', json_build_object('email', o_email, 'sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update offerings set cloth = 3 where gathering_id = gid and member_id = m_id;
  select cloth into got from offerings where gathering_id = gid and member_id = m_id;
  if got = 2 then passed := passed + 1; r := r || 'PASS  another member cannot move my claim (the update touched nothing)' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  another member moved my claim to cloth ' || coalesce(got::text,'null') || E'\n'; end if;
  begin
    insert into offerings (gathering_id, member_id, cloth) values (gen_random_uuid(), m_id, 1);
    failed := failed + 1; r := r || 'FAIL  another member wrote a row in my name' || E'\n';
  exception when insufficient_privilege then
    passed := passed + 1; r := r || 'PASS  another member cannot write a row in my name (42501)' || E'\n';
  when foreign_key_violation then
    failed := failed + 1; r := r || 'FAIL  the insert in my name got past RLS (stopped only by a foreign key)' || E'\n';
  when others then
    passed := passed + 1; r := r || 'PASS  another member cannot write a row in my name (' || SQLSTATE || ')' || E'\n';
  end;
  delete from offerings where gathering_id = gid and member_id = m_id;
  select count(*) into got from offerings where gathering_id = gid and member_id = m_id;
  if got = 1 then passed := passed + 1; r := r || 'PASS  another member cannot erase my offering' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  another member erased my offering' || E'\n'; end if;

  -- ── 7. Every claim is readable by the table (the Keiser's commit reads them)
  perform set_config('request.jwt.claims', json_build_object('email', m_email, 'sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into got from offerings where gathering_id = gid and cloth is not null;
  if got = 2 then passed := passed + 1; r := r || 'PASS  a member reads every claim on the night, so the commit can too' || E'\n';
  else failed := failed + 1; r := r || 'FAIL  a member sees ' || got || ' claims, expected 2' || E'\n'; end if;

  raise exception E'%\n% passed, % failed. ROLLED BACK: nothing above was kept.', r, passed, failed;
end $$;
