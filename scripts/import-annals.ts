// One-time historical import: scripts/history-master-validated.csv → Supabase.
//
//   Dry run (default, writes nothing):
//     SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-annals.ts
//   Apply:
//     SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-annals.ts --write
//
// What it does, per the Keiser's rulings (2026-07-08):
//  - Nights numbered chronologically (Elgin Whites slots in by date); any
//    app-era gathering not in the import is renumbered to continue after,
//    and a live gathering on the same DATE as an imported night is merged,
//    never duplicated.
//  - Venue prepended to the theme: "La Plage II - Viognier".
//  - 1-5 nights (Feb 7 + Apr 25 2025; the CSV holds doubled values) are
//    remapped linearly so extremes meet extremes: 1→1, 2→3, 3→6, 4→8, 5→10.
//  - Departed souls (+ German, no email known) become initiate profiles,
//    active=false, inserted directly — nothing is emailed, ever.
//  - Unregistered voters' ballots are HELD (annal averages still count their
//    scores); anyone found live by email imports normally. James registered
//    2026-07-08, so only Dominik Backhaus should show as held. Re-run the
//    importer once he registers and his held ballots slot in.
//  - Owner "Vin Iconnu" (and blanks) stay unowned — claimable in the codex.
//  - Julia and Mickey are credited by name only (guests, no profiles).
//  - Every voter's per-wine comments land in ballots.notes (the Nose reads them).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

const WRITE = process.argv.includes("--write");
const CREATE_UNREGISTERED = false; // flip if the Keiser rules James + Dominik get silent accounts

const ROOT = path.join(__dirname, "..");
const CSV = path.join(__dirname, "history-master-validated.csv");

// ── people ──────────────────────────────────────────────────────────────────
type Person = {
  name: string;             // canonical name (used as cult_name if we create them)
  emails: string[];         // any address seen for them in the forms
  kind: "existing" | "departed" | "unregistered" | "guest";
};
const PEOPLE: Person[] = [
  { name: "The Keiser", emails: ["hkdeven@gmail.com"], kind: "existing" },
  { name: "Adept Wernardt", emails: ["wernardt@innoventum.co.za", "wtoerien@icloud.com", "admin@innoventum.co.za"], kind: "existing" },
  { name: "Priestess Larissa", emails: ["3ydesignlarissa@gmail.com", "larissa@alu-cab.co.za"], kind: "existing" },
  { name: "Seer Matthew", emails: ["mattharrisonnnn@gmail.com", "m_w_h@icloud.com"], kind: "existing" },
  { name: "Great Scott", emails: ["scottlemmer1@gmail.com"], kind: "existing" },
  { name: "Martin Levine", emails: ["martin@rushmore.co.za", "martinlevine1964@gmail.com"], kind: "existing" },
  { name: "James Badenhorst", emails: ["jamesmilne.badenhorst@gmail.com"], kind: "unregistered" },
  { name: "Dominik Backhaus", emails: ["dom.backhaus@gmail.com"], kind: "unregistered" },
  { name: "JS Hallhuber", emails: ["j.s.hallhuber@gmail.com"], kind: "departed" },
  { name: "Eduard Munkhart", emails: ["eduard.munkhart@gmail.com"], kind: "departed" },
  { name: "Richard Cawood", emails: ["djredrichard@gmail.com"], kind: "departed" },
  { name: "Adam Redford", emails: ["mradamredford@gmail.com"], kind: "departed" },
  { name: "Maz", emails: ["mazvonmaritzgrist@gmail.com"], kind: "departed" },
  { name: "Allan Dewar", emails: ["allan.dewar@gmail.com"], kind: "departed" },
  { name: "R Kassie", emails: ["rkassie@gmail.com"], kind: "departed" },
  { name: "Zahir Mikhail", emails: ["zahir.mikhail@gmail.com"], kind: "departed" },
  // No email ever seen for these three — placeholder addresses; the Keiser
  // can amend them in the roster if any of them ever surfaces.
  { name: "German", emails: ["german.unknown@lecouncilduvin.co.za"], kind: "departed" },
  { name: "Julia", emails: ["julia.unknown@lecouncilduvin.co.za"], kind: "departed" },
  { name: "Mickey", emails: ["mickey.unknown@lecouncilduvin.co.za"], kind: "departed" },
];
const personByName = new Map(PEOPLE.map((p) => [p.name.toLowerCase(), p]));

// Keiser's shorthand in the owner column → canonical person / guest / unowned.
const OWNER_ALIASES: Record<string, string> = {
  allan: "Allan Dewar", james: "James Badenhorst", larissa: "Priestess Larissa",
  deven: "The Keiser", maz: "Maz", martin: "Martin Levine", scott: "Great Scott",
  wernardt: "Adept Wernardt", matthew: "Seer Matthew", dominik: "Dominik Backhaus",
  dominick: "Dominik Backhaus", richard: "Richard Cawood", german: "German",
  julia: "Julia", mickey: "Mickey", // inactive initiate profiles (Keiser ruling 2026-07-08)
  "vin iconnu": "", "vin inconnu": "", // unknown: unowned, claimable in the codex
};

// Nights recorded on a 1-5 scale; the compiler doubled them into the CSV.
// Undouble, then map extremes to extremes: 1→1, 2→3, 3→6, 4→8, 5→10.
const SCALE5_DATES = new Set(["2025-02-07", "2025-04-25"]);
const LINEAR5 = [0, 1, 3, 6, 8, 10]; // index = original 1-5 score

// ── csv (semicolon-delimited, quoted fields possible) ───────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ";") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

// ── load + shape the nights ──────────────────────────────────────────────────
interface WineRow { cloth: number; title: string; owner: string; dq: boolean; scores: Map<string, number>; comments: Map<string, string>; rawTotal: number }
interface Night { date: string; theme: string; venue: string; title: string; wines: WineRow[]; scale5: boolean; scoresKnown: boolean }

const raw = parseCsv(readFileSync(CSV, "utf8"));
const header = raw[0].map((h) => h.trim());
const voterCols: { idx: number; person: Person }[] = [];
for (let i = 0; i < header.length; i++) {
  const p = personByName.get(header[i].toLowerCase());
  if (p) voterCols.push({ idx: i, person: p });
}
const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name);
const C = { date: col("date"), theme: col("theme"), venue: col("venue"), total: col("total_score"), cloth: col("cloth"), owner: col("owner"), wine: col("wine"), dq: col("dq"), comments: col("comments") };

const nights = new Map<string, Night>();
const warnings: string[] = [];

for (const r of raw.slice(1)) {
  const date = (r[C.date] || "").trim();
  if (!date) continue;
  const theme = (r[C.theme] || "").trim();
  const venue = (r[C.venue] || "").trim();
  let night = nights.get(date);
  if (!night) {
    night = { date, theme, venue, title: venue ? `${venue} - ${theme}` : theme, wines: [], scale5: SCALE5_DATES.has(date), scoresKnown: true };
    nights.set(date, night);
  }
  const ownerRaw = (r[C.owner] || "").trim();
  const ownerKey = ownerRaw.toLowerCase();
  let owner: string;
  if (!ownerRaw) owner = "";
  else if (ownerKey in OWNER_ALIASES) owner = OWNER_ALIASES[ownerKey];
  else if (personByName.has(ownerKey)) owner = personByName.get(ownerKey)!.name;
  else { owner = ownerRaw; warnings.push(`Unknown owner "${ownerRaw}" on ${date} cloth ${r[C.cloth]} — imported verbatim`); }

  const wine: WineRow = {
    cloth: Number(r[C.cloth]) || night.wines.length + 1,
    title: (r[C.wine] || "").trim(),
    owner,
    dq: !!(r[C.dq] || "").trim(),
    scores: new Map(),
    comments: new Map(),
    rawTotal: Number((r[C.total] || "0").replace(",", ".")) || 0,
  };
  for (const { idx, person } of voterCols) {
    const v = (r[idx] || "").trim();
    if (v === "") continue;
    let s = Number(v.replace(",", "."));
    if (!Number.isFinite(s)) continue;
    if (night.scale5) s = LINEAR5[Math.round(s / 2)] ?? s; // CSV holds doubled 1-5
    wine.scores.set(person.name, Math.max(1, Math.min(10, Math.round(s))));
  }
  // "Name: text | Name: text" — names are canonical in the compiled file.
  const cm = (r[C.comments] || "").trim();
  if (cm) {
    for (const seg of cm.split(/ \| (?=[A-Z])/)) {
      const m = seg.match(/^([^:]+): ([\s\S]+)$/);
      if (!m) continue;
      const p = personByName.get(m[1].trim().toLowerCase());
      if (p) wine.comments.set(p.name, m[2].trim());
    }
  }
  night.wines.push(wine);
}

// Elgin Whites (or any night) with no per-voter scores: rank from the totals,
// but store votes=0 so no average is shown until the Keiser supplies the scale.
for (const n of nights.values()) {
  if (n.wines.every((w) => w.scores.size === 0)) {
    n.scoresKnown = false;
    warnings.push(`${n.date} ${n.theme}: no per-voter scores — ranked from totals, averages hidden (amend in the codex when known)`);
  }
}

const ordered = [...nights.values()].sort((a, b) => a.date.localeCompare(b.date));

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes("--parse")) {
    // Offline sanity pass: no database, just the shaped nights.
    console.log(`Parsed ${ordered.length} nights:`);
    ordered.forEach((n, i) => {
      const voters = new Set<string>(); n.wines.forEach((w) => w.scores.forEach((_, nm) => voters.add(nm)));
      const notes = n.wines.reduce((s, w) => s + w.comments.size, 0);
      console.log(`  ${String(i + 1).padStart(2)}. ${n.date}  ${n.title.padEnd(40)} wines:${String(n.wines.length).padStart(2)} voters:${String(voters.size).padStart(2)} notes:${String(notes).padStart(3)}${n.scale5 ? "  [1-5 remapped]" : ""}${!n.scoresKnown ? "  [ranks only]" : ""}`);
      for (const w of n.wines) {
        if (!w.owner) console.log(`        unowned: cloth ${w.cloth} ${w.title || "(unnamed)"}`);
      }
    });
    if (warnings.length) { console.log("Warnings:"); warnings.forEach((w) => console.log(`  ! ${w}`)); }
    return;
  }
  const env = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SERVICE_ROLE_KEY (env).");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: liveMembers, error: mErr } = await db.from("members").select("id,email,cult_name,role,active");
  if (mErr) throw new Error(mErr.message);
  const byEmail = new Map((liveMembers || []).map((m) => [(m.email as string).toLowerCase(), m]));

  // Resolve every person: existing row, to-create, or held.
  const resolved = new Map<string, { member?: { id: string; cult_name: string }; create?: boolean; hold?: boolean }>();
  for (const p of PEOPLE) {
    const hit = p.emails.map((e) => byEmail.get(e.toLowerCase())).find(Boolean);
    if (hit) resolved.set(p.name, { member: { id: hit.id as string, cult_name: hit.cult_name as string } });
    else if (p.kind === "departed") resolved.set(p.name, { create: true });
    else if (p.kind === "unregistered") resolved.set(p.name, CREATE_UNREGISTERED ? { create: true } : { hold: true });
    else resolved.set(p.name, { hold: true }); // an "existing" member missing live is a problem
  }
  const missingExisting = PEOPLE.filter((p) => p.kind === "existing" && !resolved.get(p.name)?.member);
  if (missingExisting.length) {
    console.error("ABORT — these members should exist in the live DB but were not found by email:");
    for (const p of missingExisting) console.error(`  ${p.name} (${p.emails.join(", ")})`);
    process.exit(1);
  }

  // Owner display string: the LIVE cult_name where one exists (chalices key on it).
  const ownerName = (canonical: string) => resolved.get(canonical)?.member?.cult_name ?? canonical;

  const { data: liveGatherings } = await db.from("gatherings").select("id,number,theme_title,gather_date,status");
  const byDate = new Map((liveGatherings || []).map((g) => [g.gather_date as string, g]));

  const report: string[] = [];
  const creations = PEOPLE.filter((p) => resolved.get(p.name)?.create);
  report.push(`\n=== PROFILES TO CREATE (initiate, inactive, silent — no email sent) ===`);
  for (const p of creations) report.push(`  ${p.name} <${p.emails[0]}>${p.name === "German" ? "  [placeholder address — no email known]" : ""}`);
  const held = PEOPLE.filter((p) => resolved.get(p.name)?.hold);
  if (held.length) {
    report.push(`\n=== BALLOTS HELD (must register themselves; re-run after) ===`);
    for (const p of held) report.push(`  ${p.name} — scores still count toward every night's averages/ranks`);
  }

  report.push(`\n=== NIGHTS (${ordered.length}, numbered chronologically) ===`);
  const plans: { number: number; night: Night; existing?: { id: string } }[] = [];
  ordered.forEach((night, i) => {
    const existing = byDate.get(night.date);
    plans.push({ number: i + 1, night, existing: existing ? { id: existing.id as string } : undefined });
    const voters = new Set<string>(); night.wines.forEach((w) => w.scores.forEach((_, n) => voters.add(n)));
    const notes = night.wines.reduce((n, w) => n + w.comments.size, 0);
    report.push(
      `  ${String(i + 1).padStart(2)}. ${night.date}  ${night.title.padEnd(38)} wines:${String(night.wines.length).padStart(2)}` +
      ` voters:${String(voters.size).padStart(2)} notes:${String(notes).padStart(3)}` +
      `${night.scale5 ? "  [1-5 remapped 1→1,2→3,3→6,4→8,5→10]" : ""}${!night.scoresKnown ? "  [NO SCORES — ranks only]" : ""}` +
      `${existing ? `  [MERGES into live gathering ${existing.number ?? "?"}]` : ""}`
    );
    const unowned = night.wines.filter((w) => !w.owner);
    if (unowned.length) report.push(`        unowned (claimable): ${unowned.map((w) => w.title || `cloth ${w.cloth}`).join("; ")}`);
    const guests = night.wines.filter((w) => w.owner === "Julia" || w.owner === "Mickey");
    if (guests.length) report.push(`        owned by new inactive profiles: ${guests.map((w) => `${w.title} (${w.owner})`).join("; ")}`);
  });

  // App-era gatherings (not merged) get renumbered to continue the chronology.
  const importDates = new Set(ordered.map((n) => n.date));
  const appEra = (liveGatherings || [])
    .filter((g) => !importDates.has(g.gather_date as string))
    .sort((a, b) => ((a.gather_date as string) || "").localeCompare((b.gather_date as string) || ""));
  if (appEra.length) {
    report.push(`\n=== APP-ERA GATHERINGS RENUMBERED ===`);
    appEra.forEach((g, i) => report.push(`  ${g.theme_title || g.id} (${g.gather_date}): ${g.number} → ${ordered.length + i + 1}`));
  }
  if (warnings.length) {
    report.push(`\n=== WARNINGS ===`);
    warnings.forEach((w) => report.push(`  ! ${w}`));
  }
  console.log(report.join("\n"));

  if (!WRITE) {
    console.log(`\nDry run only — nothing written. Re-run with --write to apply.`);
    return;
  }

  // ── write ──────────────────────────────────────────────────────────────────
  console.log("\nWriting…");
  // 1. profiles
  for (const p of creations) {
    const { data, error } = await db.from("members").upsert(
      { email: p.emails[0], cult_name: p.name, short_name: p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), role: "initiate", active: false },
      { onConflict: "email" }
    ).select("id,cult_name").single();
    if (error) throw new Error(`create ${p.name}: ${error.message}`);
    resolved.set(p.name, { member: { id: data.id, cult_name: data.cult_name } });
  }
  // 2. nights
  for (const { number, night, existing } of plans) {
    const rows = night.wines.map((w) => {
      const vals = [...w.scores.values()];
      const votes = vals.length;
      const score = votes ? Math.round((vals.reduce((s, v) => s + v, 0) / votes) * 10) / 10 : 0;
      return { cloth: w.cloth, owner: ownerName(w.owner) || "", title: w.title, score, votes, dq: w.dq, rawTotal: w.rawTotal };
    });
    const rankable = rows.filter((r) => !r.dq);
    const keyOf = (r: (typeof rows)[number]) => (night.scoresKnown ? r.score : r.rawTotal);
    const annalRows = rows.map((r) => ({
      cloth: r.cloth, owner: r.owner, title: r.title, score: r.score, votes: r.votes, dq: r.dq,
      rank: r.dq ? null : 1 + rankable.filter((x) => keyOf(x) > keyOf(r)).length,
    }));
    const attendees = [...new Set(night.wines.flatMap((w) => [...w.scores.keys()]))]
      .map((n) => resolved.get(n)?.member?.id).filter(Boolean);
    const gRow = {
      number, moon_label: "A moon remembered", theme_title: night.title, theme_description: null,
      gather_date: night.date, gather_time: "19:00", status: "revealed", wine_count: night.wines.length,
      attendees,
    };
    let gid: string;
    if (existing) {
      const { error } = await db.from("gatherings").update(gRow).eq("id", existing.id);
      if (error) throw new Error(`merge gathering ${night.date}: ${error.message}`);
      gid = existing.id;
    } else {
      const { data, error } = await db.from("gatherings").insert(gRow).select("id").single();
      if (error) throw new Error(`insert gathering ${night.date}: ${error.message}`);
      gid = data.id;
    }
    const { error: aErr } = await db.from("annals").upsert(
      { gathering_id: gid, number, theme: night.title, date: night.date, rows: annalRows, committed_at: new Date().toISOString() },
      { onConflict: "gathering_id" }
    );
    if (aErr) throw new Error(`annal ${night.date}: ${aErr.message}`);
    // 3. ballots for registered voters
    const perVoter = new Map<string, { scores: Record<number, number>; notes: Record<number, string> }>();
    for (const w of night.wines) {
      for (const [name, s] of w.scores) {
        const v = perVoter.get(name) || { scores: {}, notes: {} };
        v.scores[w.cloth] = s; perVoter.set(name, v);
      }
      for (const [name, c] of w.comments) {
        const v = perVoter.get(name) || { scores: {}, notes: {} };
        v.notes[w.cloth] = c; perVoter.set(name, v);
      }
    }
    for (const [name, b] of perVoter) {
      const m = resolved.get(name)?.member;
      if (!m) continue; // held (unregistered) — re-run adds them later
      const { error } = await db.from("ballots").upsert(
        { gathering_id: gid, member_id: m.id, scores: b.scores, sealed: true, aromas: {}, notes: b.notes, updated_at: new Date().toISOString() },
        { onConflict: "gathering_id,member_id" }
      );
      if (error) throw new Error(`ballot ${name} ${night.date}: ${error.message}`);
    }
    console.log(`  ✓ ${number}. ${night.date} ${night.title}`);
  }
  // 4. renumber app-era
  for (let i = 0; i < appEra.length; i++) {
    const g = appEra[i]; const newNum = ordered.length + i + 1;
    if (g.number === newNum) continue;
    const { error } = await db.from("gatherings").update({ number: newNum }).eq("id", g.id);
    if (error) throw new Error(`renumber ${g.id}: ${error.message}`);
    await db.from("annals").update({ number: newNum }).eq("gathering_id", g.id);
    console.log(`  ✓ renumbered ${g.theme_title || g.id} → ${newNum}`);
  }
  console.log("\nDone. The codex now remembers.");
}

main().catch((e) => { console.error(e); process.exit(1); });
