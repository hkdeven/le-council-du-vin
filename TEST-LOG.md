# Le Council — Test Log

Changes I've made that **you have not yet confirmed in production.** I demo-test each before saying "done"; you verify on the live site and check it off. Newest at top.

- `demo ✓` = I tested it in the local demo.
- `live [ ]` = awaiting your check on lecouncilduvin.co.za.

---

## 2026-07-07 — Keiser petition-notification email — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | New petition emails the Keiser (via Resend) | After Resend env vars are set, submit a petition → the Keiser gets an email linking to the Tribunal | route ✓ (no-ops w/o key) | [ ] |

_Needs env in Netlify: `RESEND_API_KEY`, `NOTIFY_EMAIL` (Keiser's address), optional `NOTIFY_FROM` (verified sender). Ships safely without them (route returns "not configured"). Separate: auth-email reliability = custom SMTP in Supabase → Auth (dashboard config, no code)._

---

## 2026-07-07 — champion disqualify + "Gatherings to come" font — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Keiser can disqualify the champion wine | On the reveal, the top wine now has a "disqualify" control; using it promotes the next wine. Disqualifying all → "No champion this moon" (no crash) | ✓ | [ ] |
| 2 | "Gatherings to come" title 9px → 14px | On Convene (with a future meeting), the section title is larger | ✓ | [ ] |

---

## 2026-07-07 — tie handling: shared rank + co-champions — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Tied scores share a rank (competition style: 1,1,3,3) | Two wines with the same average show the same rank number; the skipped rank is omitted | ✓ | [ ] |
| 2 | Tie for 1st → co-champions shown together | Reveal flip card shows "Champions of the moon · tied" with each top-score bottle stacked | ✓ | [ ] |
| 3 | Annals record all co-champions as rank 1 | Committed annal has multiple rank-1 rows on a tie | ✓ | [ ] |
| 4 | Codex counts every co-champion | Victories-by-member counts each co-champion; annal card lists "crowned: A & B"; each gets a chalice in their card | ✓ | [ ] |
| 5 | Single-champion case unchanged | One clear winner → "Champion of the moon" (singular), sequential ranks | ✓ | [ ] |

---

## 2026-07-07 — tribunal orphan cleanup + rite opens 30min after start — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Deleted member's anointed record hidden from Tribunal | Cast a member out → their old "anointed" row disappears from the decided list (cast-out records + existing members still show) | ✓ | [ ] |
| 2 | "Enter the rite" only appears 30 min after the scheduled start | On Convene, the button is hidden until (meeting time + 30 min); before that it's absent | ✓ | [ ] |
| 3 | Rite tab itself blocked until 30 min after start | Go to /rite before the window → "The rite is not yet open" + the exact open time; after → scoring UI | ✓ | [ ] |
| 4 | Button/gate appear automatically — NO refresh needed | Sit on Convene (or /rite) before the open time; when it hits, the button/scoring appears on its own | ✓ (button appeared ~on time during a no-reload poll) | [ ] |

---

## 2026-07-07 — clickable member cards (tarot stats card) — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Member avatars open a tarot-style stats card | Click any member's circle-icon (Convene "who answers"/"RSVP on their behalf", Oracle poll voters + hosting wheel, Profile roster) → card opens | ✓ | [ ] |
| 2 | Card shows avatar, name, role, then birth-derived fields (element, sun, moon, ascendant, shengxiao, wu xing) with tooltips — NOT the DOB/TOB | Open a member with a birthday (e.g. The Keiser) → all six fields + info tooltips, no dates shown | ✓ | [ ] |
| 3 | "Chalice count" = one gold chalice per codex win | Member with N codex victories shows N chalices; none → "No moons yet crowned" | ✓ | [ ] |
| 4 | Member with no birthday → "stars unrecorded" | Open a member with no DOB set | ✓ | [ ] |
| 5 | Card animates open + closed (fade + zoom, ~0.26s) | Click an avatar → card fades/zooms in; close (X, backdrop, or Esc) → fades/zooms out | ✓ | [ ] |

| 6 | Clickable in ALL member spots incl. Tribunal | Tribunal petition cards, decided list, AND expulsion hearings all open cards; petitioner card shows their birth chart (from the petition), no role tag | ✓ | [ ] |

_Wired in: Convene (RSVP list + behalf list), Oracle (poll voters + hosting wheel), Profile roster, Tribunal (petitions + decided + expulsion). Not on the header chip (link to your own editable profile), the profile "change portrait" avatar (edit button), or the reveal (owners shown by name, not avatar)._

---

## 2026-07-07 — 6 bottles / petition badge / tribunal cleanup / meeting edit — commit 5f6def2

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Default bottle count = 6 | Summon a new meeting → "Vessels" reads 6 | ✓ | [ ] |
| 2 | Petition badge on Tribunal tab (Keiser) | Someone petitions → red count on Tribunal nav; clears after you anoint/cast out | ✓ | [ ] |
| 3 | Cast-out member leaves the Tribunal list | Anoint someone, then cast them out from Profile roster → gone from Tribunal | ✓ | [ ] |
| 4 | Meeting-card edit via top pencil | Convene → pencil at top of card → observances, decree, venue all editable together; Done saves | ✓ | [ ] |

---

## Earlier — pushed, still unverified live

| Change | Demo | Live |
|--------|------|------|
| Live data wiring: ballots/scoring, offerings, annals/codex, oracle polls+themes | ✓ | [ ] |
| Reveal auto-unlocks by polling for sealed ballots | ✓ | [ ] |
| Reveal locked until every attendee has sealed | ✓ | [ ] |
| Current meeting = soonest upcoming (not oldest) | ✓ | [ ] |
| Header avatar refreshes after profile save | ✓ | [ ] |
| RSVP + poll votes: refetch-before-write (no clobber) | ✓ | [ ] |
| Reveal photos → Supabase Storage (needs bucket) | ✓ | [ ] |
| Wine count sourced from the gathering | ✓ | [ ] |
| Profile save persists to Supabase (live) | ✓ | [ ] |
| Petition → anoint → elevate onboarding | ✓ | partial (test acct) |

---

## To re-check on next deploy (deferred)

- **Birth date/time fields on prod** — user reports they still don't render correctly on production, but the current code renders fine in local testing (grid `1fr 1fr`, equal widths, 12px gap, `color-scheme: dark`, font 14px). Likely a stale browser cache OR a failed/older Netlify deploy. On next deploy: hard-refresh (Cmd+Shift+R), confirm deploy Published at latest commit, then screenshot if still wrong (note browser + device + which page).

## Known gaps (not yet built/fixed)

- Champion wine has no disqualify control on the reveal.
- Email: reliable auth-email SMTP + Keiser petition-notification email.
- Blind-tasting privacy: ballots/offerings API-readable before reveal.

---

## Verified & closed

_(move rows here as you confirm them)_
