# Le Council du Vin

> _in vino veritas_

A private web app for a monthly blind wine-tasting society. Each moon, 10–12 members
convene under a rotating theme, bring a bottle, cloak them in numbered black cloths,
score each pour 1–10, then lift the cloths and tally the reckoning.

The aesthetic is **The Deep** — cold black, tarnished gold, hairline strokes, moon
phases and alchemical glyphs. Old-world secret-society, playing off the all-seeing-eye
emblem.

## What it does

| Screen | Purpose |
| --- | --- |
| **Gate** | Landing / sign-in. Members enter; outsiders petition. |
| **Initiation** | Cult-style application — zodiac, governing element, ritual questions, the oath. |
| **Convene** | The current moon: theme, rotating host, date, who's attending. |
| **The rite** | Blind scoring — numbered black cloth, 1–10 orb verdict, aromas, notes. |
| **Reveal** | Cloths lifted, scores tallied, champion + full ranking. |
| **Almanac** | The theme idea-pool (propose + favour) and the hosting wheel. |
| **Tribunal** | Keiser-only. Applicants + the Council's non-binding tally + the final decree. |
| **Codex** | Historical stats and data visualisations. |

## Roles

- **Initiate** — can petition; once anointed, sees the current moon's voting + results only (no history).
- **Member** — sees everything.
- **Keiser** — super-admin. Final say on membership regardless of the vote, plus hosting and historical edits.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (auth + Postgres) · Netlify.

## Running locally

```bash
npm install
npm run dev
```

Without a `.env.local`, the app runs in **demo mode** — every screen is viewable with
seeded content, and the header role switcher lets you walk all three tiers. No writes
happen until Supabase is connected.

## Going live

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor (edit the seeded Keiser email first).
3. Copy `.env.example` → `.env.local` and fill in the Supabase URL + anon key.
4. Restart `npm run dev` — the app leaves demo mode automatically and reads live data.

## Deploy

Push to GitHub, connect the repo to Netlify, set the same env vars in Netlify's build
settings. The `@netlify/plugin-nextjs` plugin (see `netlify.toml`) handles the Next build.
