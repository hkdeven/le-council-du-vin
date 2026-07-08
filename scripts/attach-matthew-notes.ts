// One-time: pour Seer Matthew's notebook (scripts/matthew-notes.txt) into his
// existing sealed ballots so the Nose on his member card mines the words.
//
//   Dry run:  SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/attach-matthew-notes.ts
//   Apply:    SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/attach-matthew-notes.ts --write
//
// Per the Keiser (2026-07-08): no per-wine attribution needed — the notes are
// for his aroma cloud only. Each line becomes its own note entry (so word
// frequency is true), stored under synthetic cloth keys from 1001 up, which no
// wine view ever renders but the Nose mines like any other note. Scores in the
// notebook are stripped; the one results-table block is skipped automatically.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

const WRITE = process.argv.includes("--write");
const MATTHEW_EMAILS = ["mattharrisonnnn@gmail.com", "m_w_h@icloud.com"];
const KEY_BASE = 1001; // synthetic cloth keys live far above any real wine count

// ── parse the notebook into individual note lines ───────────────────────────
const text = readFileSync(path.join(__dirname, "matthew-notes.txt"), "utf8");
const lines: string[] = [];
let skippedResults = 0;
for (const raw of text.split("\n")) {
  const line = raw.trim();
  if (!line) continue;
  // "1a - 4  note", "1b elastic - 3  note", or "6 - 1b - 6  note"
  const m =
    line.match(/^\w+\s*-\s*\w+\s*-\s*([\d.]+)\s+(.+)$/) ||
    line.match(/^[\w ]+?\s*-\s*([\d.]+)\s+(.+)$/);
  if (!m) { skippedResults++; continue; }
  const score = Number(m[1]);
  const note = m[2].trim().replace(/,+$/, "");
  // Results-table rows carry totals (>10) and 3-digit bottle prices — notes never do.
  if (!Number.isFinite(score) || score > 10 || /\d{3}/.test(note)) { skippedResults++; continue; }
  if (note) lines.push(note);
}

async function main() {
  console.log(`Parsed ${lines.length} note lines (${skippedResults} non-note lines skipped).`);

  const env = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SERVICE_ROLE_KEY (env).");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: matthew, error: mErr } = await db
    .from("members").select("id,cult_name,email").in("email", MATTHEW_EMAILS).maybeSingle();
  if (mErr || !matthew) throw new Error(`Could not find Matthew by email: ${mErr?.message || "no row"}`);

  const { data: ballots, error: bErr } = await db
    .from("ballots").select("gathering_id,notes,sealed").eq("member_id", matthew.id).eq("sealed", true);
  if (bErr) throw new Error(bErr.message);
  if (!ballots?.length) throw new Error("Matthew has no sealed ballots to carry the notes.");

  // Spread the lines evenly across his ballots, only into synthetic keys that
  // are still free (re-running never duplicates or clobbers).
  const perBallot = Math.ceil(lines.length / ballots.length);
  let cursor = 0;
  const plan: { gathering_id: string; notes: Record<string, string>; added: number }[] = [];
  for (const b of ballots) {
    const notes = { ...(b.notes as Record<string, string> || {}) };
    const already = Object.keys(notes).filter((k) => Number(k) >= KEY_BASE).length;
    let added = 0;
    for (let k = KEY_BASE + already; added < perBallot - already && cursor < lines.length; k++) {
      if (notes[String(k)]) continue;
      if (Object.values(notes).includes(lines[cursor])) { cursor++; continue; }
      notes[String(k)] = lines[cursor++];
      added++;
    }
    if (added > 0) plan.push({ gathering_id: b.gathering_id as string, notes, added });
  }

  console.log(`Matthew: ${matthew.cult_name} <${matthew.email}> — ${ballots.length} sealed ballots.`);
  for (const p of plan) console.log(`  ballot ${p.gathering_id}: +${p.added} notes`);
  const placed = plan.reduce((n, p) => n + p.added, 0);
  console.log(`${placed}/${lines.length} lines placed.`);
  if (cursor < lines.length) console.log(`NOTE: ${lines.length - cursor} lines left over — increase perBallot logic (shouldn't happen).`);

  if (!WRITE) { console.log("\nDry run only — nothing written. Re-run with --write to apply."); return; }

  for (const p of plan) {
    const { error } = await db.from("ballots").update({ notes: p.notes }).eq("gathering_id", p.gathering_id).eq("member_id", matthew.id);
    if (error) throw new Error(`ballot ${p.gathering_id}: ${error.message}`);
    console.log(`  ✓ ${p.gathering_id}`);
  }
  console.log("\nDone. His cloud now remembers every whisper.");
}

main().catch((e) => { console.error(e); process.exit(1); });
