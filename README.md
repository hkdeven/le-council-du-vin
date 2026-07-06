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
| **Initiation** | Cult-style application — chosen name, zodiac, governing element, ritual questions, the oath. Public; links back to the gate. |
| **Convene** | The current moon: theme, rotating host, date, attendees. The **Keiser sets the bottle count** for the night here. On an official wine night, a **tarot card + reading is dealt to each member**, renewed every gathering. |
| **The rite** | Blind scoring — a focused card (a designed gold **cloth medallion** for the wine number `1–20`, from `public/cloths/` (WebP, all preloaded on entry so switching wines is instant; text fallback beyond 20)), 1–10 orb verdict showing its number, random 3–4 aroma prompts per wine from a 100-aroma bank plus **add-your-own**, and notes — plus a **ballot** of every wine you can re-score in one tap, so a later pour can unseat earlier favourites. |
| **Reveal** | Cloths lifted, scores tallied, champion + full ranking with the shamed last place. A **bottle-lineup photo gallery** (`gathering.reveal_photos[]`, served from `public/reveals/`) sits behind a deliberate click so the off-theme photos never appear automatically; members can **add more photos**, tapping any opens it full-resolution in a new tab, and missing/broken images hide themselves. |
| **Oracle** | Forecasting the moons ahead: a **date-voting poll** (replaces the WhatsApp poll), the theme idea-pool (propose with an optional supporting line + favour; the Keiser can delete themes), and the hosting wheel. |
| **Tribunal** | Keiser-only. Applicants + the Council's non-binding tally + the final decree. |
| **Codex** | Historical stats and data visualisations. |
| **Profile** | Your identity (name, role, star, element, venue instructions). Reached via the header chip; in open mode it also hosts the "view as" tier switcher, in enforced mode the sign-out. |

## Roles

- **Initiate** — can petition; once anointed, sees the current moon's voting + results only (no history).
- **Member** — sees everything.
- **Keiser** — super-admin. Final say on membership regardless of the vote, plus hosting and historical edits.

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

Without a `.env.local`, the app runs in **demo mode** — every screen viewable on seeded
content (`src/lib/seed.ts`), no writes. Add Supabase env (below) to switch to live mode.

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
- Login wall (Google / magic link / password) + role gating — built, not yet switched on in production.
- Tarot per night, date-voting poll + WhatsApp share, custom aromas, orb-number verdict, per-member venue instructions.
- GitHub repo + Supabase project provisioned, schema applied.

**Pending**
- Turn on access/auth in production (env vars in Netlify) — deferred by choice.
- Wire pages from `src/lib/seed.ts` to live Supabase reads/writes (scores, themes, dates, applications).
- Invite screen (theme, date, host venue instructions, full details) + "Share invite to WhatsApp" for non-members.
- Automated invite + reminders — email **two weeks prior**, reminder **two days prior**. Needs: an email provider (e.g. Resend), a scheduler (Supabase `pg_cron` + edge function), and — for automated WhatsApp — the WhatsApp Business API. Manual share links cover the interim.
- Member voting UI on applications; anointing an applicant creates their `members` row.
- Host-facing editor for venue instructions; member profiles; richer Codex charts.
- Reveal-photo uploads: currently added client-side (session-only object URLs) — wire to Supabase Storage so photos persist and are shared.

_The `MEMORY`/notes for this project live in the assistant's memory, not the repo._
