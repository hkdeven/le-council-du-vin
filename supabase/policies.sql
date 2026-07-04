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

-- Applications: petitions are public — anyone (even unauthenticated) may submit.
alter table applications enable row level security;
drop policy if exists "applications public insert" on applications;
create policy "applications public insert" on applications
  for insert
  with check (true);

-- Make sure the Keiser exists and is ranked correctly (edit the email to yours).
insert into members (email, cult_name, short_name, role, active)
values ('hkdeven@gmail.com', 'The Keiser', 'KE', 'keiser', true)
on conflict (email) do update set role = 'keiser', active = true;

-- Later passes will add: members read all (via a security-definer is_member()
-- helper to avoid recursion), authenticated reads on gatherings/wines/scores,
-- score upserts, theme proposals + favours, and application votes.
