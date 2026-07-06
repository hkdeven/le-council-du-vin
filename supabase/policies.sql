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

-- Later passes will add: authenticated reads on gatherings/wines/scores,
-- score upserts, theme proposals + favours, and application votes.
