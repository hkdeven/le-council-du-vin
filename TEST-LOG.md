# Le Council — Test Log

## 2026-07-08 (late) — speed batch: caches, portrait storage, loading states, UX fixes — pushed 68b6455

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | "Consulting the register" no longer blocks every refresh: the member row is cached locally (lcv_member_cache) and painted instantly, while the fresh row loads silently in the background and corrects any staleness; cache cleared on sign-out. First-ever load still fetches once | Refresh the app repeatedly: the gate/app should appear immediately after the first visit | ✓ (demo smoke; live path is the real test) | [ ] |
| 2 | Codex: "Average score by theme" ordered highest average first | Codex metrics | ✓ (8.6 above 8.5) | [ ] |
| 3 | Forgot password button always answers: clicking with no or malformed email says "First enter your email above, then ask again." (was silently disabled) | Click it with an empty email field | ✓ (logic; login panel unreachable in demo) | [ ] |
| 4 | Feature requests can no longer bounce on "The Keiser's inbox could not be found": if the roster lookup fails (missing RLS policy), the route falls back to the Keiser's known address (env KEISER_EMAIL or default) | Send a wish as a member before/after the roster SQL | n/a | [ ] |
| 5 | scripts/set-password.ts: Keiser sets (or creates) a member's login password directly — creates the missing auth account petition-approval never made, email pre-confirmed | Run for Martin, have him log in | ✓ (arg validation) | [ ] |
| 6 | "RSVP on their behalf" list (and the roster) share one order: members first, then active initiates, inactive last (lib/members.ts rosterOrder) | Open the behalf list | ✓ | [ ] |
| 7 | toggleAttendee surfaces silent RLS refusals: if the gatherings update writes 0 rows, the Keiser sees "The record refused the change" instead of a tick that vanishes on refresh | RSVP on behalf on live; if it errors, the gatherings policies are missing | ✓ (demo path) | [ ] |
| 8 | Loading states: the codex shows a spinning loader + "Consulting the annals…" until data arrives (was zeros everywhere, reading as no history); the roster shows "Summoning the roster…"; the app-wide auth loader now actually spins (shared Loading component + lcv-spin animation) | Open codex/roster on a slow connection: spinner, then data | ✓ (branch + animation verified) | [ ] |
| 9 | Convene: "Gatherings to come" title centred | Convene | ✓ | [ ] |
| 10 | Roster row: an initiate the Keiser can elevate shows ONLY the Elevate button (the initiate tag was redundant and together they overflowed the mobile edge) | Roster on the phone: Elevate fully visible | ✓ | [ ] |
| 11 | **Speed: portraits move to Storage.** New crops upload to the public `avatars` bucket (profile + roster editor); members.avatar_url holds a short cacheable URL instead of 15-40KB of base64. **SQL: avatars bucket block at the bottom of policies.sql. Then run scripts/migrate-avatars.ts (dry-run, then --write) to move the existing portraits.** | Roster/convene/oracle payloads shrink from ~100s of KB to a few KB; portraits browser-cached | ✓ (demo passthrough; live is the point) | [ ] |
| 12 | **Speed: stale-while-revalidate lists** (lib/swr.ts): codex (annals/gatherings/dq/members), convene (gatherings/members), oracle (members), roster (members) paint from the last local snapshot instantly, fresh data lands right behind; snapshots kept honest after codex edits. Spinners now only show on a first-ever visit | Navigate between pages on live: instant paint, silent refresh | ✓ (all pages regression-swept in demo) | [ ] |

---

## 2026-07-08 (night) — forgot password, convene fixes, roster order — pushed 383c5df

**Supabase dashboard step required before this works live:** Authentication → URL Configuration → Redirect URLs → add `https://lecouncilduvin.co.za/reset`.

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Real **Forgot password** flow: the gate's "Forge a secret word" (which was actually password SIGN-UP and confused everyone) is now "Forgot password" — needs only the email, sends Supabase's recovery mail, lands on the new public /reset page where the member forges + confirms a new word (8+ chars). Password sign-up button removed; new souls enter by Google or magic link | Click Forgot password with your email, follow the mail, set a new word, log in with it | ✓ (gate + /reset states; recovery mail needs live) | [ ] |
| 2 | Convene: "Gatherings to come" no longer lists revealed/past nights (the 16 imported historical nights were all appearing as upcoming) — only genuinely future, unrevealed gatherings show | Convene after the import: only the next summons listed | ✓ | [ ] |
| 3 | Roster ordered: Keiser + full members first (alphabetical), then initiates, inactive souls last | Profile roster | ✓ | [ ] |
| 4 | Convene copy: "Finding the host" → "Venue details"; "Summon a new gathering" at 14px | Meeting card + summon form | ✓ | [ ] |

---

## 2026-07-08 (evening) — roster for all, RLS fix, codex photos + claims, rite/reveal gating, feature requests, history import — pushed

**New SQL for the live DB (run any time, fixes Scott's raw-id bug immediately):** see the "members roster read" block at the bottom of supabase/policies.sql — is_member() + roster-wide select policy.

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | RLS: any actual member may read the whole members table ("members roster read" + is_member()). Fixes poll voters / RSVPs / cards / avatars showing raw ids to non-Keiser users | As Scott: poll voters show names + avatars | n/a (SQL) | [ ] |
| 2 | The council roster on the profile is now visible to members AND initiates, read-only: portraits (open cards), cult names, rank tags. Emails, row editing, and Elevate stay Keiser-only | Open profile as a member: roster listed, no emails, no Elevate | ✓ (all 3 roles) | [ ] |
| 3 | Fix: Oracle never loaded gatherings in live mode, so the hosting wheel's "moons since hosting" order ran on an empty list | Oracle hosting wheel order matches hosting history | ✓ | [ ] |
| 4 | Member-card portraits enlarge on click: a small centred lightbox (min(78vw, 340px), gold frame) above the card, not a full-screen takeover; click anywhere or Escape closes the photo first, the card stays; members without a photo keep a plain avatar (nothing to enlarge) | Open a card with a portrait, tap the photo | ✓ (open, close-on-backdrop, card survives) | [ ] |
| 5 | Codex: every past gathering carries a **Look upon the wine** gallery — ANY signed-in soul may add photos (reveal-photos bucket; thumbnails, tap to enlarge); reveal-night photos and codex photos share the same gallery | Expand a night, add a photo as a member | ✓ (upload + thumbnail + stored on gathering) | [ ] |
| 6 | Codex: unowned wines show **claim it** to any member; claiming writes their cult name into the annal; one bottle per soul per night (buttons vanish once a wine that night is yours); confirm prompt | Expand an imported night, claim an unowned bottle | ✓ (claimed, buttons vanished after) | [ ] |
| 7 | THE RITE nav tab hidden until the rite opens (30 min after the gathering convenes, same clock as the Enter-the-rite button); direct URL still hits the existing lock screen | Nav before/after a gathering's start | ✓ (hidden pre-open, appears when open) | [ ] |
| 8 | Reveal one-claim-per-soul confirmed already enforced (claim button hides once you own a bottle; handler guards too) | Try claiming twice on the reveal | ✓ (existing logic) | n/a |
| 9 | **scripts/import-annals.ts** built: 16 nights (Elgin Whites slots in by date), venue prepended ("La Plage II - Viognier"), 1-5 nights remapped 1→1/2→3/3→6/4→8/5→10, departed souls + German become inactive initiates silently, unregistered voters' ballots HELD until they register (averages still count them; only Dominik remains), Vin Iconnu → unowned/claimable, Julia + Mickey credited by name only, comments → ballots.notes, app-era gatherings renumbered after 16. Dry-run default; `--write` to apply; `--parse` for offline check | Run dry-run with service key, review, then --write | ✓ (--parse: all 16 nights shaped) | [ ] |
| 10 | Profile: **Wish upon the Council** — any member submits a feature request from a textarea; the server relays it to the Keiser's inbox (recipient forced server-side, member-only, 2000-char cap, text HTML-escaped); branded "A wish from…" email | Send a wish as a member, check the Keiser's inbox | ✓ (card + graceful skip without Resend key) | [ ] |
| 11 | Reveal locked until the rite is open too: page shows "The rite has not yet begun" pre-rite even if ballots would otherwise pass, and the REVEAL nav tab hides alongside THE RITE until the rite opens | Before a gathering starts: no Reveal tab, direct URL locked | ✓ (nav hidden + lock message) | [ ] |

---

## 2026-07-08 — tooltips, gold sky buttons, Codex past gatherings + Keiser editing, Nose sources + filler filter, notes pipeline — pushed db11c15

**New SQL for the live DB before this deploys:**
```sql
alter table ballots add column if not exists notes jsonb not null default '{}'::jsonb;
```

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Only one tooltip open at a time, everywhere (opening one closes the last) | Tap several ⓘ in a row on a card | ✓ | [ ] |
| 2 | Profile "Your sky" buttons now gold (like Summon the Council) | Profile bottom | ✓ | [ ] |
| 3 | Codex: **Past gatherings** section at the bottom — every committed night, newest first, expands to Theme / Date / Host(s) / wines (title — owner · score, DQs marked) | Codex after a commit; co-hosts show "A & B" | ✓ (seeded run-through) | [ ] |
| 4 | Whispered notes now persist with the ballot (restore on return; saved on type-blur, score, aroma, seal) | Write a note in the rite, reload | ✓ | [ ] |
| 5 | The Nose cloud now draws from ALL THREE sources: marked aroma pills, typed custom aromas, and whispered notes mined in full — bank phrases matched whole-word first ("black cherry", no "rose"-inside-"rosemary"), then every remaining meaningful word. Filler words (articles, pronouns, hedges, bare opinions like "nice", wine-noise like "smells") never reach the cloud, and the same filter cleans the rite's custom-aroma input ("a hint of black cherry" → "black cherry"). Imported history's comments land in notes, so they get the same treatment automatically | Write "Too smooth, no tannins, a bit smokey" in a note, seal, open your card: smooth/tannins/smokey only | ✓ (unit-tested computeDossier: leather deduped vs marked, black cherry as phrase, zero fillers) | [ ] |
| 6 | Codex, Keiser only: **amend any past gathering** (pencil on an expanded night) — theme, number, date, host + co-host selects, every wine's title / owner / score / off-theme flag, add or remove wines; ranks re-reckoned from scores on seal (ties share the crown, DQs unranked, vote counts kept) | Open a past night as Keiser, tap the pencil, change a score so the crown moves, seal | ✓ (crown moved, victories + theme averages followed) | [ ] |
| 7 | Codex, Keiser only: **Record a past gathering** button at the bottom — full manual entry; owners are free text with a member-name datalist so departed souls can be credited; gathering number auto-suggests next; creates the gathering (revealed) + annal together | Add a night, check it lands in date order with metrics updated | ✓ (added, ranked, then erased) | [ ] |
| 8 | Codex, Keiser only: **erase** a gathering from within the editor (confirm prompt; removes annal + gathering) | Trash icon next to Seal/Cancel | ✓ | [ ] |
| 9 | Fix: co-host was never persisted in live mode (`host2_id`/`host2_name` missing from the gatherings row mapping) — co-hosts now save and load | Set a co-host on convene, reload | ✓ (demo) | [ ] needs live check |
| 10 | Fix: hosts recorded as a bare name (no member id, as imported history will be) stay selected in the editor instead of resetting to "Unrecorded" and being wiped on seal | Edit an imported night's host select | ✓ | [ ] |
| 11 | Gathering numbers stay in sequence with history: Codex "Record a past gathering" now suggests max across annals AND gatherings + 1 (was annals only, could collide with the upcoming meeting's number); Convene already numbers new summons max+1. The history importer will number the 15 past nights 1-15 and renumber app-era gatherings to continue from 16 | Add a past night while an upcoming gathering exists; the suggested number continues past it | ✓ (seeded no. 20 → suggested 21) | [ ] |

---

## 2026-07-08 — post-astral fixes from Keiser's live testing — NOT yet committed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Card black-space bug fixed **structurally**: the overlay scrolls (like a page) and the card keeps its natural height, so there is no inner scroll container to clip or drift; page scroll locks beneath; scroll chaining blocked | Open a card on the phone, scroll to the very bottom: the card ends with its border + a small even gap, nothing more | ✓ (bottom gap measured = padding exactly) | [ ] |
| 2 | Own card speaks to you: "what the vine has learned of you", "Your Finest Pours", "the sky at your first breath", etc. | Open your own card vs another member's | ✓ | [ ] |
| 3 | Profile page: derived astrology rows removed (they live on the card); a whisper points to the card + Your sky | Profile shows only the birth inputs | ✓ | [ ] |
| 4 | Date/time inputs no longer run past the card edge on iOS (`appearance: none`) | Profile on the phone: both fields have right gutters | ✓ (needs phone confirm) | [ ] |
| 5 | Tooltips open reliably on touch (hover handlers were double-toggling taps) + tap targets enlarged to 22px | Tap any ⓘ on the phone once | ✓ | [ ] |
| 6 | "Complete your record" closes the card + reading and goes to the profile; viewing SOMEONE ELSE'S veiled sky shows "their record awaits their own hand" (no button) | Tap it from a veiled view | ✓ | [ ] |
| 7 | Timezone select: 32 major cities with UTC offsets ("New York (UTC-4)"); geocoded zones (e.g. Detroit) stay selectable | Profile + petition selects | ✓ | [ ] |
| 8 | Place search understands "Town, Region": searches the town, ranks by region — "Tawas City, Michigan" now resolves | Try it on the profile | ✓ (live API check) | [ ] |
| 9 | "The atlas does not know it" no longer shows alongside a pinned place | Fail a search after a successful pin | ✓ | [ ] |

---

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
