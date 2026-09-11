#!/usr/bin/env bash
# Run a .sql file against the live database with psql.
#
#   ./scripts/run-sql.sh supabase/verify-claim.sql
#
# Reads SUPABASE_DB_URL from .env.local (gitignored). That connection string is
# the ONLY way to prove the things PostgREST cannot reach: RLS as a specific
# member, SECURITY DEFINER doors, and policies themselves. The anon key returns
# an empty list for every one of those, which looks exactly like "no data" and
# has already produced one wrong diagnosis.
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?usage: ./scripts/run-sql.sh <file.sql>}"
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }

if [ -f .env.local ]; then
  URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | head -1 | cut -d= -f2- || true)"
fi
URL="${URL:-${SUPABASE_DB_URL:-}}"

if [ -z "$URL" ]; then
  cat >&2 <<'MSG'
SUPABASE_DB_URL is not set.

Add one line to .env.local (it is gitignored and never leaves this machine):

  SUPABASE_DB_URL=postgresql://postgres.pdxdllxyvejtchbzybfa:YOUR_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

Get the exact string (region and host included) from:
  https://supabase.com/dashboard/project/pdxdllxyvejtchbzybfa/settings/database
MSG
  exit 1
fi

exec psql "$URL" -v ON_ERROR_STOP=0 -f "$FILE"
