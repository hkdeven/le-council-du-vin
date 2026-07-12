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
    where email = (auth.jwt() ->> 'email') and role = 'keiser'
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
    where email = (auth.jwt() ->> 'email')
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
    where email = (auth.jwt() ->> 'email') and role in ('member','keiser')
  );
$$;

-- The current user's own members.id (null for strangers).
create or replace function my_member_id() returns uuid
  language sql security definer stable
  set search_path = public
as $$
  select id from members where email = (auth.jwt() ->> 'email') limit 1;
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
    where email = (auth.jwt() ->> 'email') and role in ('member','keiser') and active;
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
