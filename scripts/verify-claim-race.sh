#!/usr/bin/env bash
# Two members claiming at the SAME MOMENT, which is how every claim actually
# happens: the cloths lift and the whole table reaches for their phone.
#
#   ./scripts/local-replica.sh && ./scripts/verify-claim-race.sh
#
# `rows` is one jsonb column, so a claim is a read-modify-write. Without a row
# lock both claims read the same array, each writes its own copy back, and the
# second silently erases the first. BOTH members are told they succeeded.
#
# This runs the claim twice, once against a deliberately unlocked copy of the
# function and once against the real one, with a one-second pause between the
# read and the write in BOTH so the window is visible rather than left to luck.
# The pause changes no logic; it only makes the scheduler's timing repeatable.
#
# Expected: unlocked loses a claim, locked keeps both. Exits non-zero otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${1:-lcv_probe}"

# THIS SCRIPT REPLACES claim_bottle WHILE IT RUNS. Pointed at the live database
# it would swap the Council's real door for a stripped test copy. It therefore
# refuses anything that is not a plain local database name, and restores the
# real function from policies.sql before it exits, whatever happens.
case "$DB" in
  *://*|*@*|*.*|*" "*)
    echo "REFUSED: '$DB' looks like a remote connection string." >&2
    echo "This script rewrites claim_bottle and may only touch a local replica" >&2
    echo "built by ./scripts/local-replica.sh (default name: lcv_probe)." >&2
    exit 2;;
esac
psql -d "$DB" -tAc "select 1" >/dev/null 2>&1 || { echo "No local database '$DB'. Run ./scripts/local-replica.sh first." >&2; exit 2; }

T="$(mktemp -d)"

# The real door, lifted straight out of policies.sql so the restore can never
# drift from the source of truth.
awk '/^create or replace function claim_bottle/,/^grant execute on function claim_bottle/' supabase/policies.sql > "$T/restore.sql"
[ -s "$T/restore.sql" ] || { echo "Could not find claim_bottle in supabase/policies.sql; refusing to run." >&2; exit 2; }

restore () { psql -d "$DB" -q -f "$T/restore.sql" >/dev/null 2>&1 || true; rm -rf "$T"; }
trap restore EXIT

cat > "$T/setup.sql" <<'SQL'
delete from annals where number = 424242;
delete from gatherings where number = 424242;
delete from members where email like 'race-%@example.invalid';
insert into members (id,email,cult_name,short_name,role,active) values
 (gen_random_uuid(),'race-a@example.invalid','Racer Alpha','A','member',true),
 (gen_random_uuid(),'race-b@example.invalid','Racer Beta','B','member',true);
with g as (
  insert into gatherings (id,number,theme_title,gather_date,status,wine_count)
  values (gen_random_uuid(),424242,'Race night',current_date,'revealed',4) returning id)
insert into annals (gathering_id,number,theme,date,rows,committed_at)
select id,424242,'Race night',current_date,
 '[{"cloth":1,"owner":""},{"cloth":2,"owner":""},{"cloth":3,"owner":""},{"cloth":4,"owner":""}]'::jsonb,
 now() from g;
SQL

cat > "$T/claim-as.sql" <<'SQL'
begin;
select set_config('request.jwt.claims', json_build_object('email', :'who', 'sub', gen_random_uuid()::text, 'role','authenticated')::text, true);
set local role authenticated;
select claim_bottle((select id from gatherings where number=424242), :idx);
commit;
SQL

fn () { # $1 = "" (unlocked) or "for update" (locked)
cat <<SQL
create or replace function claim_bottle(gid uuid, row_index int) returns void
  language plpgsql security definer set search_path = public as \$\$
declare me text; rows_json jsonb;
begin
  select cult_name into me from members where lower(email)=lower(auth.jwt()->>'email') and active;
  if me is null then raise exception 'Only a waking member of the Council may claim a bottle.'; end if;
  select rows into rows_json from annals where gathering_id = gid $1;
  perform pg_sleep(1);
  if coalesce(rows_json -> row_index ->> 'owner','') <> '' then raise exception 'That bottle is already claimed.'; end if;
  update annals set rows = jsonb_set(rows_json, array[row_index::text,'owner'], to_jsonb(me)) where gathering_id = gid;
end \$\$;
SQL
}

race () {
  psql -d "$DB" -q -f "$T/setup.sql"
  psql -d "$DB" -q -o /dev/null -v who=race-a@example.invalid -v idx=0 -f "$T/claim-as.sql" &
  psql -d "$DB" -q -o /dev/null -v who=race-b@example.invalid -v idx=1 -f "$T/claim-as.sql" &
  wait
  psql -d "$DB" -tAc "select string_agg(coalesce(nullif(e->>'owner',''),'-'), ' | ' order by (e->>'cloth')::int) from annals, jsonb_array_elements(rows) e where number=424242;"
}

# Which claim is the one lost is down to the scheduler and changes run to run.
# What never changes is HOW MANY survive, so that is what is asserted.
survivors () { psql -d "$DB" -tAc "select count(*) from annals, jsonb_array_elements(rows) e where number=424242 and coalesce(e->>'owner','') <> '';"; }

fail=0
fn ""            | psql -d "$DB" -q; UNLOCKED="$(race)"; N_UNLOCKED="$(survivors)"
fn "for update"  | psql -d "$DB" -q; LOCKED="$(race)";   N_LOCKED="$(survivors)"
psql -d "$DB" -q -c "delete from annals where number=424242;" -c "delete from gatherings where number=424242;" -c "delete from members where email like 'race-%@example.invalid';"

echo "unlocked (the bug) : $UNLOCKED   [$N_UNLOCKED of 2 claims survived]"
echo "locked   (the fix) : $LOCKED   [$N_LOCKED of 2 claims survived]"
echo

if [ "$N_UNLOCKED" -eq 1 ]; then
  echo "PASS  the unlocked door LOST a claim, and told that member they had succeeded"
else
  echo "FAIL  the unlocked door kept $N_UNLOCKED claims: the race did not reproduce, so this run proves nothing"
  fail=1
fi

if [ "$N_LOCKED" -eq 2 ]; then
  echo "PASS  the locked door kept BOTH claims"
else
  echo "FAIL  the locked door kept only $N_LOCKED of 2 claims"
  fail=1
fi

# The real claim_bottle goes back before anything else runs against this
# replica. Leaving the test copy in place silently invalidated a later suite.
restore
trap - EXIT
if psql -d "$DB" -tAc "select pg_get_functiondef(oid) from pg_proc where proname='claim_bottle'" | grep -q "already claimed a bottle that night"; then
  echo "PASS  the real claim_bottle is restored in '$DB'"
else
  echo "FAIL  the real claim_bottle was NOT restored in '$DB'; rebuild with ./scripts/local-replica.sh"
  fail=1
fi
exit $fail
