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

-- Annals: everyone reads the codex; only the Keiser commits/amends.
alter table annals enable row level security;
drop policy if exists "annals read" on annals;
create policy "annals read" on annals for select using (auth.uid() is not null);
drop policy if exists "annals keiser insert" on annals;
create policy "annals keiser insert" on annals for insert with check (is_keiser());
drop policy if exists "annals keiser update" on annals;
create policy "annals keiser update" on annals for update using (is_keiser());
