-- Le Council du Vin — Row Level Security policies
-- Run this in the Supabase SQL editor AFTER schema.sql.
-- This first pass covers what login needs: a member can read their own row
-- (for role resolution), and anyone may submit a petition.

-- Members: a signed-in user may read their own row, keyed on their JWT email.
alter table members enable row level security;
drop policy if exists "members self read" on members;
create policy "members self read" on members
  for select
  using ((auth.jwt() ->> 'email') = email);

-- Helper: is the current user the Keiser? SECURITY DEFINER so it can read the
-- members table without tripping members' own RLS (which would recurse).
create or replace function is_keiser() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from members
    where lower(email) = lower(auth.jwt() ->> 'email') and role = 'keiser'
  );
$$;

-- Applications: petitions are public to submit; only the Keiser may read them
-- (to see the tribunal) and rule on them (anoint / cast out).
alter table applications enable row level security;
drop policy if exists "applications public insert" on applications;
create policy "applications public insert" on applications
  for insert
  with check (true);
drop policy if exists "applications keiser read" on applications;
create policy "applications keiser read" on applications
  for select using (is_keiser());
drop policy if exists "applications keiser update" on applications;
create policy "applications keiser update" on applications
  for update using (is_keiser());

-- Members: the Keiser manages the whole roster (read all, anoint, elevate,
-- cast out). The "members self read" policy above still lets everyone else
-- read their own row; policies are OR'd, so both apply.
drop policy if exists "members keiser read" on members;
create policy "members keiser read" on members
  for select using (is_keiser());
drop policy if exists "members keiser insert" on members;
create policy "members keiser insert" on members
  for insert with check (is_keiser());
drop policy if exists "members keiser update" on members;
create policy "members keiser update" on members
  for update using (is_keiser());
drop policy if exists "members keiser delete" on members;
create policy "members keiser delete" on members
  for delete using (is_keiser());

-- Make sure the Keiser exists and is ranked correctly (edit the email to yours).
insert into members (email, cult_name, short_name, role, active)
values ('hkdeven@gmail.com', 'The Keiser', 'KE', 'keiser', true)
on conflict (email) do update set role = 'keiser', active = true;

-- Gatherings: every signed-in member reads the meetings; the Keiser summons,
-- amends and cancels them; any signed-in member may update (needed for RSVP,
-- which writes the attendees array).
alter table gatherings enable row level security;
drop policy if exists "gatherings read" on gatherings;
create policy "gatherings read" on gatherings
  for select using (auth.uid() is not null);
drop policy if exists "gatherings keiser insert" on gatherings;
create policy "gatherings keiser insert" on gatherings
  for insert with check (is_keiser());
drop policy if exists "gatherings member update" on gatherings;
create policy "gatherings member update" on gatherings
  for update using (auth.uid() is not null);
drop policy if exists "gatherings keiser delete" on gatherings;
create policy "gatherings keiser delete" on gatherings
  for delete using (is_keiser());

-- Themes + favours: members read + propose + favour; the Keiser amends/removes.
alter table themes enable row level security;
drop policy if exists "themes read" on themes;
create policy "themes read" on themes for select using (auth.uid() is not null);
drop policy if exists "themes member insert" on themes;
create policy "themes member insert" on themes for insert with check (auth.uid() is not null);
drop policy if exists "themes keiser update" on themes;
create policy "themes keiser update" on themes for update using (is_keiser());
drop policy if exists "themes keiser delete" on themes;
create policy "themes keiser delete" on themes for delete using (is_keiser());
alter table theme_favours enable row level security;
drop policy if exists "favours read" on theme_favours;
create policy "favours read" on theme_favours for select using (auth.uid() is not null);
drop policy if exists "favours insert" on theme_favours;
create policy "favours insert" on theme_favours for insert with check (auth.uid() is not null);
drop policy if exists "favours delete" on theme_favours;
create policy "favours delete" on theme_favours for delete using (auth.uid() is not null);

-- Polls: any signed-in member may read, open, vote (update), archive.
alter table polls enable row level security;
drop policy if exists "polls read" on polls;
create policy "polls read" on polls for select using (auth.uid() is not null);
drop policy if exists "polls insert" on polls;
create policy "polls insert" on polls for insert with check (auth.uid() is not null);
drop policy if exists "polls update" on polls;
create policy "polls update" on polls for update using (auth.uid() is not null);

-- Ballots: any signed-in member may read (the reveal tallies everyone) and
-- write their own scores.
alter table ballots enable row level security;
drop policy if exists "ballots read" on ballots;
create policy "ballots read" on ballots for select using (auth.uid() is not null);
drop policy if exists "ballots insert" on ballots;
create policy "ballots insert" on ballots for insert with check (auth.uid() is not null);
drop policy if exists "ballots update" on ballots;
create policy "ballots update" on ballots for update using (auth.uid() is not null);

-- Offerings: any signed-in member reads (the reveal shows claimed bottles) and
-- writes their own.
alter table offerings enable row level security;
drop policy if exists "offerings read" on offerings;
create policy "offerings read" on offerings for select using (auth.uid() is not null);
drop policy if exists "offerings insert" on offerings;
create policy "offerings insert" on offerings for insert with check (auth.uid() is not null);
drop policy if exists "offerings update" on offerings;
create policy "offerings update" on offerings for update using (auth.uid() is not null);
drop policy if exists "offerings delete" on offerings;
create policy "offerings delete" on offerings for delete using (auth.uid() is not null);

-- Reveal photos: a public Storage bucket that signed-in members may upload to.
insert into storage.buckets (id, name, public)
  values ('reveal-photos', 'reveal-photos', true)
  on conflict (id) do nothing;
drop policy if exists "reveal photos upload" on storage.objects;
create policy "reveal photos upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'reveal-photos');
drop policy if exists "reveal photos update" on storage.objects;
create policy "reveal photos update" on storage.objects
  for update to authenticated using (bucket_id = 'reveal-photos');

-- Annals: everyone reads the codex; only the Keiser commits/amends.
alter table annals enable row level security;
drop policy if exists "annals read" on annals;
create policy "annals read" on annals for select using (auth.uid() is not null);
drop policy if exists "annals keiser insert" on annals;
create policy "annals keiser insert" on annals for insert with check (is_keiser());
drop policy if exists "annals keiser update" on annals;
create policy "annals keiser update" on annals for update using (is_keiser());

-- ── Fix (2026-07-08): members could not see each other ──────────────────────
-- "members self read" only exposed a member's own row, so every other soul's
-- poll votes, RSVPs, avatars and cards showed as raw ids to non-Keiser users.
-- Any actual member (a row in members matches their JWT email) may read the
-- whole roster. Strangers who merely signed in with Google still see nothing.
create or replace function is_member() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from members
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "members roster read" on members;
create policy "members roster read" on members
  for select using (is_member());

-- ── Guard (2026-07-08): members may edit their own row, never their rank ────
-- A "members self update" policy exists live (added via dashboard; it is what
-- lets members save their profiles). RLS cannot restrict columns, so without
-- this trigger a member could set role='keiser' on their own row. The trigger
-- lets the Keiser, the SQL editor, and service-role scripts change anything;
-- every other signed-in user can update everything EXCEPT role, active, email.
create or replace function members_guard_privileged() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- No-JWT (SQL editor) and service-role (admin scripts) contexts are trusted;
  -- signed-in users must be the Keiser to touch rank, standing, or email.
  if (new.role is distinct from old.role
      or new.active is distinct from old.active
      or new.email is distinct from old.email)
     and coalesce(auth.jwt() ->> 'role', '') not in ('', 'service_role')
     and not is_keiser() then
    raise exception 'Only the Keiser may change rank, standing, or email.';
  end if;
  return new;
end $$;

drop trigger if exists members_guard_privileged on members;
create trigger members_guard_privileged before update on members
  for each row execute function members_guard_privileged();

-- The live "members self update" policy, mirrored here for the record:
drop policy if exists "members self update" on members;
create policy "members self update" on members
  for update using ((auth.jwt() ->> 'email') = email);

-- ── Ranks at the gate (2026-07-12): tribunal, counsel and ballots by rank ───
-- #10: only full members and the Keiser see the tribunal and counsel on a
-- petition — initiates may not, and the walls hold at the database, not just
-- the nav. #11: initiates read the codex (annals already allow any signed-in
-- member; the nav now shows them the door). #6: a member's individual scores
-- never leave the database for an initiate — ballots are readable only by
-- full members plus one's own row; the reveal's aggregates come from the
-- reveal_summary function below instead.

-- Is the current user a FULL member (member or keiser)? SECURITY DEFINER for
-- the same reason as is_keiser(): policies must not recurse into members' RLS.
create or replace function is_full_member() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from members
    where lower(email) = lower(auth.jwt() ->> 'email') and role in ('member','keiser')
  );
$$;

-- The current user's own members.id (null for strangers).
create or replace function my_member_id() returns uuid
  language sql security definer stable
  set search_path = public
as $$
  select id from members where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
$$;

-- Applications: the tribunal is read by every FULL member (the old
-- keiser-only read left plain members before an empty tribunal in live mode);
-- initiates see nothing. The Keiser alone still decrees (update).
drop policy if exists "applications keiser read" on applications;
drop policy if exists "applications full member read" on applications;
create policy "applications full member read" on applications
  for select using (is_full_member());

-- Counsel on a petition: writes ONLY the caller's own key into
-- applications.votes, and ONLY for a full, active member — the API-level
-- wall for #10 (previously live via the dashboard; kept here for the record,
-- now with the rank check).
create or replace function cast_counsel(app_id uuid, vote text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  mid uuid;
begin
  if vote not in ('anoint','cast_out','abstain') then
    raise exception 'Unknown counsel.';
  end if;
  select id into mid from members
    where lower(email) = lower(auth.jwt() ->> 'email') and role in ('member','keiser') and active;
  if mid is null then
    raise exception 'Only full members of the Council may counsel.';
  end if;
  update applications
     set votes = coalesce(votes, '{}'::jsonb) || jsonb_build_object(mid::text, vote)
   where id = app_id and status = 'pending';
  if not found then
    raise exception 'The petition is no longer pending.';
  end if;
end $$;
revoke all on function cast_counsel(uuid, text) from public;
grant execute on function cast_counsel(uuid, text) to authenticated;

-- The legacy application_votes table is unused by the app (counsel lives in
-- applications.votes); lock it so nothing writes around the RPC.
alter table application_votes enable row level security;

-- Ballots: individual scores are full-member reading; every soul still owns
-- (reads, writes) their own ballot for the rite. Writes were "any signed-in
-- user, any row" — now one may only write one's own.
drop policy if exists "ballots read" on ballots;
drop policy if exists "ballots full member read" on ballots;
create policy "ballots full member read" on ballots
  for select using (is_full_member() or member_id = my_member_id());
drop policy if exists "ballots insert" on ballots;
drop policy if exists "ballots own insert" on ballots;
create policy "ballots own insert" on ballots
  for insert with check (member_id = my_member_id());
drop policy if exists "ballots update" on ballots;
drop policy if exists "ballots own update" on ballots;
create policy "ballots own update" on ballots
  for update using (member_id = my_member_id());

-- The reveal's aggregates for ranks that may not read individual ballots:
-- per-cloth average/votes/spread, anonymous notes, and who has sealed —
-- never a member's own scores. SECURITY DEFINER with a membership guard.
create or replace function reveal_summary(gid uuid) returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not is_member() then
    raise exception 'Only the Council may look upon the reveal.';
  end if;
  return jsonb_build_object(
    'sealed', coalesce((
      select jsonb_agg(member_id) from ballots where gathering_id = gid and sealed
    ), '[]'::jsonb),
    'totals', coalesce((
      select jsonb_object_agg(t.cloth, jsonb_build_object(
        'avg', t.avg, 'votes', t.votes, 'min', t.min, 'max', t.max))
      from (
        select s.key as cloth,
               round(avg((s.value)::numeric), 2) as avg,
               count(*) as votes,
               min((s.value)::numeric) as min,
               max((s.value)::numeric) as max
        from ballots b, jsonb_each_text(b.scores) s
        where b.gathering_id = gid and b.sealed and (s.value)::numeric > 0
        group by s.key
      ) t
    ), '{}'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('cloth', n.key, 'note', n.value))
      from ballots b, jsonb_each_text(b.notes) n
      where b.gathering_id = gid and b.sealed and length(trim(n.value)) > 0
    ), '[]'::jsonb)
  );
end $$;
revoke all on function reveal_summary(uuid) from public;
grant execute on function reveal_summary(uuid) to authenticated;

-- ── The gate ledger (2026-07-12): login events, Keiser's eyes only ──────────
-- Rows are written ONLY by the /api/log-login route with the service role
-- (which carries the caller's verified email and connection IP); with RLS on
-- and no insert policy, no browser can forge an entry. Ticket #12.
alter table login_events enable row level security;
drop policy if exists "login events keiser read" on login_events;
create policy "login events keiser read" on login_events
  for select using (is_keiser());

-- ── Avatars in Storage (2026-07-08): portraits leave the members table ──────
-- Member portraits were base64 data URLs in members.avatar_url — hundreds of
-- KB per roster query, uncacheable. They now live in a public bucket like
-- reveal photos; the column holds a short URL the browser caches.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
drop policy if exists "avatars insert" on storage.objects;
create policy "avatars insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
drop policy if exists "avatars update" on storage.objects;
create policy "avatars update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select using (bucket_id = 'avatars');

-- ══════════════════════════════════════════════════════════════════════════
-- THE SLEEPING SEAL (2026-07-16). A member whose row reads active = false is
-- SLEEPING: they keep every reading right their rank grants, but write nothing.
-- The browser-side lock (src/lib/writeLock.ts) is a courtesy; THIS is the
-- enforcement, because anyone with devtools can call Supabase directly.
--
-- RESTRICTIVE is the load-bearing word. Postgres ORs permissive policies
-- together, so a new permissive policy can never take a right away: only a
-- restrictive policy, ANDed with everything else, can. Each one below reads
-- "and also, the caller must be awake".
-- ══════════════════════════════════════════════════════════════════════════

-- Is the caller awake? SECURITY DEFINER so it can read members without
-- tripping members' own RLS (the same reason is_keiser() is defined this way).
-- Anyone with no member row at all (a petitioner at the gate) is NOT sleeping:
-- the seal binds members of the Council, not strangers.
create or replace function is_awake() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select not exists (
    select 1 from members
    where lower(email) = lower(auth.jwt() ->> 'email') and active = false
  );
$$;
revoke all on function is_awake() from public;
grant execute on function is_awake() to authenticated, anon;

-- Every table that holds a record of the Council.
-- All three verbs: an UPDATE-only seal left a sleeping Keiser able to anoint
-- (upsert's insert branch) and to cast members out at the database.
drop policy if exists "members sleeping seal" on members;
create policy "members sleeping seal" on members as restrictive
  for update using (is_awake());
drop policy if exists "members sleeping seal insert" on members;
create policy "members sleeping seal insert" on members as restrictive
  for insert with check (is_awake());
drop policy if exists "members sleeping seal delete" on members;
create policy "members sleeping seal delete" on members as restrictive
  for delete using (is_awake());

drop policy if exists "applications sleeping seal insert" on applications;
create policy "applications sleeping seal insert" on applications as restrictive
  for insert with check (is_awake());
drop policy if exists "applications sleeping seal update" on applications;
create policy "applications sleeping seal update" on applications as restrictive
  for update using (is_awake());
drop policy if exists "applications sleeping seal delete" on applications;
create policy "applications sleeping seal delete" on applications as restrictive
  for delete using (is_awake());

drop policy if exists "gatherings sleeping seal insert" on gatherings;
create policy "gatherings sleeping seal insert" on gatherings as restrictive
  for insert with check (is_awake());
drop policy if exists "gatherings sleeping seal update" on gatherings;
create policy "gatherings sleeping seal update" on gatherings as restrictive
  for update using (is_awake());
drop policy if exists "gatherings sleeping seal delete" on gatherings;
create policy "gatherings sleeping seal delete" on gatherings as restrictive
  for delete using (is_awake());

drop policy if exists "themes sleeping seal insert" on themes;
create policy "themes sleeping seal insert" on themes as restrictive
  for insert with check (is_awake());
drop policy if exists "themes sleeping seal update" on themes;
create policy "themes sleeping seal update" on themes as restrictive
  for update using (is_awake());
drop policy if exists "themes sleeping seal delete" on themes;
create policy "themes sleeping seal delete" on themes as restrictive
  for delete using (is_awake());

drop policy if exists "favours sleeping seal insert" on theme_favours;
create policy "favours sleeping seal insert" on theme_favours as restrictive
  for insert with check (is_awake());
drop policy if exists "favours sleeping seal delete" on theme_favours;
create policy "favours sleeping seal delete" on theme_favours as restrictive
  for delete using (is_awake());

drop policy if exists "polls sleeping seal insert" on polls;
create policy "polls sleeping seal insert" on polls as restrictive
  for insert with check (is_awake());
drop policy if exists "polls sleeping seal update" on polls;
create policy "polls sleeping seal update" on polls as restrictive
  for update using (is_awake());

drop policy if exists "ballots sleeping seal insert" on ballots;
create policy "ballots sleeping seal insert" on ballots as restrictive
  for insert with check (is_awake());
drop policy if exists "ballots sleeping seal update" on ballots;
create policy "ballots sleeping seal update" on ballots as restrictive
  for update using (is_awake());

drop policy if exists "offerings sleeping seal insert" on offerings;
create policy "offerings sleeping seal insert" on offerings as restrictive
  for insert with check (is_awake());
drop policy if exists "offerings sleeping seal update" on offerings;
create policy "offerings sleeping seal update" on offerings as restrictive
  for update using (is_awake());
drop policy if exists "offerings sleeping seal delete" on offerings;
create policy "offerings sleeping seal delete" on offerings as restrictive
  for delete using (is_awake());

drop policy if exists "annals sleeping seal insert" on annals;
create policy "annals sleeping seal insert" on annals as restrictive
  for insert with check (is_awake());
drop policy if exists "annals sleeping seal update" on annals;
create policy "annals sleeping seal update" on annals as restrictive
  for update using (is_awake());
drop policy if exists "annals sleeping seal delete" on annals;
create policy "annals sleeping seal delete" on annals as restrictive
  for delete using (is_awake());

-- Storage: the records buckets are sealed. `charts` is NOT: a chart PNG
-- rendered for a member's own Heavens email is a self-serving artifact, not a
-- record of the Council, and a sleeping soul may still read their own sky.
drop policy if exists "storage sleeping seal insert" on storage.objects;
create policy "storage sleeping seal insert" on storage.objects as restrictive
  for insert with check (bucket_id = 'charts' or is_awake());
drop policy if exists "storage sleeping seal update" on storage.objects;
create policy "storage sleeping seal update" on storage.objects as restrictive
  for update using (bucket_id = 'charts' or is_awake());
drop policy if exists "storage sleeping seal delete" on storage.objects;
create policy "storage sleeping seal delete" on storage.objects as restrictive
  for delete using (bucket_id = 'charts' or is_awake());

-- The counsel RPC is SECURITY DEFINER, so it runs past RLS: seal it by hand.
-- (Its existing guard already requires role in ('member','keiser') AND active,
-- so a sleeping soul is refused there too; this note records that it was
-- checked, not forgotten.)

-- ── Three doors nobody guards (found 2026-07-16 by the sleeping-seal audit) ──
-- wines, bottles and scores are legacy tables from the first schema: no app
-- code touches them (grep for from("wines") and kin returns nothing), and
-- unlike every other table they were never given row level security at all,
-- so ANY holder of the public anon key could read or write them, sleeping or
-- not, member or stranger. Enabling RLS with no policies denies everyone
-- except service-role scripts and the SQL editor. If they are ever revived,
-- they need real policies AND a sleeping seal like their neighbours above.
alter table if exists wines enable row level security;
alter table if exists bottles enable row level security;
alter table if exists scores enable row level security;

-- A fourth door, same family (2026-07-17): the wine_rankings VIEW read over
-- wines/scores. Views run as their owner, so it read past the RLS enabled
-- above: a way around the seal. No app code ever queried it. Dropped; see
-- schema.sql for how to revive it safely (security_invoker).
drop view if exists wine_rankings;

-- ── Photographs of past nights, open to a sleeping hand (2026-07-17) ────────
-- The Keiser's decree: a sleeping member may edit NOTHING, "except perhaps add
-- photos to past meetings". Two things stood in the way, and both are fixed
-- here rather than by weakening the seal:
--   1. the `reveal-photos` bucket was sealed with the rest -> carved out below,
--      exactly as `charts` already was. `avatars` stays sealed: a portrait is
--      a member's own record, and sleep stays the hand on that.
--   2. the photo list lives in gatherings.reveal_photos, and RLS cannot open a
--      single COLUMN without opening the whole row (which would hand a sleeping
--      member the theme, the date, the hosts, everything). So the append goes
--      through a SECURITY DEFINER function that does one thing and nothing else.
drop policy if exists "storage sleeping seal insert" on storage.objects;
create policy "storage sleeping seal insert" on storage.objects as restrictive
  for insert with check (bucket_id in ('charts', 'reveal-photos') or is_awake());
drop policy if exists "storage sleeping seal update" on storage.objects;
create policy "storage sleeping seal update" on storage.objects as restrictive
  for update using (bucket_id in ('charts', 'reveal-photos') or is_awake());
drop policy if exists "storage sleeping seal delete" on storage.objects;
create policy "storage sleeping seal delete" on storage.objects as restrictive
  for delete using (bucket_id in ('charts', 'reveal-photos') or is_awake());

-- Append one photograph to one night. Any member of the Council may call it,
-- sleeping or awake; it can do nothing else. A stranger with no member row is
-- refused. Note this deliberately does NOT check is_awake().
create or replace function add_reveal_photo(gid uuid, url text) returns void
  language plpgsql security definer
  set search_path = public
as $$
begin
  if not exists (select 1 from members where lower(email) = lower(auth.jwt() ->> 'email')) then
    raise exception 'Only members of the Council may hang a photograph.';
  end if;
  update gatherings
     set reveal_photos = array_append(coalesce(reveal_photos, '{}'), url)
   where id = gid;
  if not found then
    raise exception 'No such gathering.';
  end if;
end $$;
revoke all on function add_reveal_photo(uuid, text) from public;
grant execute on function add_reveal_photo(uuid, text) to authenticated;

-- ── The door, made forgiving (2026-08-10) ──────────────────────────────────
-- A member's access hangs on their auth address matching their members row.
-- Both the app's lookup and this policy compared EXACTLY, so a single capital
-- letter or a stray space locked a soul out of the Council entirely, showing
-- them "known to the gate, but not yet of the Council" forever. (Found when
-- James could not log in.) Emails are case-insensitive by convention, so the
-- comparison is now made on the canonical form at both ends.
--
-- 1. Canonicalise what is already stored, everywhere an address lives.
update members      set email = lower(trim(email)) where email <> lower(trim(email));
update applications set email = lower(trim(email)) where email <> lower(trim(email));

-- 2. Compare canonically from here on, so a legacy oddity cannot bar the door.
drop policy if exists "members self read" on members;
create policy "members self read" on members
  for select
  using (lower(auth.jwt() ->> 'email') = lower(email));

drop policy if exists "members self update" on members;
create policy "members self update" on members
  for update using (lower(auth.jwt() ->> 'email') = lower(email));

-- 3. The helpers that decide rank and standing must agree, or a member could
--    read their row yet still be judged a stranger by is_keiser()/is_awake().
create or replace function is_keiser() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from members
    where lower(email) = lower(auth.jwt() ->> 'email') and role = 'keiser'
  );
$$;

create or replace function is_awake() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select not exists (
    select 1 from members
    where lower(email) = lower(auth.jwt() ->> 'email') and active = false
  );
$$;

-- 4. The same for is_member() and the two SECURITY DEFINER doors, or a member
--    with an oddly-cased address could read their row yet be refused the
--    roster, the tribunal's counsel, and the hanging of a photograph.
create or replace function is_member() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from members where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- ── A member may claim their own bottle (2026-08-21) ───────────────────────
-- The annals are the record, so only the Keiser may write them. That left a
-- member's claim on the codex refused outright: "new row violates row-level
-- security policy for table annals" (hit by every member but the Keiser on
-- the first real night). RLS cannot open one field of one row inside a jsonb
-- array, so the claim goes through a door that does exactly one thing.
--
-- It refuses: a stranger, a sleeping member, a bottle already spoken for, and
-- a second bottle on a night where the caller already holds one.
create or replace function claim_bottle(gid uuid, row_index int) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  me text;
  rows_json jsonb;
begin
  select cult_name into me from members
   where lower(email) = lower(auth.jwt() ->> 'email') and active;
  if me is null then
    raise exception 'Only a waking member of the Council may claim a bottle.';
  end if;

  -- FOR UPDATE is load-bearing, not decoration. Every soul claims their bottle
  -- in the same half-minute after the cloths lift, and `rows` is ONE jsonb
  -- column: without the lock two claims read the same array, each writes its
  -- own copy back, and the second silently erases the first. The member saw
  -- a success and their name is simply gone. The lock serialises the
  -- read-modify-write so concurrent claims queue instead of overwriting.
  select rows into rows_json from annals where gathering_id = gid for update;
  if rows_json is null then
    raise exception 'That night is not in the annals.';
  end if;
  if rows_json -> row_index is null then
    raise exception 'No such bottle on that night.';
  end if;
  if coalesce(rows_json -> row_index ->> 'owner', '') <> '' then
    raise exception 'That bottle is already claimed.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(rows_json) r
     where lower(trim(coalesce(r ->> 'owner', ''))) = lower(trim(me))
  ) then
    raise exception 'You have already claimed a bottle that night.';
  end if;

  update annals
     set rows = jsonb_set(rows_json, array[row_index::text, 'owner'], to_jsonb(me))
   where gathering_id = gid;
end $$;
revoke all on function claim_bottle(uuid, int) from public;
grant execute on function claim_bottle(uuid, int) to authenticated;

-- ── An offering is its owner's row alone (2026-09-24) ──────────────────────
-- The three write policies above let ANY signed-in member write ANY member's
-- offering (auth.uid() is not null, nothing binding member_id). Tolerable
-- while an offering was a private note; not once offerings.cloth decides who
-- brought which bottle. From here a member writes only the row that is theirs.
-- The Keiser keeps the hand the codex has always had. Reads are unchanged.
create or replace function my_member_id() returns uuid
  language sql security definer stable
  set search_path = public
as $$
  select id from members where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
$$;
drop policy if exists "offerings insert" on offerings;
create policy "offerings insert" on offerings for insert
  with check (member_id = my_member_id() or is_keiser());
drop policy if exists "offerings update" on offerings;
create policy "offerings update" on offerings for update
  using (member_id = my_member_id() or is_keiser())
  with check (member_id = my_member_id() or is_keiser());
drop policy if exists "offerings delete" on offerings;
create policy "offerings delete" on offerings for delete
  using (member_id = my_member_id() or is_keiser());

-- ── The Keiser may erase a night (2026-09-11) ──────────────────────────────
-- The annals had SELECT, INSERT and UPDATE policies but no permissive DELETE,
-- so with RLS on, a delete matched zero rows for everyone, the Keiser included.
-- PostgREST reports that as success: `deleteAnnal` returned without error and
-- the row stayed. `eraseGathering` deletes the gathering FIRST and loudly, so
-- the failure landed in the worst place, with the gathering gone and its annal
-- left orphaned, and the erased night still standing in the codex.
drop policy if exists "annals keiser delete" on annals;
create policy "annals keiser delete" on annals for delete using (is_keiser());
