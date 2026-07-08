# Le Council du Vin

> _in vino veritas_

[![Netlify Status](https://api.netlify.com/api/v1/badges/b91ca720-46e1-481e-ba82-17fc682cdd9e/deploy-status)](https://app.netlify.com/projects/le-council-du-vin/deploys)
&nbsp;
![Supabase](https://img.shields.io/badge/Supabase-project%20live-3ECF8E?logo=supabase&logoColor=white)
&nbsp;
![Access](https://img.shields.io/badge/access-login%20live-3ECF8E?logo=supabase&logoColor=white)
&nbsp;
![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)

<!--
  STATUS BADGES — keep these current.
  • Netlify: live deploy-status badge for site le-council-du-vin (site id
    b91ca720-46e1-481e-ba82-17fc682cdd9e).
  • Supabase: project is provisioned and the schema is applied. There is no
    per-project status badge; platform health lives at https://status.supabase.com
  • Access: the login wall (Google SSO + branded magic link) is LIVE in
    production — NEXT_PUBLIC_ENFORCE_LOGIN=true in Netlify, Supabase env present,
    custom SMTP via Resend. Local/preview stays open (demo) by default.
-->

A private web app for a monthly blind wine-tasting society. Each moon, 10–12 members
convene under a rotating theme, bring a bottle, cloak them in numbered black cloths,
score each pour 1–10, then lift the cloths and tally the reckoning.

The aesthetic is **The Deep** — cold true-black, tarnished gold, hairline strokes, moon
phases and alchemical glyphs. Old-world secret-society, playing off the all-seeing-eye
emblem.

## Screens

| Screen | Purpose |
| --- | --- |
| **Gate** | Landing / sign-in. Two buttons — members enter, outsiders petition. Login options appear only after clicking "Enter the council". |
| **Initiation** | Cult-style application — chosen name, email, **date + time of birth** (the chart is drawn from these; no more star-sign/element questions), ritual questions, the oath. Public; the petition persists (`src/lib/applications.ts` in demo, `applications` table live) and surfaces in the Keiser's tribunal. Links back to the gate. |
| **Convene** | The next meeting front-and-centre plus **future gatherings** (collapsed by default) and a Keiser **"summon a new gathering"**. Each meeting (Keiser can **edit** theme, supporting line, host, date, and time via a pencil): rotating host, editable **observances** + **Keiser's decree** copy (seeded defaults), host **venue** (prefilled from the host, editable here without syncing back to their profile), **RSVP** (the last section of the meeting card; members self-RSVP, the Keiser can RSVP on anyone's behalf), and the Keiser bottle count. Each member can privately log **"your offering"** (inside the card, under Enter the rite) — the wine they plan to bring, hidden from everyone (even the Keiser); once sealed the name is hidden on screen too, with edit/erase controls. **Enter the rite** sits inside the meeting card (above the host line) and **opens 30 minutes after the scheduled start** — the rite and reveal tabs are hidden from the nav entirely until then (the pages themselves stay locked as backstop), and the button appears on its own when the window opens (no refresh). Moon-phase divider before "Gatherings to come". The whole card is **shareable to WhatsApp** (bold-formatted details + `RSVP here` link, for non-members; the link-preview image is the black-gold logo via OpenGraph). The Keiser can also **cancel** a gathering. |
| **The rite** | Blind scoring — a focused card (a designed gold **cloth medallion** for the wine number `1–20`, from `public/cloths/` (WebP, all preloaded on entry so switching wines is instant; text fallback beyond 20)), 1–10 orb verdict showing its number, random 3–4 aroma prompts per wine from a 100-aroma bank plus **add-your-own**, and notes — plus a **ballot** of every wine you can re-score in one tap, so a later pour can unseat earlier favourites. Sealing **persists the ballot** (`src/lib/ballots.ts`; revising after breaks the seal) and surfaces a **"Proceed to the revelation"** button. |
| **Reveal** | **Hidden (nav + page) until the rite opens, then locked until every RSVP'd attendee has a sealed ballot** (computed from real ballots, no seed). Scores are **real tallies** — the average of every sealed ballot per cloth. The champion card sits **face-down** (the "Turn the card, crown the goddess" art, `public/reveal-back.webp`) — click to flip, then the ranked bottles rise one by one. **Ties share the crown** — several top-score bottles are shown together as co-champions and all recorded as rank 1. Each member **claims their own bottle** (one per soul; claiming pulls in their pre-registered offering; **release** undoes a mistake); titles are click-to-edit. The **Keiser can disqualify** off-theme wines — they lose their rank, fall to the bottom struck-through, and feed the **disqualification ledger** (threshold {5} → expulsion hearing). When all is recorded, **"Commit it to the Annals"** (visible to all, Keiser-only action) locks the result into the codex — after which only the Keiser may amend, and his amendments flow back into the record. Bottle-photo gallery after the reckoning. |
| **Oracle** | Forecasting the moons ahead. **Date polls** (multiple can run at once; any member creates a poll, adds dates, and votes; each date expands an **accordion of who voted**; polls can be **archived/restored**; shareable to WhatsApp). Then the theme idea-pool (propose with an optional supporting line + favour; the Keiser can **edit or delete** themes), and the hosting wheel — sections separated by moon-phase dividers. |
| **Tribunal** | Keiser-only. Petitioners (name + birth-derived sun sign + their answers) + the Council's non-binding tally + the final decree. **Anoint as initiate** creates their account at initiate rank (limited access — Convene, Rite, Reveal only) and drops them into the profile roster, where the Keiser can later **Elevate** them to full member. Also **expulsion hearings**: members with five disqualifications are summoned — all members vote keep/cast-out, the Keiser decrees. |
| **Codex** | a.k.a. **the Annals** — same page, not a separate one. Historical stats, the **committed reckonings**, and the **disqualification ledger** with the threshold-of-five flag. A **Past gatherings** section at the bottom lists every committed night newest-first; each expands to theme / date / host(s) / the ranked wines (title, owner, score, DQs marked). The **Keiser can amend any past night in place** (pencil on an expanded night: theme, number, date, host + co-host, every wine's title / owner / score / off-theme flag, add or remove wines — ranks re-reckoned from scores on seal, ties share the crown), **record a past gathering manually** (owners are free text with a member datalist, so departed souls can be credited), and **erase** a night entirely. Every night carries a **"Look upon the wine" photo gallery** any member may add to, and **unowned bottles show "claim it"** so a member can take credit (one bottle per soul per night). Ballot data never reaches the codex until the Keiser's "Commit it to the Annals" on the reveal, or his own hand here. **Sixteen nights of pre-app history (Feb 2025 onward) were imported** via `scripts/import-annals.ts` — real per-voter ballots, notes, and departed-soul profiles included. |
| **Profile** | Editable identity — click the avatar circle to upload + crop a portrait, click the name to rename, edit venue instructions, and set date, time, **timezone, and Place of Birth** (geocoded once; coordinates stored invisibly). From birth, a set of **read-only, tooltipped** fields is derived (`src/lib/astrology.ts`): western element + sun sign, moon sign, the **exact** ascendant (sidereal time at the birth place), and Chinese Shengxiao (animal) + Wu Xing (five-element, with a per-result tooltip). **The council roster** lives here for every rank — members and initiates see the roll read-only (portraits open cards), while the **Keiser** gets every account in an accordion, each editable in place (cult name, email, initials, rank, venue instructions, active flag); edits persist (`src/lib/members.ts`) and flow through to where members are listed (Convene RSVP + host picker, Oracle host wheel + poll voters). A **Feature request** box relays any member's wish to the Keiser's inbox (recipient forced server-side). Reached via the header chip; in open mode it also hosts the "view as" tier switcher, in enforced mode the sign-out. |

## Roles

- **Initiate** — anointed but not yet trusted. Limited access: **Convene, the Rite, and the Reveal only** (no Oracle, Codex, or Tribunal). The intended onboarding path — a prospective member fills the initiation rite, the Keiser anoints them to initiate, then elevates them to full member once they've stood a gathering.
- **Member** — sees everything.
- **Keiser** — super-admin. Final say on membership regardless of the vote, elevates initiates → members from the profile roster, plus hosting and historical edits.

### Keiser-only powers

Everything below is visible/actionable **only to the Keiser** — other members either don't see it at all, or see it read-only. (Enforced in the UI via `isKeiser`, and in the database via the `is_keiser()` RLS helper.)

- **Tribunal (entire screen)** — hidden from the nav for everyone else. Review petitions and **anoint** (→ initiate) or **cast out**; run **expulsion hearings** for members who reach five disqualifications and decree mercy or expulsion. A **petition-count badge** on the Tribunal tab flags new initiates on login.
- **Profile → the council roster** — view **every** member's account and edit it in place (cult name, email, initials, **rank**, venue instructions, active flag); **elevate** an initiate to full member; **cast a member out** of the Council (which also removes their petition record).
- **Profile → Heralds** — compose and send branded emails: the new-gathering **invite** (defaults to all active members) and the tribunal **summons** (to a member at the disqualification threshold), editing recipients before sending.
- **Convene** — **summon** a new gathering and **cancel** one; **edit** the meeting (theme, supporting line, host, date, time, the observances, the Keiser's decree, and venue) via the top pencil; set/adjust the **wine count**; and **RSVP on anyone's behalf**.
- **The rite** — add or remove wines mid-tasting (the **wine-count** stepper). Everyone else sees the count but can't change it.
- **Reveal** — **disqualify / restore** off-theme wines; **"Commit it to the Annals"** (all members see the button, but only the Keiser can commit); once committed, **only the Keiser may amend** the locked result.
- **Oracle** — **edit** or **cast out** themes from the pool. (Proposing themes, casting favour, and creating/voting on date polls are open to all members.)

For contrast, any **member** can: RSVP, log a private offering, score in the rite, claim and name their bottle on the reveal, propose and favour themes, create and vote on polls, and read the codex.

## Notable features

- **Transactional emails** — branded, mobile-first HTML (`src/lib/emailTemplates.ts`, previewable under `public/email-previews/`) sent via **Resend** through a Keiser-gated route (`/api/send-email`). Automatic: petition **anointed** (→ initiate) and initiate **elevated** (→ member). Manual from **Profile → Heralds**, with add/remove recipients: new-gathering **invite** and tribunal **summons**. Plus a branded **magic-link** template for Supabase Auth. Titles use a cursive display face, a moon-phase divider from the gate, and an Instagram footer. Everything no-ops safely until `RESEND_API_KEY` / SMTP are set.
- **Member cards** — every member avatar across the app (Convene, Oracle, Tribunal, Profile roster) is clickable to a tarot-style stats card: portrait (click it again to enlarge in a small lightbox), name, **moon phase at birth**, role, the birth-derived fields (tooltipped, never the raw date/time of birth) — element, sun, moon, ascendant, Shengxiao, Wu Xing, **Bazi day-master, life path number, Venus sign, and birth arcana** (each with a label tooltip *and* a per-result meaning tooltip) — and a **chalice count**, one gold chalice per codex victory. Animated open/close (`src/components/MemberCard.tsx`).
- **Exact natal engine** (`src/lib/astrology.ts`) — no lookup tables where astronomy exists: sun sign from the true solar ecliptic longitude (no cusp-day drift), moon sign from a perturbed lunar ephemeris, Venus from its orbital elements, and the ascendant from the exact sidereal time at the birth coordinates. Birth times convert local → UT through the IANA timezone database (default `Africa/Johannesburg`, selectable). Chinese zodiac honours the actual Chinese New Year boundary (1940–2030 table). Verified against documented reference charts and recorded sky events.
- **Place of Birth** — one text field on the profile and petition; "Mark it" geocodes it (Open-Meteo, keyless) and quietly stores coordinates + timezone for the chart. Missing data never guesses: the ascendant shows "unknown hour/place" instead.
- **Tarot per night** — deterministic draw from the Major Arcana keyed on `(gathering, member)`, so a member's card is fixed for a gathering but re-dealt each event (`src/lib/tarot.ts`).
- **Date voting** — mark every date you can make; the night the most souls can attend leads. A **Share poll** button opens WhatsApp pre-filled with the dates and a link back to the poll (`/oracle`).
- **Keiser-set wine count** — the Keiser fixes how many bottles convene (on Convene) and can add/remove wines mid-rite if the count was off; everyone else sees the count but can't change it. Shared between Convene and the Rite (localStorage in demo; `gatherings.wine_count` when live).
- **Relative re-scoring** — the rite keeps every wine's score, aromas, and notes live at once; a ballot lets you revise any earlier wine while judging a later one (blind tasting is comparative).
- **Aromas** — a 100-aroma bank (`src/lib/aromas.ts`); each wine shows a deterministic random 3–4 as quick prompts (one line on mobile), and the taster can coin new aromas on the spot.
- **Per-member venue instructions** — stored on each member, ready to drop into invites when they host.
- **Branding** — the all-seeing-eye favicon, header logo mark (`public/site-mark.png`), full wordmark logo, and an ornate celestial **card frame** (`public/card-frame.webp`) around the focused wine on the rite; backgrounds keyed to transparency so the art sits on the true-black UI. Header is a single line (logo + "Le Council du Vin") with a compact profile chip — no per-role buttons.

## Roles of access (login)

The login wall is **live in production**, controlled by `NEXT_PUBLIC_ENFORCE_LOGIN`
(independent of whether Supabase is connected).

- **Enforced** (production — `NEXT_PUBLIC_ENFORCE_LOGIN=true`, Supabase env present): every
  screen except the gate and the public petition redirects to login. Signing in isn't enough —
  the email must exist in the `members` table, so a signed-in stranger sees a "pending" screen.
  Login is **Google SSO** or a **branded email magic link** (delivered via Resend SMTP).
- **Open mode** (local/preview default — `NEXT_PUBLIC_ENFORCE_LOGIN` unset/`false`): every
  screen is navigable and a header role switcher walks all three tiers, so the app stays
  browsable without auth. Supabase can still be connected for data.

## Tech stack

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS plus a custom stylesheet (`src/app/globals.css`), theme "The Deep"
- **Backend:** Supabase (PostgreSQL + Auth). Client reads its own member row via RLS; secrets stay server-side.
- **Hosting:** Netlify (`@netlify/plugin-nextjs`, see `netlify.toml`)

## Local development

```bash
npm install
npm run dev
```

Without a `.env.local`, the app runs in **demo mode**. The only seeded content is the
real member roster and theme pool (`src/lib/seed.ts`) — gatherings, RSVPs, offerings,
ballots, reveals, and committed reckonings all start empty and persist per-browser in
localStorage (`src/lib/gatherings.ts`, `ballots.ts`, `bottles.ts`, `annals.ts`), so the
whole loop — summon → RSVP → rite → reveal → commit — is exercisable end to end.
Add Supabase env (below) to switch to live mode.

> Don't run `npm run build` while `next dev` is running — they share `.next` and the
> build clobbers the dev server's CSS. Stop the dev server first, or use a clean checkout.

## Going live

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor (edit the seeded Keiser email first).
3. Run [`supabase/policies.sql`](supabase/policies.sql) — RLS so a member can read their own row and petitions can be submitted.
4. **Authentication → URL configuration**: set the Site URL and add redirect URLs (`http://localhost:3005` and the Netlify URL).
5. **Authentication → Providers → Google**: enable it with an OAuth client (magic link + password work out of the box).
6. Copy `.env.example` → `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
7. When ready to require login, set `NEXT_PUBLIC_ENFORCE_LOGIN=true` (locally and in Netlify) and restart. Until then the app stays open/navigable while still reading Supabase.

## Deploy

Connect the repo to Netlify; set the same `NEXT_PUBLIC_SUPABASE_*` env vars in Netlify's
build settings (this is what turns the production login wall on). `@netlify/plugin-nextjs`
handles the Next build.

## Project status

**Done**
- All eight screens in "The Deep", responsive, with seeded demo content.
- Branding: favicon (`src/app/icon.png`), full logo, transparent art on true black.
- **Login wall live in production** (Google SSO + branded magic link via Resend SMTP) + role gating. Initiate onboarding wired end to end: petition → Keiser anoints to initiate (limited access) → elevate to member from the profile roster.
- **Live data on Supabase** — the whole loop (summon → RSVP → rite → reveal → commit) reads/writes live: ballots/scoring, offerings, annals/codex, Oracle themes + polls. Reveal auto-unlocks by polling for sealed ballots; reveal photos persist to Supabase Storage.
- **Transactional email system** (Resend) — auto anoint/elevate, manual invite + tribunal summons from Profile → Heralds, branded magic link, Keiser petition alert.
- **Clickable member cards** (tarot stats + chalice count), **tie/co-champion** handling on the reveal, rite **opens 30 min after the scheduled start**.
- Tarot per night, date-voting poll + WhatsApp share, custom aromas, orb-number verdict, per-member venue instructions.
- GitHub repo + Supabase project provisioned, schema applied.
- **The astral suite** (built to the member-approved mockup, `public/member-card-mockup.html`): **The Palate Dossier** on every member card — moons stood, bottles crowned, marks against, palate temper, kindred palate, the hosting wheel, longest communion, the aroma **Nose** cloud (drawn from marked aroma pills, typed custom aromas, and whispered notes mined in full; filler words and wine-noise are filtered out everywhere, including the rite's custom-aroma input and imported history's comments), and their finest pours, all derived from real ballots + annals. **The natal chart** — the full ten-planet wheel (verified against documented positions), whole-sign houses, aspect lines, tap-a-row placement meanings. **The Foretelling** — a personal reading per lunar cycle from real computed transits (new/full moons in their houses, slow-planet aspects with true dates, Mercury retrogrades) plus the year glimpsed (personal year, Chinese year, house ingresses); interpretations hand-written, never AI-generated. Both gated: missing time/place of birth shows "the sky is veiled" linking to the profile, never a guess. **Co-hosts** — two hosts per gathering, both credited on the wheel. **Your sky** on the profile — open either view or email it to yourself (the wheel travels as a snapshot image).

- Automated **reminders** are intentionally **not** sent (declined by design — no gathering reminder or RSVP nudge). New-gathering invites and tribunal summons are **manual**, Keiser-triggered from Heralds. Automated WhatsApp would still need the WhatsApp Business API; manual share links cover it.
- Member voting UI on applications (the Council's tally is display-only for now; the Keiser's decree is binding).
- Richer Codex charts.
- **Blind-tasting privacy** — ballots/offerings are still API-readable before the reveal; owner-only RLS until the gathering is revealed is a known gap.

_The `MEMORY`/notes for this project live in the assistant's memory, not the repo._
