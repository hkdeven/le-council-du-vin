# Le Council — Test Log

Changes I've made that **you have not yet confirmed in production.** I demo-test each before saying "done"; you verify on the live site and check it off. Newest at top.

- `demo ✓` = I tested it in the local demo.
- `live [ ]` = awaiting your check on lecouncilduvin.co.za.

---

## 2026-07-07 — clickable member cards (tarot stats card) — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Member avatars open a tarot-style stats card | Click any member's circle-icon (Convene "who answers"/"RSVP on their behalf", Oracle poll voters + hosting wheel, Profile roster) → card opens | ✓ | [ ] |
| 2 | Card shows avatar, name, role, then birth-derived fields (element, sun, moon, ascendant, shengxiao, wu xing) with tooltips — NOT the DOB/TOB | Open a member with a birthday (e.g. The Keiser) → all six fields + info tooltips, no dates shown | ✓ | [ ] |
| 3 | "Chalice count" = one gold chalice per codex win | Member with N codex victories shows N chalices; none → "No moons yet crowned" | ✓ | [ ] |
| 4 | Member with no birthday → "stars unrecorded" | Open a member with no DOB set | ✓ | [ ] |
| 5 | Card animates open + closed (fade + zoom, ~0.26s) | Click an avatar → card fades/zooms in; close (X, backdrop, or Esc) → fades/zooms out | ✓ | [ ] |

_Wired in: Convene (RSVP list + behalf list), Oracle (voters + hosting wheel), Profile roster. Not on the header chip (that stays a link to your own editable profile) or the reveal (owners shown by name, not avatar)._

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

## Known gaps (not yet built/fixed)

- Champion wine has no disqualify control on the reveal.
- Email: reliable auth-email SMTP + Keiser petition-notification email.
- Blind-tasting privacy: ballots/offerings API-readable before reveal.

---

## Verified & closed

_(move rows here as you confirm them)_
