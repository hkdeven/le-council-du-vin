-- Le Council du Vin — database schema
-- Run this in the Supabase SQL editor on a fresh project.
-- Roles: 'initiate' | 'member' | 'keiser'. The Keiser is the super-admin.

create extension if not exists "pgcrypto";

-- Members ------------------------------------------------------------
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  cult_name text not null,
  short_name text,
  role text not null default 'initiate' check (role in ('initiate','member','keiser')),
  zodiac text,
  element text,
  date_of_birth date,
  time_of_birth time,
  avatar_url text,
  venue_instructions text,
  last_hosted date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Themes (the idea pool) --------------------------------------------
create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  proposed_by uuid references members(id) on delete set null,
  status text not null default 'pool' check (status in ('pool','scheduled','used')),
  created_at timestamptz not null default now()
);

create table if not exists theme_favours (
  theme_id uuid references themes(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  primary key (theme_id, member_id)
);

-- Gatherings (monthly wine nights) ----------------------------------
create table if not exists gatherings (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  moon_label text,
  theme_id uuid references themes(id) on delete set null,
  host_id uuid references members(id) on delete set null,
  gather_date date,
  status text not null default 'upcoming' check (status in ('upcoming','scoring','revealed')),
  created_at timestamptz not null default now()
);

-- Wines (numbered black cloths) -------------------------------------
create table if not exists wines (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid references gatherings(id) on delete cascade,
  cloth_number int not null,
  producer text,
  vintage text,
  region text,
  brought_by uuid references members(id) on delete set null,
  revealed boolean not null default false,
  unique (gathering_id, cloth_number)
);

-- Private bottle registrations --------------------------------------
-- Each member may log the wine they plan to bring, ahead of the night.
-- RLS intent (policies pass): only the owner may select/update their row
-- until the gathering's status is 'revealed'; then all members may read.
create table if not exists bottles (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid references gatherings(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  unique (gathering_id, member_id)
);

-- Scores (one per member per wine) ----------------------------------
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid references wines(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  score int not null check (score between 1 and 10),
  aromas text[],
  notes text,
  created_at timestamptz not null default now(),
  unique (wine_id, member_id)
);

-- Membership applications -------------------------------------------
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  cult_name text not null,
  email text not null,
  date_of_birth date,
  time_of_birth time,
  draw_reason text,
  if_wine text,
  wine_sin text,
  oath boolean not null default false,
  status text not null default 'pending' check (status in ('pending','anointed','cast_out')),
  created_at timestamptz not null default now()
);
-- For databases created before birth details replaced star sign/element:
alter table applications add column if not exists date_of_birth date;
alter table applications add column if not exists time_of_birth time;

create table if not exists application_votes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  vote text not null check (vote in ('anoint','cast_out','abstain')),
  unique (application_id, member_id)
);

-- Ranking view: average score per wine, ranked within a gathering ----
create or replace view wine_rankings as
select
  w.id as wine_id,
  w.gathering_id,
  w.cloth_number,
  round(avg(s.score)::numeric, 1) as avg_score,
  count(s.id) as votes,
  rank() over (partition by w.gathering_id order by avg(s.score) desc) as rank
from wines w
left join scores s on s.wine_id = w.id
group by w.id;

-- Seed the Keiser (edit the email to yours) --------------------------
insert into members (email, cult_name, short_name, role, active)
values ('hkdeven@gmail.com', 'The Keiser', 'KE', 'keiser', true)
on conflict (email) do update set role = 'keiser';
