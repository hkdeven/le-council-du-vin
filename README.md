# Le Council du Vin

> _in vino veritas_

[![Netlify](https://img.shields.io/badge/Netlify-not%20yet%20connected-lightgrey?logo=netlify&logoColor=white)](https://app.netlify.com)
&nbsp;
![Supabase](https://img.shields.io/badge/Supabase-project%20live-3ECF8E?logo=supabase&logoColor=white)
&nbsp;
![Access](https://img.shields.io/badge/access-login%20wall%20built%20%C2%B7%20deferred-8a6d3b)
&nbsp;
![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)

<!--
  STATUS BADGES — keep these current.
  • Netlify: once the site is connected, swap the grey badge for the live deploy
    status badge:
      [![Netlify Status](https://api.netlify.com/api/v1/badges/<SITE_ID>/deploy-status)](https://app.netlify.com/projects/<SITE_NAME>/deploys)
    Find <SITE_ID> under Netlify → Site configuration → Site details → Site ID.
  • Supabase: project is provisioned and the schema is applied. There is no
    per-project status badge; platform health lives at https://status.supabase.com
  • Access: the login wall (Google / magic link / password) is built but is not
    yet switched on in production (see Project status). Update this badge when it
    goes live.
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
| **Convene** | The next meeting front-and-centre plus **future gatherings** (collapsed by default) and a Keiser **"summon a new gathering"**. Each meeting (Keiser can **edit** theme, supporting line, host, date, and time via a pencil): rotating host, editable **observances** + **Keiser's decree** copy (seeded defaults), host **venue** (prefilled from the host, editable here without syncing back to their profile), **RSVP** (the last section of the meeting card; members self-RSVP, the Keiser can RSVP on anyone's behalf), and the Keiser bottle count. Each member can privately log **"your offering"** (inside the card, under Enter the rite) — the wine they plan to bring, hidden from everyone (even the Keiser); once sealed the name is hidden on screen too, with edit/erase controls. **Enter the rite** sits inside the meeting card (above the host line) and appears **only on the day of the meeting**. Moon-phase divider before "Gatherings to come". The whole card is **shareable to WhatsApp** (bold-formatted details + `RSVP here` link, for non-members; the link-preview image is the black-gold logo via OpenGraph). The Keiser can also **cancel** a gathering. |
| **The rite** | Blind scoring — a focused card (a designed gold **cloth medallion** for the wine number `1–20`, from `public/cloths/` (WebP, all preloaded on entry so switching wines is instant; text fallback beyond 20)), 1–10 orb verdict showing its number, random 3–4 aroma prompts per wine from a 100-aroma bank plus **add-your-own**, and notes — plus a **ballot** of every wine you can re-score in one tap, so a later pour can unseat earlier favourites. Sealing **persists the ballot** (`src/lib/ballots.ts`; revising after breaks the seal) and surfaces a **"Proceed to the revelation"** button. |
| **Reveal** | **Locked until every RSVP'd attendee has a sealed ballot** (computed from real ballots, no seed). Scores are **real tallies** — the average of every sealed ballot per cloth. The champion card sits **face-down** (the "Turn the card, crown the goddess" art, `public/reveal-back.webp`) — click to flip, then the ranked bottles rise one by one. Each member **claims their own bottle** (one per soul; claiming pulls in their pre-registered offering; **release** undoes a mistake); titles are click-to-edit. The **Keiser can disqualify** off-theme wines — they lose their rank, fall to the bottom struck-through, and feed the **disqualification ledger** (threshold {5} → expulsion hearing). When all is recorded, **"Commit it to the Annals"** (visible to all, Keiser-only action) locks the result into the codex — after which only the Keiser may amend, and his amendments flow back into the record. Bottle-photo gallery after the reckoning. |
| **Oracle** | Forecasting the moons ahead. **Date polls** (multiple can run at once; any member creates a poll, adds dates, and votes; each date expands an **accordion of who voted**; polls can be **archived/restored**; shareable to WhatsApp). Then the theme idea-pool (propose with an optional supporting line + favour; the Keiser can **edit or delete** themes), and the hosting wheel — sections separated by moon-phase dividers. |
| **Tribunal** | Keiser-only. Petitioners (name + birth-derived sun sign + their answers) + the Council's non-binding tally + the final decree. **Anoint as initiate** creates their account at initiate rank (limited access — Convene, Rite, Reveal only) and drops them into the profile roster, where the Keiser can later **Elevate** them to full member. Also **expulsion hearings**: members with five disqualifications are summoned — all members vote keep/cast-out, the Keiser decrees. |
| **Codex** | a.k.a. **the Annals** — same page, not a separate one. Historical stats, the **committed reckonings** (expandable per gathering), and the **disqualification ledger** with the threshold-of-five flag. Ballot data never reaches the codex until the Keiser's "Commit it to the Annals" on the reveal — that click is the only doorway in. |
| **Profile** | Editable identity — click the avatar circle to upload + crop a portrait, click the name to rename, edit venue instructions, and set date + time of birth. From birth, a set of **read-only, tooltipped** fields is derived (`src/lib/astrology.ts`): western element + sun sign, moon sign (Schlyter lunar longitude), ascendant/rising (approx), and Chinese Shengxiao (animal) + Wu Xing (five-element, with a per-result tooltip). The **Keiser** additionally sees **the council roster** here — every member's account in an accordion, each editable in place (cult name, email, initials, rank, venue instructions, active flag); edits persist (`src/lib/members.ts`) and flow through to where members are listed (Convene RSVP + host picker, Oracle host wheel + poll voters). Reached via the header chip; in open mode it also hosts the "view as" tier switcher, in enforced mode the sign-out. |

## Roles

- **Initiate** — anointed but not yet trusted. Limited access: **Convene, the Rite, and the Reveal only** (no Oracle, Codex, or Tribunal). The intended onboarding path — a prospective member fills the initiation rite, the Keiser anoints them to initiate, then elevates them to full member once they've stood a gathering.
- **Member** — sees everything.
- **Keiser** — super-admin. Final say on membership regardless of the vote, elevates initiates → members from the profile roster, plus hosting and historical edits.

## Notable features

- **Tarot per night** — deterministic draw from the Major Arcana keyed on `(gathering, member)`, so a member's card is fixed for a gathering but re-dealt each event (`src/lib/tarot.ts`).
- **Date voting** — mark every date you can make; the night the most souls can attend leads. A **Share poll** button opens WhatsApp pre-filled with the dates and a link back to the poll (`/oracle`).
- **Keiser-set wine count** — the Keiser fixes how many bottles convene (on Convene) and can add/remove wines mid-rite if the count was off; everyone else sees the count but can't change it. Shared between Convene and the Rite (localStorage in demo; `gatherings.wine_count` when live).
- **Relative re-scoring** — the rite keeps every wine's score, aromas, and notes live at once; a ballot lets you revise any earlier wine while judging a later one (blind tasting is comparative).
- **Aromas** — a 100-aroma bank (`src/lib/aromas.ts`); each wine shows a deterministic random 3–4 as quick prompts (one line on mobile), and the taster can coin new aromas on the spot.
- **Per-member venue instructions** — stored on each member, ready to drop into invites when they host.
- **Branding** — the all-seeing-eye favicon, header logo mark (`public/site-mark.png`), full wordmark logo, and an ornate celestial **card frame** (`public/card-frame.webp`) around the focused wine on the rite; backgrounds keyed to transparency so the art sits on the true-black UI. Header is a single line (logo + "Le Council du Vin") with a compact profile chip — no per-role buttons.

## Roles of access (login)

The login wall is **built but deferred** — turning it on is a deliberate, separate step,
controlled by `NEXT_PUBLIC_ENFORCE_LOGIN` (independent of whether Supabase is connected).

- **Open mode** (`NEXT_PUBLIC_ENFORCE_LOGIN` unset/`false`): every screen is navigable and a
  header role switcher walks all three tiers. Supabase can still be connected for data — the
  wall is simply off. This is the current default so the app is browsable locally and in preview.
- **Enforced** (`NEXT_PUBLIC_ENFORCE_LOGIN=true`, with Supabase env present): every screen
  except the gate and the public petition redirects to login. Signing in isn't enough — the
  email must exist in the `members` table, so a signed-in stranger sees a "pending" screen.
  Three login methods: Google, email magic link, and email + password.

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
- Login wall (Google SSO / magic link / password) + role gating — built. Initiate onboarding wired end to end: petition → Keiser anoints to initiate (limited access) → elevate to member from the profile roster.
- Tarot per night, date-voting poll + WhatsApp share, custom aromas, orb-number verdict, per-member venue instructions.
- GitHub repo + Supabase project provisioned, schema applied.

**Pending**
- **Turn the login wall on in production** — the code is done; enabling is three external steps: (1) fill `NEXT_PUBLIC_SUPABASE_*` in Netlify, (2) enable the Google provider + redirect URLs in Supabase Auth, (3) set `NEXT_PUBLIC_ENFORCE_LOGIN=true`. Until all three, the app stays open/navigable.
- Wire the remaining pages to live Supabase reads/writes (scores, themes, polls, bottle registrations — the `bottles` table needs owner-only RLS until the gathering is revealed).
- Invite screen (theme, date, host venue instructions, full details) + "Share invite to WhatsApp" for non-members.
- Automated invite + reminders — email **two weeks prior**, reminder **two days prior**. Needs: an email provider (e.g. Resend), a scheduler (Supabase `pg_cron` + edge function), and — for automated WhatsApp — the WhatsApp Business API. Manual share links cover the interim.
- Member voting UI on applications (the Council's tally is display-only for now; the Keiser's decree is binding).
- Richer Codex charts.
- Reveal-photo uploads: currently added client-side (session-only object URLs) — wire to Supabase Storage so photos persist and are shared.

_The `MEMORY`/notes for this project live in the assistant's memory, not the repo._
