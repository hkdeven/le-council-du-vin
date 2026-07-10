# Le Council — Test Log

## 2026-07-10 (later) — the quadruple-check audit applied; daily horoscope in both foretelling emails — pushed

No new SQL needed.

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | **Independent audit passed** (research agent, cross-checked vs JPL Horizons, Meeus reference code, DrikPanchang live values, Saravali/classical tables, Ernst Wilhelm's gochara compilation): ayanamsa, mean node, tropical engine (Moon within 0.006° of JPL), nakshatra/pada/navamsa, Vimshottari incl. balance-antar logic, kuta building blocks, yogas, mangal dosha, panchang methods, gochara lists (exact), Sade Sati method, tara bala all CONFIRMED. Three corrections applied: **tara kuta now uses the dominant even-remainder rule** (Janma pairs score 0 in the kuta; muhurta unchanged, Janma stays mixed), **gana matrix transposed to the classical Saravali orientation**, **vashya's two asymmetric cells swapped to groom-rows orientation**. Displayed kindred scores are unchanged by the two transposes (the accord averages both directions); identical-moon pairs drop 28 → 25 under the tara rule. Dead code removed (VARNA, mahaYears). **verify-kundli.ts now 45/45**, verify-vedic 24/24 | npx tsx scripts/verify-kundli.ts | ✓ 45/45 | n/a |
| 2 | **Both foretelling emails carry the daily horoscope**: foretellingEmail gains a "This Day" section (dayLabel + day omens, wired from the profile envelope), vedicForetellingEmail gains "The Day's Star" (tara + passage + the five-limb almanac); previews 8 and 10 regenerated and verified | Open email-previews/8 and /10 | ✓ | [ ] |
| 3 | **Crowns survive disqualifications** (new championsOf() in src/lib/annals.ts, the single source of truth for who took a night): a scored night crowns rank 1 non-DQ as before; if the raw first place carries a DQ, the best surviving score is promoted and the DQ'd member is NEVER credited; an unscored night (like the French reds import) still crowns when exactly one wine survives the DQs. Wired through every victory surface: codex night line + victory ledger + chalice champion, member-card chalices, the dossier's bottles crowned, and the prophecy's grade. 8/8 hostile-data cases pass | Codex: the French reds night reads "crowned: Seer Matthew"; his card carries the chalice | ✓ (injected the exact French-reds shape in demo: night line + chalice champion both credited Matthew; test data removed) | [ ] |
| 4 | Build requirements recorded from the audit for the Heavens build: panchang **yoga must sum sidereal longitudes** (tropical shifts it by ~3-4 yogas; tithi/karana may use the tropical difference since ayanamsa cancels); gochara ships without vedha but the methodology note must say so; panchang boundary times shown to the hour at most; optional later: mangal dosha also from Moon/Venus for calculator parity | n/a (build notes) | n/a | n/a |

---

## 2026-07-10 — The Kundli: modal, kindred stars, muhurta, yogas, profile door — pushed

No new SQL needed.

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | **The Kundli modal** (src/components/Kundli.tsx), built to the approved mockup: North/South chart toggle (remembered per device, both SVGs generated from the live VedicChart), Lagna/nakshatra/navamsa rows with tooltips (12 lagna natures + all 27 nakshatra characters hand-written), the age you are living (mahadasha + antardasha passage with true dates + next-age line), the full turning (9 rows, per-lord tooltips, NOW in gold), the pillars and the pits (lagna lord, 10th lord, top-2 pitfall conditions), Muhurta · Favourable Hours (real tara-bala day chips), the marriage bond (7th lord house + Shukra + navamsa + honest mangal-dosha note), the yogas (only those truly present), natal-style methodology | Open The Kundli from your card or profile | ✓ (walked the whole modal; Keiser chart matches the verified sample: Kanya 8.7°, Rahu maha → Moon antar, Gajakesari + Budhaditya) | [ ] |
| 2 | **Kindred stars**: classical ashta-koota accord out of 36, moon to moon, symmetric mean of both directions; full members only, both charts complete, sorted desc, verdict labels | Two live members with complete birth records: open either's Kundli | ✓ (injected a complete demo member: "26½ of 36 · strong" appeared; section correctly hidden when no other complete chart) | [ ] |
| 3 | **Voice flips**: your/their across every passage and the veiled gate ("The heavens ask three more truths of them") | Open another member's Kundli | ✓ (Larissa override: "their first breath", "The age they are living", "Their strength"; gate in third person) | [ ] |
| 4 | **Profile: third door under Your sky** — The Kundli + envelope; the kundli email (bands: rows, the age, the turning, pillars, muhurta, marriage, yogas, methodology footer) sends only to self like natal/foretelling | Profile → Your sky → The Kundli / envelope | ✓ (door + modal; email no-ops until Resend, template renders) | [ ] |
| 5 | **Member card: third button** The Kundli under The Foretelling (ti-north-star) | Any member card | ✓ | [ ] |
| 6 | **The heavens emails**: kundliEmail refined + NEW vedicForetellingEmail template (the wandering sky ledger, the year's turnings, the clock within, the iron passage); real-data previews generated as public/email-previews/9-kundli.html and 10-vedic-foretelling.html; the doctrine note ("No astrology API of any kind is consulted...") added to the Foretelling modal methodology, both new email howMade footers, and the heavens demo | Open the two preview files | ✓ (rendered + verified in preview; local send impossible: RESEND_API_KEY lives only in Netlify, route returns "not configured") | [ ] |
| 7 | **The calculators** (src/lib/kundli.ts): ashta-koota (varna/vashya with half-sign rules/tara/yoni/graha-maitri/gana/bhakoot/nadi), tara-bala muhurta crossed with day-lord friendship, yoga detection (Gajakesari, Budhaditya, Chandra-Mangala, Kemadruma, the five Mahapurusha), mangal dosha, pillars. **scripts/verify-kundli.ts: 43/43** (classical facts, 729-pair invariants, the Keiser's independently confirmed chart, muhurta shape, and a published AstroSage worked example reproduced kuta-by-kuta: 10/36 exactly). Vashya/yoni/gana tables cross-checked against DrikPanchang + Saravali + two others by a research pass; three table corrections landed before ship | npx tsx scripts/verify-kundli.ts | ✓ 33/33 | n/a |

---

## 2026-07-09 (night) — oracle fixes, wide grape ledger, the Vedic engine — pushed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Oracle refetches on tab focus/visibility (backfilling in the codex then returning now updates the Unexplored) + loading spinner ("Consulting the oracle…") until themes/polls/annals land | Backfill grapes, switch back to the Oracle | ✓ (mount path; focus listener wired) | [ ] |
| 2 | Grape ledger widened to 177 entries (obscure varietals, Cape locals, 12 blend/style categories incl. Cape Blend, GSM, Sparkling/MCC, Orange); 22 detection tests pass; **NEVER_SUGGEST decree**: Hanepoot + all dessert pours banned from every suggestion surface; Unexplored draws from a curated 42-entry NOTABLE list | Unexplored chips read like real theme nights, never dessert | ✓ | [ ] |
| 3 | **The Vedic engine** (src/lib/vedic.ts, no libraries): Lahiri ayanamsa (verified vs published 1950/2000/2026 values), mean-node Rahu/Ketu (Meeus), sidereal chart on the verified tropical engine, whole-sign houses from the Lagna, 27 nakshatras + padas, Navamsa D9 (proven equal to the classical movable/fixed/dual rule across all 108 padas), Vimshottari maha+antar dashas with dates (hand-computed worked example + tiling invariants). **scripts/verify-vedic.ts: 24/24.** UI + interpretation passages: next batch, designs approved | Run npx tsx scripts/verify-vedic.ts | ✓ 24/24 | n/a (engine) |

---

## 2026-07-09 — convene never shows the past; codex owner dropdown; unscored/DQ history — pushed

No new SQL needed.

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | **Convene never shows a past event.** The top card only ever shows a night that is today-or-later AND unrevealed; when none exists it reads "The table is bare" (with the summon form right below for the Keiser). Previously, once every gathering had passed, the most recent OLD night was displayed as "This moon's theme" (Enter-the-rite button and all) — which also made a fresh summon look broken. The reveal/rite/reckoning pages keep their fallback to the most recent night (they need it after the night ends) | Convene with no future gathering: bare table, no old event; summon one: it appears as the current card immediately | ✓ (repro'd the old event showing, then the fix, in a scripted browser run) | [ ] |
| 2 | Summon hardening: in live mode the member list starts empty until the real roster loads (the demo seed ids like "m-larissa" could otherwise be picked as host and make the insert fail with an invalid-uuid error); every convene mutation (summon, edit, cancel, RSVP) now also updates the local snapshot so navigating away and back never repaints the pre-edit list | Summon on live; also summon, go to codex, come back — the new night is still there instantly | ✓ | [ ] |
| 3 | **Codex: "Brought by" is a dropdown**, not free text — Unclaimed / the roster / the row's existing imported name (departed souls stay selectable) / "Another name…" (prompts for a name, for departed members and guests) | Amend a night: the owner field is a select; pick a member; use Another name… | ✓ (screenshot; prompt name persisted + fed the DQ ledger) | [ ] |
| 4 | **Past nights can be recorded with no wine names and/or no scores.** An empty score now means "never judged": the codex shows "—" (was 0.0), the row is unranked, and it no longer drags down theme averages, the Reliquary, Finest Pours, or the Prophecy's history. Re-editing keeps the score field empty instead of turning it into a real 0. Unnamed wines show as "Bottle II" etc. and stay claimable | Record a past gathering, leave a wine's name/score empty, seal; row shows — and averages ignore it; re-open the editor: score still blank | ✓ (scripted run: annal rows stored votes:0, averages stayed 8.5) | [ ] |
| 5 | **DQs in past events**: tick "off theme · DQ" (relabelled from "off theme") on any wine row in the codex editor — works with or without a score/name; the owner picked in the dropdown lands in the Disqualifications ledger at the codex foot | Record/amend a night, tick DQ on a row with an owner: ✕ + "disqualified" on the row, ledger counts it | ✓ (ledger showed the DQ'd owner) | [ ] |
| 6 | **Erasing a night from the codex can no longer half-fail silently.** It deletes the gathering FIRST and surfaces any refusal in the alert (was: annal deleted, gathering delete error swallowed — a live policy refusal would leave the "erased" night lingering to resurface on convene, which is exactly how the test tasting haunted the page) | Erase a test night as Keiser: it vanishes from codex AND never reappears on convene; if the DB refuses you now SEE the error | ✓ (scripted erase: annal + gathering both gone) | [ ] |

---

## 2026-07-09 — the data awakens: split cloth, Reliquary, varietals + prices, the Reckoning, the Prophecy, the Unexplored — pushed

**New SQL for the live DB before this deploys (all three lines, safe to run right now):**
```sql
alter table offerings add column if not exists price numeric;
alter table offerings add column if not exists varietals text[] not null default '{}';
alter table gatherings add column if not exists prophecy jsonb;
```

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | **The split cloth** (mockup B): each codex night marks its most divisive wine (bolt on the row + chip "X divided the table, 3 to 10") when the widest score gap is 5+, from sealed ballots, 3+ votes | Expand an imported night with a known schism | ✓ | [ ] |
| 2 | **The Reliquary** (mockup C): all-time records card on the codex — Highest pour ever (plain), The great schism, Iron palate, The gentle hand (each tooltipped, 20+ scores to qualify for temper records) | Codex bottom, tooltips on tap | ✓ (temper rows correctly hidden below threshold in demo) | [ ] |
| 3 | **Varietals + price in the codex editor** (mockup D): every wine row keeps title/owner/score/off-theme and gains a multi-grape chip picker + price field; grapes in the wine's NAME auto-select on blur (unit-tested incl. "Savignon" typo, "Cabernet Syrah" double); codex rows show them dimly (" · Cabernet Sauvignon · R450") | Pencil any night, type a wine name with a grape in it | ✓ (7/7 detection tests) | [ ] |
| 4 | **Offering carries price + grape** (mockup E): optional R and grape fields on "your offering" (auto-detect from the name); claiming your bottle on the reveal carries them onto the row and into the annal on commit. Per Keiser: lives behind a **full-width "Log your offering"** button that unfurls a bordered box (animated open/close; title + R + grapes + Seal it + "veil it for now"); sealed state = its own box with edit/erase; the rule now sits BELOW the offering (none above), doubling as the divider before the Prophecy | Tap Log your offering, seal, reopen | ✓ (full-width measured, unfurl, seal, storage) | [ ] |
| 4b | Prophecy refusal restyled like the verdict: dimmed emblem + "THE VINE HOLDS ITS TONGUE" eyebrow + the count in large italic, animated unfurl (was one small whisper line) | Consult before offerings are in | ✓ (screenshot) | [ ] |
| 4d | Convene meeting card: full-bleed 2px gold rule directly below the theme (touches both card borders, kin to the member card's chalice bands) | Meeting card | ✓ (edges measured) | [ ] |
| 4c | **The Unexplored moved into the theme-pool card** — sits above the pool, joined to it by a full-bleed gold rule (tap-a-grape still pre-fills the proposal) | Oracle once varietals exist | ✓ | [ ] |
| 5a | Reckoning restyled per Keiser: gold-ruled section bands in one flow (the email's design), no stacked cards | Commit + view | ✓ (screenshot match) | [ ] |
| 6 | **The Prophecy** (all-data model per Keiser): "Consult the Prophecy" at the current meeting card's tail; refuses with a live count until every RSVP'd soul has a sealed offering; then weighs bringer history + each ATTENDING taster's grape leanings + price sensitivity across the sealed offerings, names a soul, and stores the verdict on the gathering (spoken once); animated unfurl with the breathing emblem; accuracy record shown once nights accumulate; the Reckoning grades it ("The vine foresaw it" / "The vine is humbled") | Consult before/after offerings; commit a night and read the grade | ✓ (refusal count, speaking, storage, humbling all verified) | [ ] |
| 7 | **The Unexplored** (Oracle): grapes the Council has never poured as tappable chips (tap pre-fills the theme proposal + scrolls to it) + the finest neglected grape ("Nor returned to Riesling since November 2025, though it scored 7.8"); silent until the codex knows 5+ distinct varietals | Oracle between themes and the wheel, once varietals are backfilled | ✓ (chips, prefill, neglect line) | [ ] |
| 8 | Card: "Coin's return" renamed **"Value for coin"**, value now reads "1.9 pts per R100", label tooltip explains the arithmetic in plain words, value tooltip gives the table's rate + a verdict sentence | Card tooltip | ✓ | [ ] |
| 5c | **Coin rows on the card** (Keiser kept B + C, dropped the blindfold): "Coin's return" (points per R100 as a bringer vs the table's rate) and "The purse" (average spend vs the table), between Palate temper and Kindred palate, tooltipped; hidden until the member has 2+ priced bottles and the table has 4+ | Open a card once prices accumulate | ✓ (values hand-verified: 1.9/R100, R423) | [ ] |
| 5b | Codex reordered: the Reliquary sits where Disqualifications stood; DQs moved to the very bottom of the page | Codex order: metrics, Reliquary, victories, averages, past gatherings, DQs | ✓ | [ ] |
| 5 | **The Reckoning** (mockup F): once the Keiser commits to the Annals, the reveal page BECOMES the Reckoning — the Crowning, the ranked table, the split cloth, the table's whispers (3 punchy anonymous notes from that night), the ledger (best value when 2+ prices known), photo gallery, and an "Email this to me" self-send (branded reckoningEmail; route allows own address only) | Commit a night, watch the page transform; email yourself | ✓ (full page render verified; email needs live) | [ ] |

---

## 2026-07-09 — Foretelling: This day + plain speech + segmented pill — pushed

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | **This day**: a real daily reading — the Moon's sign + which house it crosses (12 hand-written passages), fast-planet aspects (Mercury/Venus/Mars × conj/easy/tense, 9 passages) reported only when exact today (2° orb, top 2), and a Mercury-retrograde line when active. Quiet day reads short, per the no-padding rule | Open a Foretelling: This day is the default view | ✓ (moon-in-house renders) | [ ] |
| 2 | **Plain speech everywhere**: every passage across all three views (day, moon, year — transits, moons, retrograde, personal year, Chinese year, ingresses) now displays hand-written plain English; the Council-tongue originals remain in the data and in the emails. No toggle (Keiser's ruling: plain is the page voice) | Read any Foretelling passage | ✓ (all three views) | [ ] |
| 3 | **Segmented pill**: This day / This moon / The year live inside one bordered pill; the active segment wears a gold background with dark text; the lunar-cycle info tip lives on the This moon segment | Tap through the three segments | ✓ (gold follows selection) | [ ] |

---

## 2026-07-09 — titles, kindred rules, tooltip dismissal, card polish — pushed

**New SQL for the live DB before this deploys:**
```sql
alter table members add column if not exists title text;
```

| # | Change | How to verify live | Demo | Live |
|---|--------|--------------------|------|------|
| 1 | Kindred palate only names living FULL members — initiates and inactive/departed souls no longer qualify (their imported ballots still feed everyone's stats) | A card whose kindred was a departed soul now names a member | ✓ (filter + types) | [ ] |
| 2 | **Member titles** (the first feature-request wish granted): optional 60-char honorific on the profile ("Neither as long as a bio nor as short as a salutation"), Keiser can also set it per member in the roster editor; shown on the card in place of the moon-phase line (no title → moon phase as before) | Set a title, open your card | ✓ (input + card swap) | [ ] |
| 3 | Tooltips dismiss on ANY tap outside them (was: only when another tooltip opened) — card tips + profile tips | Open a ⓘ on the phone, tap anywhere | ✓ (pointerdown probe) | [ ] |
| 4 | Card derived-value labels (Element … Birth arcana) at 10px | Any card with birth data | ✓ (style) | [ ] |
| 5 | Card: solid full-bleed 2px gold rule above The Palate Dossier (was moon icons), 26px breathing room above and below | Any card | ✓ (2px + 26px measured) | [ ] |
| 6 | Header mark + "Le Council du Vin" link to Convene | Tap the logo | ✓ | [ ] |

---

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
