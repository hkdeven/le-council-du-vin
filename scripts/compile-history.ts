// Compile the Google Forms wine-night exports into ONE master CSV for
// validation before import. Reads every "Wine Night*.csv" in ~/Downloads/
// wine-night-csvs plus the FORMS metadata table below (scraped from the
// form pages), and writes scripts/history-master.csv:
//   one row per wine per night, one column per voter (cult name),
//   plus meeting meta and empty owner/wine/dq columns for the Keiser to fill.
// Most forms have TWO columns per wine (score + free-text comment) — the
// comments are collected per voter and land in the trailing comments column,
// and the importer will write them into ballots.notes so the Nose can mine them.
// Early nights were scored 1-5; those scores are DOUBLED to the app's 1-10
// scale and flagged in the report.
//
// Run: npx tsx scripts/compile-history.ts

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- What was scraped from each form's page -----------------------------
interface FormMeta {
  file: string; // downloaded CSV name (without .csv)
  date: string; // YYYY-MM-DD (from the form title)
  theme: string;
  venue?: string;
  scale: 5 | 10;
}
const FORMS: FormMeta[] = [
  { file: "Wine Night - 7 Feb 2025", date: "2025-02-07", theme: "White - Single Varietal", venue: "La Plage", scale: 5 },
  { file: "Wine Night 25 April 2025", date: "2025-04-25", theme: "Grenache Noir", scale: 5 },
  { file: "Wine Night 31 May 2025", date: "2025-05-31", theme: "Syrah", scale: 10 },
  { file: "Wine Night 15 June 2025", date: "2025-06-15", theme: "Red under R 250", scale: 10 },
  { file: "Wine Night 4 July 2025", date: "2025-07-04", theme: "Riesling", scale: 10 },
  { file: "Wine Night 15 August 2025", date: "2025-08-15", theme: "Cabernet", scale: 10 },
  { file: "Wine Night 5 September 2025", date: "2025-09-05", theme: "Cinsault", scale: 10 },
  { file: "Wine Night 3 October 2025", date: "2025-10-03", theme: "Bubbles", scale: 10 },
  { file: "Wine Night 8 November 2025", date: "2025-11-08", theme: "Viognier", venue: "La Plage II", scale: 10 },
  { file: "Wine Night 5 December 2025", date: "2025-12-05", theme: "Chenin", scale: 10 },
  { file: "Wine Night 23 January 2026", date: "2026-01-23", theme: "Swartland White", scale: 10 },
  { file: "Wine Night 28 March 2026", date: "2026-03-28", theme: "Favourite White", scale: 10 },
  { file: "Wine Night 24 April 2026", date: "2026-04-24", theme: "Who gives a fuck", scale: 10 },
  { file: "Wine Night May 2026", date: "2026-05-22", theme: "Sistas", scale: 10 },
  { file: "Wine Night June 2026", date: "2026-06-06", theme: "Greyton", scale: 10 },
];

// Known email → person mapping. Several souls used more than one address;
// aliases merge into one column. Anything unknown is reported and carried
// through under its email/name so the Keiser can map it during validation.
// All identities confirmed by the Keiser (2026-07-08).
// Current members carry their cult names. Martin Levine, James Badenhorst and
// Dominik Backhaus have NOT registered yet — they keep their real names here;
// the importer holds their ballots back until they register themselves (their
// scores still count toward the annal averages/ranks from the spreadsheet).
// The eight departed souls get initiate-level profiles at import (active=false,
// no notifications) so their votes attribute and they can return one day.
const PEOPLE: Record<string, string> = {
  "hkdeven@gmail.com": "The Keiser",
  "wernardt@innoventum.co.za": "Adept Wernardt",
  "wtoerien@icloud.com": "Adept Wernardt", // Wernardt Toerien
  "admin@innoventum.co.za": "Adept Wernardt", // confirmed his alt
  "larissa@alu-cab.co.za": "Priestess Larissa",
  "3ydesignlarissa@gmail.com": "Priestess Larissa",
  "3ydesignlariss@gmail.com": "Priestess Larissa", // typo'd entry seen Jan 2026
  "3ydesignlarissa@gmail.con": "Priestess Larissa", // typo'd entry seen Nov 2025
  "mattharrisonnnn@gmail.com": "Seer Matthew",
  "m_w_h@icloud.com": "Seer Matthew", // Matthew William Harrison
  "scottlemmer1@gmail.com": "Great Scott",
  // Not registered yet — ballots held until they register manually:
  "martinlevine1964@gmail.com": "Martin Levine",
  "martin@rushmore.co.za": "Martin Levine",
  "jamesmilne.badenhorst@gmail.com": "James Badenhorst",
  "dom.backhaus@gmail.com": "Dominik Backhaus",
  // Departed souls — importer creates initiate profiles (inactive, silent):
  "j.s.hallhuber@gmail.com": "JS Hallhuber",
  "eduard.munkhart@gmail.com": "Eduard Munkhart",
  "djredrichard@gmail.com": "Richard Cawood",
  "mradamredford@gmail.com": "Adam Redford",
  "mazvonmaritzgrist@gmail.com": "Maz",
  "allan.dewar@gmail.com": "Allan Dewar",
  "rkassie@gmail.com": "R Kassie",
  "zahir.mikhail@gmail.com": "Zahir Mikhail",
};
// The May 2025 form recorded names only (no emails).
const NAMES: Record<string, string> = {
  "deven": "The Keiser",
  "d": "The Keiser", // May 2025 entry: everyone else that night is accounted for
  "wernardt": "Adept Wernardt",
  "wernardt toerien": "Adept Wernardt",
  "larissa": "Priestess Larissa",
  "larissa vermeulen": "Priestess Larissa",
  "matthew": "Seer Matthew",
  "matthew william harrison": "Seer Matthew",
  "scott": "Great Scott",
  "martin": "Martin Levine",
  "martin levine": "Martin Levine",
  "james": "James Badenhorst",
  "james milne badenhorst": "James Badenhorst",
  "dominik": "Dominik Backhaus",
};

const DIR = join(homedir(), "Downloads", "wine-night-csvs");

// Minimal CSV parser (quoted fields, commas, newlines-in-quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

interface Wine { cloth: number; label: string; cols: number[] }
interface NightData {
  meta: FormMeta;
  wines: Wine[];
  votes: Map<string, Map<number, number>>; // person -> cloth -> score (1-10 scale)
  comments: Map<string, Map<number, string>>; // person -> cloth -> comment
  issues: string[];
}

const nights: NightData[] = [];
const allVoters = new Set<string>();
const report: string[] = [];
let commentCount = 0;

for (const meta of FORMS) {
  let text: string;
  try {
    text = readFileSync(join(DIR, meta.file + ".csv"), "utf8");
  } catch {
    report.push(`MISSING CSV: ${meta.file}.csv — night skipped for now`);
    continue;
  }
  const rows = parseCsv(text);
  const header = rows[0];
  const issues: string[] = [];

  // Column discovery. Labels can be "1", "12", or "1B" (extra wines);
  // most forms carry TWO columns per label: the score and the comment.
  const emailCol = header.findIndex((h) => /username|email/i.test(h));
  const nameCol = header.findIndex((h) => /^your name$/i.test(h.trim()));
  const byLabel = new Map<string, number[]>();
  const labelOrder: string[] = [];
  header.forEach((h, i) => {
    const m = h.match(/\[Wine\s+(\d+[A-Za-z]?)\]/i) || h.trim().match(/^Wine\s+(\d+[A-Za-z]?)$/i);
    if (!m) return;
    const label = m[1].toUpperCase();
    if (!byLabel.has(label)) { byLabel.set(label, []); labelOrder.push(label); }
    byLabel.get(label)!.push(i);
  });
  // Cloth numbers follow column order, so "1B"/"2B" become the next cloths.
  const wines: Wine[] = labelOrder.map((label, idx) => ({ cloth: idx + 1, label, cols: byLabel.get(label)! }));

  // Latest response per voter wins (revised submissions overwrite earlier).
  const votes = new Map<string, Map<number, number>>();
  const comments = new Map<string, Map<number, string>>();
  for (const r of rows.slice(1)) {
    const email = emailCol >= 0 ? (r[emailCol] || "").trim().toLowerCase() : "";
    const name = nameCol >= 0 ? (r[nameCol] || "").trim() : "";
    const person = PEOPLE[email] || NAMES[name.toLowerCase()] || email || name;
    if (!person) { issues.push("response with no identity skipped"); continue; }
    allVoters.add(person);
    const v = new Map<number, number>();
    const cm = new Map<number, string>();
    for (const w of wines) {
      // Within a label's columns: numeric cell = score, text cell = comment.
      for (const col of w.cols) {
        const raw = (r[col] || "").trim();
        if (!raw) continue;
        const num = Number(raw.replace(",", "."));
        if (Number.isFinite(num)) {
          let score = num;
          if (meta.scale === 5) score = score * 2; // normalise to 1-10
          if (score < 1 || score > 10) issues.push(`${person}: out-of-range score ${score} on wine ${w.label}`);
          if (v.has(w.cloth)) issues.push(`${person}: two scores for wine ${w.label}, kept the last`);
          v.set(w.cloth, score);
        } else {
          cm.set(w.cloth, cm.has(w.cloth) ? cm.get(w.cloth) + "; " + raw : raw);
          commentCount++;
        }
      }
    }
    if (votes.has(person)) issues.push(`${person}: multiple submissions, kept the latest`);
    votes.set(person, v);
    comments.set(person, cm);
  }

  nights.push({ meta, wines, votes, comments, issues });
}

// --- Master CSV ----------------------------------------------------------
const voters = [...allVoters].sort((a, b) => a.localeCompare(b));
const esc = (s: string) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
const lines: string[] = [];
lines.push([
  "meeting", "date", "theme", "venue", "total_score", "cloth", "form_label", "owner", "wine", "dq",
  ...voters,
  "comments",
].map(esc).join(","));

nights.forEach((n, ni) => {
  // Within a night, wines run highest total score first — that's how the
  // Keiser recognises which bottle was whose. Cloth numbers stay untouched.
  const scored = n.wines
    .map((w) => {
      const scores = voters.map((p) => {
        const s = n.votes.get(p)?.get(w.cloth);
        return s == null ? "" : String(s);
      });
      const total = scores.reduce((sum, s) => sum + (s === "" ? 0 : Number(s)), 0);
      return { w, scores, total };
    })
    // Skip fully unscored wines (grid rows beyond the night's real count).
    .filter(({ scores }) => scores.some((s) => s !== ""))
    .sort((a, b) => b.total - a.total);
  for (const { w, scores, total } of scored) {
    const cms = voters
      .map((p) => { const c = n.comments.get(p)?.get(w.cloth); return c ? `${p}: ${c}` : null; })
      .filter(Boolean)
      .join(" | ");
    lines.push([
      String(ni + 1), n.meta.date, n.meta.theme, n.meta.venue || "",
      String(total), String(w.cloth), w.label, "", "", "",
      ...scores, cms || "",
    ].map(esc).join(","));
  }
});

writeFileSync("scripts/history-master.csv", lines.join("\n") + "\n");

// --- Report ---------------------------------------------------------------
console.log("=== COMPILED", nights.length, "nights →", "scripts/history-master.csv ===");
console.log("   ", voters.length, "voters,", commentCount, "tasting comments captured\n");
for (const n of nights) {
  const nComments = [...n.comments.values()].reduce((s, m) => s + m.size, 0);
  console.log(`${n.meta.date}  ${n.meta.theme.padEnd(24)} wines:${String(n.wines.length).padStart(2)}  voters:${n.votes.size}  comments:${String(nComments).padStart(3)}${n.meta.scale === 5 ? "  [1-5 scores doubled]" : ""}`);
  for (const i of n.issues) console.log("   ·", i);
}
if (report.length) { console.log("\n=== MISSING ==="); report.forEach((r) => console.log(" -", r)); }
const unknown = voters.filter((v) => v.includes("@"));
if (unknown.length) {
  console.log("\n=== UNMAPPED VOTERS (add to PEOPLE map or name during validation) ===");
  unknown.forEach((v) => console.log(" -", v));
}
