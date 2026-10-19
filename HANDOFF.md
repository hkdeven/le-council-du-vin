# Handoff

Read this first. It is the live state of the work, kept in the repo on purpose
so that any session, on any machine or account, can pick it up. The deep
detail lives in `README.md` (technical) and `MEMBER-RELEASE-NOTES.md` (what
the members were told, dated). This file is only: where things stand, what is
not proven, and the rules that are not written in the code.

Last updated: **19 October 2026**.

---

## 1. The one thing to fix before building anything else

**This repo cannot currently be run as a signed-in member on a developer
machine, and that is where the defects come from.**

On 18 and 19 October a run of faults reached production: a scan button that
could never render, a binding silently destroyed by the codex editor, bound
bottles not sharing a score. Every one was in the **wiring**, not the logic.
All 340-odd checks passed through every one of them, because they test pure
functions.

Why it happens:

| | |
|---|---|
| Production | `NEXT_PUBLIC_ENFORCE_LOGIN=true`, real Supabase, real keys |
| This machine | demo mode, no `SUPABASE_SERVICE_ROLE_KEY`, no `ANTHROPIC_API_KEY` |
| What demo mode bypasses | RLS, SECURITY DEFINER RPCs, member-session API routes, availability probes |

So "verified" has meant typecheck + unit tests + a demo-mode screenshot, which
cannot catch a wrong URL, a missing field in another page's editor, or a
policy that refuses.

**The fix, in order of value:**

1. Put `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` and a usable member
   session into `.env.local`, so the real app runs locally as a real member.
2. Add integration checks that call the API routes with a real session, so it
   stays fixed.
3. Until then, state explicitly which parts could not be exercised, every
   time. Never call a wiring change verified on demo-mode evidence.

**Live probes that need no login**, useful meanwhile:

```bash
# what is ACTUALLY deployed: fetch the route's bundle and grep it
curl -s https://lecouncilduvin.co.za/convene -o /tmp/p.html
grep -o '/_next/static/chunks/app/convene/page-[^"]*\.js' /tmp/p.html
curl -s "https://lecouncilduvin.co.za/_next/static/chunks/app/convene/page-XXXX.js" | grep -c "Scan the label"

# read-only SQL against production (SUPABASE_DB_URL is in .env.local)
./scripts/run-sql.sh some-query.sql

# an RPC exactly as the browser calls it
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/sealed_offering_members" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" -d '{"gid":"<gathering uuid>"}'
```

---

## 2. Not proven

- **A successful label scan has never been observed.** Only its failure paths
  (unreadable photo, oversized, wrong type, bad token) have been exercised.
  The Anthropic key is on Netlify, not here. The first real test is a member
  photographing a bottle.
- **The Keiser's "Send reminder to log wine (n)" button has not been seen on
  production.** Everything checkable says it should render: the string is in
  the live bundle, the RPC answers, and the current gathering has one awake
  RSVP with no wine logged. It is either easy to miss at the foot of the
  gathering card, or a cached page. It now prints "Nothing to remind" or "The
  offerings could not be counted" instead of vanishing, so its absence is
  diagnosable.
- **The Prophecy's new path** (server route + `sealed_offering_members`) has
  not run on a real gathering yet.

---

## 2a. Known bugs, reported from production and not yet fixed

Both found on an iPhone, in Chrome, on 19 October, during the first real use
of the label scan.

### The scan gives no sign of life, and does not hold the page

The button's label changes to "Reading the label…" and that is all. The icon
swapped to `ti ti-loader-2`, **which does not spin**: Tabler ships the glyph,
the rotation has to be a CSS animation and there is none. So a lookup that
takes several seconds, longer on a weak signal, looks like nothing happening.
Worse, the rest of the page stays live, so a member can wander off mid-read
and come back to a form that has quietly filled itself in, or navigate away
and lose the scan entirely.

What it needs: a genuinely animating indicator, and the page held while the
read is in flight (the same backdrop treatment as `TwinPopup` in
`src/components/WineWarning.tsx`, with a cancel). Both forms carry the
button: `src/app/offering/page.tsx` and the Convene offering form in
`src/app/convene/page.tsx`.

### The browser was evicted when the read finished

On the first real scan, Chrome on iPhone **backgrounded itself** as the read
completed and had to be reopened.

Most likely cause, to be confirmed rather than assumed: memory. `shrink()` in
`src/lib/photoShrink.ts` decodes the photograph at **full resolution** before
drawing it into the smaller canvas. A 12-megapixel iPhone photo is roughly
48 MB as raw pixels, and the original file, the decoded bitmap, the canvas
and the base64 string can be alive at the same moment. iOS reclaims tabs hard
when a page spikes, and the symptom (the tab dying exactly as the work
finished) fits.

Worth trying, in order:

1. Decode straight to the target size: `createImageBitmap(file, {
   resizeWidth, resizeHeight, resizeQuality: "high" })`, so the full-size
   bitmap never exists. Check Safari support and keep the current path as a
   fallback.
2. Release eagerly: `bitmap.close()` before `toDataURL`, drop the canvas by
   setting `width = height = 0`, and let the data URL go out of scope as soon
   as the request is sent.
3. Lower `MAX_EDGE` (1568 today) and measure. The label only has to be
   legible.
4. Send the photograph as a `Blob` through `FormData` rather than base64 in
   JSON, which removes the one-third inflation and the large string entirely.

Note this cannot be reproduced on a desktop browser, and it is exactly the
kind of fault the testing gap in section 1 leaves to the members to find.

## 3. Applied to production by hand

SQL already run in the Supabase editor (project `pdxdllxyvejtchbzybfa`). All of
it is also in `supabase/policies.sql`.

- `offering_links` table (RLS on, **no policies**, service role only): the
  one-tap links in the summons.
- `cloths_lifted(gid)`, the rewritten `offerings read` policy, and
  `sealed_offering_members(gid)`: the offering secrecy fix.

Environment variables set on Netlify: `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY` (Functions + Runtime scopes, marked secret).

---

## 4. Standing rules

These are the Keiser's, and they are not discoverable from the code.

- **Never `git push` unless the current message says so.** It never carries
  over from a previous message.
- **Check `git branch --show-current` reads `main` before every push.** Five
  weeks of work once went to a side branch because `git rev-list --count
  HEAD..origin/main` returning 0 was misread as "on main". It means "not
  behind", not "on".
- **Netlify has a build cap**: bundle work into few large pushes, never one
  per feature.
- **No em or en dashes in user-facing copy.** Comma, colon or period. The lone
  em-dash glyph used for an empty value is exempt. A hook flags them.
- **Every tooltip uses the shared `Tip` component** (`src/components/Tip.tsx`).
- **Update `MEMBER-RELEASE-NOTES.md` and `README.md` with every batch, before
  pushing.** The member notes are dated, written in the members' voice, and
  include the work done behind the curtain.
- **No astrology API.** Every chart, transit and dasha is computed in-house.
  That is the doctrine and it is stated in the emails.
- **Build procedure** (a dev server and a production build corrupt each
  other's `.next`):
  ```bash
  pkill -f "next dev" && rm -rf .next && npx next build && rm -rf .next
  npx next dev -p 3005        # restart afterwards
  ```
- **Gate every push on the real exit code** of `npm test`, `npx tsc --noEmit`
  and the build, not on reading their output.
- Parked by decree, do not re-pitch: honours badges, The Tome, Council
  Wrapped, Resend SMTP, multi-zodiac.

---

## 5. Where the reasoning lives

- `README.md`: the technical record. Every feature has a paragraph saying
  what broke, why, and which suite guards it. Newest entries at the end.
- `MEMBER-RELEASE-NOTES.md`: dated, member-facing, newest first.
- `src/lib/tally.ts`: binding and spoiling. The arithmetic of a night.
- `src/lib/annals.ts`: `championsOf()` is the single source of truth for who
  won a night. Every surface that counts victories must go through it.
- `supabase/policies.sql`: every policy, with the incident that caused it
  written above it.
- `scripts/verify-*.ts`: eleven suites in `npm test`. House style: plain
  `check(label, boolean)`, a count at the end, exit 1 on failure.
- `supabase/verify-*.sql`: RLS proofs. They run against
  `./scripts/local-replica.sh` (a throwaway Postgres built from the real
  schema and policies) so a genuine non-Keiser member can be impersonated.
  Each is one `DO` block that always ends by raising, so it rolls itself back
  and is safe against production.

**Mutation-test every security suite.** Run it against the old, broken rule
and confirm it fails. A policy test that has never failed has proved nothing.
