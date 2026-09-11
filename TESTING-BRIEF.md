# Testing brief · before Gathering XX

Written 11 September 2026 for a fresh session. The Council meets **next week**. The last
gathering was embarrassing: members could not claim their wines, and going back to the
scoring silently unsealed ballots. That must not repeat.

**Read this whole file first. Then verify, do not assume.**

---

## 1. The single most important fact

On **22 August** a deploy pushed **five weeks of work to production in one jump**.
Everything between 17 July and 22 August had been pushed to the wrong branch
(`claude/link-dominik-accounts-yd1557`) while Netlify watched `main`, so production sat
frozen at the 17 July build the whole time. The gathering that went badly ran on that
stale build.

**Consequence for testing:** the six fixes from the gathering are the newest and were
built carefully. The larger untested surface is everything that rode along with them and
has **never run in production even once**:

- the calendar summons (.ics on RSVP)
- the Prophecy's offerings gate
- the sleeping seal's client half (the vault half was live, run by hand)
- the case-blind login door
- the notes now attributed in the codex

Weight the testing accordingly. Do not assume "it was fixed" means "it has worked in prod".

**Current state:** `main` = `8ffef56`, prod serving it, confirmed 11 Sep.

---

## 2. The six bugs from the last gathering, each needing proof

Every one is a *fix to verify*, not a change to admire.

| # | The bug | What changed | How to prove it |
|---|---|---|---|
| 1 | Going back to scoring after sealing wiped/unsealed scores | A sealed ballot never draws the scoring card; only a read-only list. `setScore` wrote `sealed:false`, which dropped the reveal's count and **re-locked the night for the whole table** | Seal, return to `/rite`, confirm no orbs exist. Confirm in the DB that `ballots.sealed` stays `true` |
| 2 | Two buttons after sealing | One button, "Seal and continue", seals then routes to `/reveal` | Seal and confirm you land on the reveal with no second press |
| 3 | Aroma field confusing | Aroma pills + input removed. The notes textarea now sits under the **Aromas** title | Confirm one field only, and that the Nose still fills from notes |
| 4 | An aroma bled to the next wine | Cause: `newAroma` was ONE shared box, not per wine. Died with the input | Confirm nothing carries between wines |
| 5 | New-meeting date field blank/unexplained | Labelled "The night" ("The host" beside it). `type="date"` ignores `placeholder` | Confirm on a phone, not just desktop |
| 6 | **Members could not claim wines** ("new row violates row-level security policy for table annals") | Annals are Keiser-only to write, so claiming goes through `claim_bottle` (SECURITY DEFINER): one unowned row, for the caller, once per night | **THE CRITICAL ONE.** Must be proven by a REAL non-Keiser member in production |

---

## 3. What cannot be tested alone, and must be

The Keiser's own account passes tests that members fail. That is exactly how bug #6
survived to the gathering: the Keiser could claim, so it looked fine.

**Anything gated by role or RLS must be exercised by a genuine non-Keiser account.**
Ask a member, or use a second real account. In particular:

- claiming a bottle in the codex (bug #6)
- sealing a ballot and the reveal unlocking for everyone
- the tribunal's counsel vote (`cast_counsel`)
- adding a photo to a past night (`add_reveal_photo`)
- the per-member score/notes breakdown visibility

---

## 4. Tools that already exist, use them

- **`npx tsx scripts/verify-*.ts`**: ten suites, ~288 checks (annals, sleeping, ics,
  dossier, augury, kundli, gochara, vedic, natal-analysis, meeting-entry). Run all. Green
  is the floor, not the ceiling: they test pure logic, never RLS or the browser.
- **`/flow-prototype.html`** (live on prod): the whole flow, convene → rite → reveal,
  with the rest of the table on puppet strings. Exercises every gate solo. It mirrors the
  new behaviour but is a SIMULATION: it proves the design, never the real database.
- **The dev server:** `cd /Users/devenblackburn/Downloads/le-council && npx next dev -p 3005`.
  Demo mode (no login) never arms the sleeping seal or RLS, so live-only behaviour cannot
  be tested there.

---

## 5. Where bugs have actually clustered (test here hardest)

History, not guesswork. Every one of these produced a real failure:

1. **RLS vs a member's write.** The pattern that broke claiming: a table is Keiser-only,
   a member needs one narrow write. Fixed with SECURITY DEFINER doors (`claim_bottle`,
   `add_reveal_photo`, `cast_counsel`). **Audit for any remaining member-write that goes
   straight at a Keiser-only table.**
2. **Exact string matching.** A trailing space hid Lady Levine's coin/purse; a capital J
   locked James out for six weeks. Names and emails are compared in many places.
3. **Gates checked once, not continuously.** The Prophecy's offerings gate sat inside
   `if (!g.prophecy)`, so it was tested only before the first word.
4. **Optimistic UI that lies.** State set before the write lands, or `.catch(() => {})`
   swallowing a refusal, so the member believes something was recorded.
5. **Stale caches.** The member row is cached in localStorage; the write lock arms off it.

---

## 6. Environment traps that have cost real time

- **CHECK THE BRANCH BEFORE EVERY PUSH.** `git branch --show-current` must read `main`.
  `git rev-list HEAD..origin/main` returning 0 does NOT mean you are on main; it only
  means you are not behind it. This cost five weeks of undeployed work.
- **The shell's cwd resets** to `/Users/devenblackburn/Downloads/klein-welgeluk` between
  some calls. Always `cd /Users/devenblackburn/Downloads/le-council &&` first. Files have
  been written to the wrong repo this way.
- **Never `npx next build` while the dev server runs**: it corrupts `.next`. Stop the dev
  server, build, `rm -rf .next`, restart.
- **The anon key cannot read `members`, `annals`, `gatherings` or `ballots`** (RLS, by
  design). Probing them from a script returns `[]`, which looks exactly like "no data".
  That produced one wrong diagnosis. Use SQL in the Supabase editor for real reads.

---

## 7. Standing rules for the session

- **Never push unless the Keiser says "push" in that message.** It never carries over.
- **Bundle into few large pushes** (Netlify build cap), never per-feature.
- **No em/en dashes in user-facing copy.** Comma, colon or period. (The lone em-dash used as an
  empty-value placeholder, e.g. `{value || "..."}` in a table cell, is exempt.)
- **Every tooltip uses the shared `Tip` component**, never hand-rolled.
- **Update `MEMBER-RELEASE-NOTES.md`** (dated entry, member-facing voice, including the
  behind-the-curtain work) and the README with every batch, before pushing.
- **Readiness questions:** if ANY agreed item is unbuilt, answer "NO, we are not ready"
  first, then list what is outstanding.
- Lead answers with the decisive fact. He reads on mobile mid-task.

---

## 8. Suggested order of work

1. Run all ten verify suites. Fix anything red before touching the app.
2. Read the six fixes in the diff of `8ffef56` and confirm each does what it claims.
3. Drive the flow in a browser against the dev server: convene → rite → seal → reveal.
4. **Then the part that actually matters:** a live production run with a real member
   account, end to end, including claiming. Nothing else proves bug #6.
5. Hunt the clusters in §5, especially any remaining member-write against a Keiser-only
   table.
6. Report findings plainly, worst first, with what was proven versus assumed.

---

# Results · session of 11 September 2026

## What was proven

- **All ten verify suites green: 288/288**, before and after every change.
- **Production RPC probe (anon key, no writes):** `claim_bottle`, `reveal_summary` and
  `add_reveal_photo` all exist on prod and refuse a stranger with their own worded
  exceptions; `cast_counsel` refuses a non-full-member. Every table refuses the anon key.
  So bug #6's door **is deployed and is enforcing**.
- **No schema drift.** Column-by-column probe of all ten tables against `types.ts`:
  every column present. (Earlier "missing" readings in this session were wrong column
  guesses, not drift.)
- **Bug #2 (one button):** verified, "Seal and continue", seals then routes to /reveal.
- **Bug #3/#4 (aromas):** the pills and `newAroma` are gone from the codebase entirely;
  one notes field under an "Aromas" title; the Nose still mines notes (`dossier.ts`).
- **Bug #5 (date label):** verified on desktop AND at 375x812, "The night" / "The host".
- **Full flow end to end** on the dev server: summon, RSVP, score, seal, reveal, commit,
  claim, codex. Reveal math verified by hand on two separate nights. Zero console errors
  across all seven pages.

## Bug #1 was NOT fixed. It is now.

The August fix guarded the sealed ballot only **after it had loaded**. Every guard on the
rite was written `if (ready && ...)`, so while the page was still loading all of them were
false and the component **fell through to the live, writable scoring card**.

Reproduced deterministically (1500ms of simulated mobile latency on `fetchBallot`):

    before  sealed: true   scores: {1:7, 2:9, 3:4, 4:8, 5:6, 6:10}
    one tap, 700ms into the page load
    after   sealed: false  scores: {1:3}

That is the last gathering's failure exactly: the reckoning wiped, the seal broken, the
reveal's count dropped, the night re-locked for the whole table. On a phone on mobile data
the loading window is the entire time the member is looking at the screen.

After the fix, the same test leaves the ballot untouched, and 130 taps over two seconds
land on nothing.

## Also found and fixed

1. A verdict tapped before the gathering loaded was written against gathering `"none"`
   and silently dropped (`.catch(() => {})`); in live it is not even a uuid.
2. `claim_bottle` had **no row lock**, so simultaneous claims overwrote each other with
   both members told they had succeeded. Everyone claims at once when the cloths lift.
3. `annals` had **no permissive DELETE policy**: erasing a night matched zero rows for
   everyone including the Keiser, and PostgREST reports that as success.
4. `saveOffering`, `favourTheme`, `deleteApplicationsByEmail` ignored their `error`,
   making their callers' existing `.catch` alerts dead code.
5. `AuthProvider` ignored the members-fetch error and set `member` to null, so one dropped
   request showed a full member the "your petition awaits" screen and **cached that null**.
6. The Prophecy's dark button explained itself only through `title` (no hover on a phone)
   and hand-rolled rather than using the shared `Tip`.

A regression I introduced while fixing #1 (three taps in one tick collapsing to one
verdict, from dropping the functional state updater) was caught by the end-to-end rerun
and fixed with a synchronous ref. **Always re-run the burst-tap test after touching
`setScore`.**

## SQL that MUST be run before the deploy

See `TEST-LOG.md` under 2026-09-11: the `claim_bottle` rewrite (adds `for update`) and the
`annals keiser delete` policy, plus a two-line query that confirms both landed.

## Still unproven, and only a real member can prove it

**Claiming a bottle in production as a genuine non-Keiser account.** The door is deployed
and refuses strangers correctly, but the Keiser's own account passes this test whether or
not it works, which is exactly how it survived to the last gathering. Ask a member to sign
in and claim a bottle on a past night before the gathering.

Also unexercised here, for the same reason (demo mode never arms RLS or the sleeping seal):
the tribunal's counsel vote, adding a photo to a past night, and the per-member breakdown
visibility.

## Noted, not changed

- `pickCurrent` deliberately falls back to the most recent past night, so after a night is
  revealed the rite stays enterable on it. A member who sealed is safe (they get the
  read-only view); a member who never sealed can still seal late, which would alter the
  reveal within its 7-day window. Consider refusing the rite for a gathering whose status
  is `revealed`.
- `writeLock.ts`'s header comment still says a sleeping hand may write "no photos", which
  the decree and the code below it contradict. Cosmetic.

---

# Second pass, same day: tests that can actually fail

The Keiser did not trust the analysis, which was the right instinct. Green tests
prove nothing until they are shown going red.

**The two decisions behind the Council's two worst bugs are now pure functions**,
out of the components where nothing could be tested:

- `src/lib/riteScreen.ts` + `scripts/verify-rite-guard.ts` (21 checks) — exhaustive
  over **all 32 state combinations**, enforcing one rule: the writable scoring card
  is reachable ONLY when every state it depends on is genuinely known. Exactly one
  of the 32 states may write.
- `src/lib/memberLookup.ts` + `scripts/verify-member-lookup.ts` (33 checks) — the
  auth door. James's real stored address, leading/trailing space, SHOUTED storage,
  and the `_`/`%` cases where `ilike` matches a DIFFERENT member's row at the
  database and the code comparison must refuse it.

**Mutation testing: nine broken versions fed in, all nine caught.**

| Mutant | Result |
|---|---|
| The original August rite ladder (every guard `ready &&`, no ballot gate) | 12 failed |
| ballotReady gate removed | 6 failed |
| sealed check removed | 5 failed |
| clock check removed | 6 failed |
| The original exact-match lookup (the one that shut James out) | 7 failed |
| Trusts the ilike, takes the first row back | 15 failed |
| Lowercases but forgets to trim | 2 failed |
| Matches on substring instead of equality | 1 failed |
| Forgets the empty-address guard | 2 failed |

**Live mode exercised for the first time** (ENFORCE_LOGIN=true against the real
Supabase, then restored; `.env.local` verified byte-identical afterwards):

- anonymous `/convene` redirects to the gate: the login wall holds
- all three doors render: Google, email + password, magic link, plus Forgot password
- a real failed sign-in round-trips to Supabase and surfaces "Invalid login
  credentials" on the gate, no hang and no crash
- the new `.ilike` lookup was run against the production `members` table with
  `_` and `%` in the value: valid, clean, no error. That mattered, because a bad
  query shape there would lock out every member on the next deploy.

Twelve suites, **342 checks**, green.

## What this pass did NOT do

It did not overturn anything in the first pass; it turned those findings into
tests that provably catch the bugs. Two things remained unproven at this point.
**The first has since been closed (see below).**

1. ~~A real non-Keiser member claiming a bottle.~~ **CLOSED, on production, 11 Sep 2026.**
2. **What the members who struggled to sign in actually saw.** The spelling fault
   is now closed at both ends, but email delivery and Google redirect config are
   different causes with different fixes, and nothing here distinguishes them.
   The gate ledger on the profile page records every successful sign-in.

---

# Third pass: the untestable made testable

The Keiser's ruling: being unable to test a member's claim is unacceptable.
It was also the precise reason bug #6 reached a real gathering, so it was fixed
as a capability, not as a one-off.

## The problem, stated plainly

The anon key cannot read `members`, `annals`, `gatherings` or `ballots` at all,
and PostgREST cannot run SQL, so RLS-as-a-specific-member and every SECURITY
DEFINER door were beyond reach. The Keiser's own account passes those tests
whether or not they work. That is the whole trap.

## The answer: a local replica the real policies run inside

`./scripts/local-replica.sh` builds a throwaway Postgres database from the REAL
`supabase/schema.sql` and `supabase/policies.sql`, plus `supabase/probe/00-supabase-shim.sql`,
a faithful stand-in for the Supabase furniture the policies lean on: the
`authenticated` and `anon` roles, and `auth.jwt()` / `auth.uid()` defined exactly
as Supabase defines them, reading the `request.jwt.claims` GUC. 60 policies and
all 7 functions load; only the `storage.*` policies fail, and nothing under test
touches a bucket. Inside it, ANY member can be impersonated.

## `supabase/verify-claim.sql` — 13 checks, bug #6 finally proven

Builds a throwaway member and night, becomes that member, and asserts:

    PASS  the probe is seen as a member of the Council
    PASS  the probe is NOT the Keiser (this is the whole point)
    PASS  a member still cannot write the annals directly (42501, as on the night)
    PASS  *** A REAL NON-KEISER MEMBER CLAIMED THEIR BOTTLE (bug #6) ***
    PASS  and the bottle now carries their name: Probe the Waking
    PASS  exactly one bottle was touched, the others are untouched
    PASS  a second bottle is refused
    PASS  an already-claimed bottle is refused
    PASS  a sleeping hand is refused
    PASS  a stranger is refused
    PASS  a second member claimed a different bottle on the same night
    PASS  BOTH claims stand together (the first was not erased)
    PASS  claim_bottle holds the row lock (for update), so claims queue

**It cannot commit.** The whole run is one DO block that always ends by raising
an exception, which prints the report and rolls back everything it made. There
is no COMMIT in the file and no path that reaches one, so it is safe to run
against production, repeatedly. Residue after every run: zero rows.

## `./scripts/verify-claim-race.sh` — the lock, with two real connections

Two members claim at the same moment, which is how every claim actually happens.
Run against a deliberately unlocked copy of the function and then the real one:

    unlocked (the bug) : Racer Alpha | - | - | -             [1 of 2 survived]
    locked   (the fix) : Racer Alpha | Racer Beta | - | -     [2 of 2 survived]

Ten consecutive runs: the unlocked door lost a claim EVERY time, the locked door
kept both EVERY time. Which member loses varies with the scheduler, so the
assertion counts survivors rather than names (the first version of this test
asserted on a name and wrongly reported "the race did not reproduce").

**That script rewrites `claim_bottle` while it runs.** It therefore refuses any
argument that looks like a remote connection string, and restores the real
function from `policies.sql` on exit, verifying the restore before it returns.
An earlier version left its stripped test copy installed and silently
invalidated the next suite run, which is exactly the failure it now guards.

## Totals

12 JS suites, 342 checks. 2 SQL suites, 16 checks. **358 in all, green.**

## RUN AGAINST PRODUCTION, 11 September 2026: 13 passed, 0 failed

The Keiser ran `supabase/verify-claim.sql` in the Supabase SQL editor against
the live database. All thirteen checks passed, including the two that matter
most:

    PASS  a member still cannot write the annals directly (42501, as on the night)
    PASS  *** A REAL NON-KEISER MEMBER CLAIMED THEIR BOTTLE (bug #6) ***
    PASS  BOTH claims stand together (the first was not erased)
    PASS  claim_bottle holds the row lock (for update), so claims queue

**Bug #6 is closed, on production, proven rather than assumed.** The deployed
policies match `policies.sql`. The run rolled itself back as designed.

The sign-in question is still open and still needs the members' own accounts:
what they saw distinguishes a spelling fault (now closed at both ends) from
email delivery or Google redirect config, which are different fixes.
