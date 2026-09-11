#!/usr/bin/env bash
# Build a throwaway local replica of the live database: the real schema.sql,
# the real policies.sql, and a faithful stand-in for the Supabase furniture the
# policies lean on (the authenticated/anon roles and auth.jwt()/auth.uid(),
# defined exactly as Supabase defines them, reading request.jwt.claims).
#
#   ./scripts/local-replica.sh
#
# WHY THIS EXISTS: the anon key cannot read members, annals, gatherings or
# ballots, and PostgREST cannot run SQL at all, so RLS-as-a-specific-member and
# the SECURITY DEFINER doors were untestable. That is how bug #6 reached a real
# gathering: the Keiser's own account passes those tests whether or not they
# work. Against this replica any member can be impersonated safely.
#
# Needs a local PostgreSQL (brew services start postgresql@16). Touches nothing
# remote. The storage.* policies are expected to fail here: there is no storage
# schema locally, and nothing under test depends on one.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${1:-lcv_probe}"

psql -d postgres -q -c "drop database if exists $DB;" -c "create database $DB;"
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/probe/00-supabase-shim.sql
psql -d "$DB" -q -v ON_ERROR_STOP=0 -f supabase/schema.sql 2>&1 | grep -iE "^psql.*ERROR" || true
psql -d "$DB" -q -v ON_ERROR_STOP=0 -f supabase/policies.sql 2>&1 \
  | grep -iE "^psql.*ERROR" | grep -v "storage" || true
psql -d "$DB" -q \
  -c "grant select, insert, update, delete on all tables in schema public to authenticated, anon;" \
  -c "grant usage, select on all sequences in schema public to authenticated;"

echo "replica '$DB' ready: $(psql -d "$DB" -tAc "select count(*) from pg_policies where schemaname='public';") policies, $(psql -d "$DB" -tAc "select count(*) from information_schema.tables where table_schema='public';") tables"
