# Le Council — Test Log

## 2026-07-08 — THE ASTRAL BUILD (Dossier, co-hosts, natal chart, Foretelling) — NOT yet committed

**New SQL required on the live DB BEFORE this deploys:**

```sql
alter table gatherings add column if not exists host2_id uuid;
alter table gatherings add column if not exists host2_name text;
alter table ballots add column if not exists aromas jsonb not null default '{}'::jsonb;
insert into storage.buckets (id, name, public) values ('charts', 'charts', true) on conflict (id) do nothing;
drop policy if exists "charts insert" on storage.objects;
create policy "charts insert" on storage.objects for insert to authenticated with check (bucket_id = 'charts');
drop policy if exists "charts read" on storage.objects;
create policy "charts read" on storage.objects for select using (bucket_id = 'charts');
```

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | **Palate Dossier** on every member card: moons stood, bottles crowned, marks (of 5, wine-red), palate temper (+tooltips), kindred palate, the wheel, longest communion, the **Nose** aroma cloud, **Their Finest Pours** | Open any member's card; stats derive from real ballots/annals; empty states whisper until data exists | ✓ (engine unit-tested; empty states) | [ ] |
| 2 | **Aromas now persist** with the ballot (fills the Nose from the next rite onward) | Mark aromas in a rite, reload, they're restored; they appear on your card's Nose after sealing | ✓ | [ ] |
| 3 | **Chalice band** relocated per approved design (thick gold rules, after Finest Pours, above the buttons) | Any member card | ✓ | [ ] |
| 4 | **"Behold the natal chart"** on every card + profile: the wheel (all 10 planets, verified <1° vs documented positions), whole-sign houses, tap-a-row placement meanings, methodology note | Open a card of a member with time+place; rows expand | ✓ | [ ] |
| 5 | **"The Foretelling"** on every card + profile: real transits for the lunar cycle (verified against the actual 2026 sky), new/full moons in their houses, Mercury retrograde with true dates, year view (personal year, Chinese year, house ingresses) | Open it for a member with time+place; This moon / The year pills | ✓ (matches documented 2026 events) | [ ] |
| 6 | **The sky is veiled** gate when time/place of birth missing (both views), listing only the missing points + Complete-the-record link | Open chart/foretelling for a member without birth data | ✓ | [ ] |
| 7 | **Co-hosts**: optional second host on summon + edit pencil; shown "A & B"; WhatsApp share; both credited on the hosting wheel and the dossier wheel | Summon/edit a gathering with a co-host | ✓ | [ ] |
| 8 | **Profile → Your sky**: chart + Foretelling buttons with **envelope icons** that email each to your own inbox (branded; wheel travels as a snapshot to the `charts` bucket). Send route allows self-address only | Tap an envelope; check your inbox | route-gated ✓ | [ ] |

---

Changes I've made that **you have not yet confirmed in production.** I demo-test each before saying "done"; you verify on the live site and check it off. Newest at top.

- `demo ✓` = I tested it in the local demo.
- `live [ ]` = awaiting your check on lecouncilduvin.co.za.

---

## 2026-07-07 — exact natal engine + new card fields — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Sun sign computed from true solar longitude (no more cusp-day drift); element follows | A cusp birthday (e.g. 20 March) resolves to the correct side for its year | ✓ (equinox both sides) | [ ] |
| 2 | Moon sign + all times timezone-aware (local birth time converted to UT via IANA tz, default Africa/Johannesburg) | Chart unchanged for mid-sign births; boundary births may correct | ✓ | [ ] |
| 3 | Ascendant: real sidereal-time formula from time + place; folk approximation deleted | Needs time AND place; shows "unknown hour"/"unknown place" hints otherwise. Larissa should re-check her AM/PM then confirm Scorpio rising | ✓ (Einstein reference = Cancer) | [ ] |
| 4 | Profile + petition: Timezone of birth select (default SA) + **Place of Birth** with "Mark it" geocoding (Open-Meteo, no key); coords/tz stored invisibly | Type a town → pick the match → "The atlas knows it", ascendant appears | ✓ (Vryburg end-to-end) | [ ] |
| 5 | Member card: Moon phase at birth under the name (tooltip "Moon phase at birth") | Any member with a DOB | ✓ (Waning Crescent for Keiser) | [ ] |
| 6 | Member card: Day-master, Life path, Venus sign, Birth arcana rows, each with label + value tooltips | Open any member card with a DOB | ✓ (all rows + 16 tooltips) | [ ] |
| 7 | Chinese zodiac (Shengxiao/Wu Xing) already exact via CNY table (earlier fix); Matthew should now read Monkey | Check Matthew's card after deploy | ✓ | [ ] |

| 8 | Tooltips never bleed off-screen (card + profile): labels anchor left, values right, all self-clamp into the viewport | On a phone, open any ⓘ near either screen edge; the bubble stays fully visible | ✓ (375px + 320px) | [ ] |
| 9 | Approved astral mockup live for member proofing at `/member-card-mockup.html` (sample data, clearly labelled) | Open the URL, circulate to members | ✓ | [ ] |
| 10 | Natal chart + Foretelling email templates ready (previews `7-natal-chart.html`, `8-foretelling.html`, incl. wheel image) — templates only, no send trigger yet | n/a until the astral build | ✓ | n/a |

_Requires SQL on live DB before deploy (SQL below — **user confirmed run 2026-07-07**). Anointing carries birth place from petition → member._

```sql
alter table members add column if not exists birth_place text;
alter table members add column if not exists birth_lat double precision;
alter table members add column if not exists birth_lon double precision;
alter table members add column if not exists birth_tz text;
alter table applications add column if not exists birth_place text;
alter table applications add column if not exists birth_lat double precision;
alter table applications add column if not exists birth_lon double precision;
alter table applications add column if not exists birth_tz text;
alter table applications add column if not exists anointed_at timestamptz;
```

---

## 2026-07-07 — DOB/time-of-birth collision fix — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Birth date + time fields stack on mobile, pair on wider screens | On a phone, the petition (and Profile edit) show Date of birth and Time of birth on separate full-width rows, no overlap; on desktop they sit side by side | ✓ (375px stacked, desktop paired) | [ ] |

_Root cause: native iOS date/time inputs keep a minimum intrinsic width that `min-width:0` can't shrink, so the forced `1fr 1fr` grid overflowed on phones. Now mobile-first: single column, `1fr 1fr` only at >=480px. Affects `.birth-fields` (initiation + profile)._

---

## 2026-07-07 — branded transactional emails (Resend) — pushed 9febf78

Templates + previews at `public/email-previews/*.html` (view live at `/email-previews/1-anoint.html` etc.). All branded, mobile-first (`src/lib/emailTemplates.ts`).

| # | Email | Trigger | Demo | Live |
|---|-------|---------|------|------|
| 1 | Petition **anointed** → initiate | Auto, when Keiser anoints in Tribunal | route ✓ (no-ops w/o key) | [ ] |
| 2 | **Elevated** to member | Auto, when Keiser sets initiate→member in roster | route ✓ | [ ] |
| 3 | **Invite** (new gathering) → members | **Manual** — Profile → Heralds → "Summon the Council"; recipients editable (add/delete) | UI ✓, send ✓ | [ ] |
| 4 | **Summons** before the Tribunal | **Manual** — Profile → Heralds → pick a summoned member; recipients editable | UI ✓, send ✓ | [ ] |
| 5 | **Magic link** (branded) | Supabase auth (paste `5-magiclink-for-supabase.html` into Supabase template) | preview ✓ | [ ] |

_Send endpoint `/api/send-email` is Keiser-gated (verifies the Supabase token). Needs Netlify env: `RESEND_API_KEY`, `NOTIFY_FROM` (verified sender), plus `NOTIFY_EMAIL` for petition alerts. Domain must be verified in Resend. All no-op safely until configured._

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

- ~~Birth date/time fields collide on prod~~ — RESOLVED (see top entry): the forced side-by-side grid overflowed on iOS; now stacked on mobile. Awaiting live check after deploy.

## Known gaps (not yet built/fixed)

- Champion wine has no disqualify control on the reveal.
- Email: reliable auth-email SMTP + Keiser petition-notification email.
- Blind-tasting privacy: ballots/offerings API-readable before reveal.

---

## Verified & closed

_(move rows here as you confirm them)_
