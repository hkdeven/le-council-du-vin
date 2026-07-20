// One-time data fix: link Dominik's past to the account he just registered.
//
// Dominik Backhaus voted and brought bottles across sixteen imported nights,
// but at import time he was still "unregistered" (import-annals.ts, kind
// "unregistered", CREATE_UNREGISTERED=false). So — unlike the departed souls —
// NO placeholder member row was ever made for him. Two threads of his past are
// therefore loose:
//   1. His per-wine scores were folded into every night's averages/ranks, but
//      his own sealed ballots (his verdicts + his whispered notes) were HELD,
//      never written. The importer's own note: "Re-run once he registers and
//      his held ballots slot in."
//   2. The bottles he brought are credited in the annals to the owner STRING
//      "Dominik Backhaus". The app recognises "this bottle is mine" by matching
//      cult_name === owner (src/app/codex/page.tsx), so that string must equal
//      his account's name for his crowns to be his.
//
// He now holds a real account, cult_name "dominiko". Per the Keiser's ruling,
// his history stays under that handle. This script, in one pass:
//   - re-credits every annal row  "Dominik Backhaus" -> "dominiko"
//   - reconstructs his HELD ballots from history-master-validated.csv and seals
//     them under his new account (scores + notes, cloth-keyed, exactly as the
//     importer would have)
//   - adds him to gatherings.attendees for the nights he scored
//
// If a placeholder member for him is ever found (e.g. the importer was re-run
// with CREATE_UNREGISTERED flipped), the script instead re-points that row's id
// references to his account and erases the orphan — the Julia path — so it is
// safe to run either way.
//
//   Dry run (default, writes nothing):
//     SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-dominik.ts
//   Apply:
//     SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-dominik.ts --write
//
// The new account is found by cult_name containing "dominiko" (override with
// --to <email>); the historical owner string is "Dominik Backhaus" (override
// with --name "..."). Nothing is emailed, ever.
//
// Verification: victory and disqualification tallies are reckoned before and
// after — the totals must not move by a single crown; only the name credited
// changes. The script aborts before writing if they would.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

const WRITE = process.argv.includes("--write");
const argOf = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const HISTORICAL_NAME = argOf("--name") || "Dominik Backhaus"; // owner string in the annals AND his voter column header
const HISTORICAL_EMAILS = ["dom.backhaus@gmail.com"]; // any placeholder would carry this
const TO_EMAIL = argOf("--to")?.toLowerCase();

const CSV = path.join(__dirname, "history-master-validated.csv");
// Mirror import-annals.ts exactly so reconstructed ballots match the codex.
const SCALE5_DATES = new Set(["2025-02-07", "2025-04-25"]);
const LINEAR5 = [0, 1, 3, 6, 8, 10]; // index = original 1-5 score (CSV holds it doubled)

interface AnnalRow { cloth: number | null; owner: string; title: string; score: number; votes: number; rank: number | null; dq: boolean; varietals?: string[]; price?: number | null }

// Who took a night — mirrors championsOf() in src/lib/annals.ts, so the
// verification counts crowns exactly as the app does.
function championsOf(rows: AnnalRow[]): AnnalRow[] {
  const crowned = rows.filter((r) => r.rank === 1 && !r.dq);
  if (crowned.length) return crowned;
  const qualified = rows.filter((r) => !r.dq);
  if (!qualified.length) return [];
  const scored = qualified.filter((r) => r.votes > 0);
  if (scored.length) {
    const top = Math.max(...scored.map((r) => r.score));
    return scored.filter((r) => r.score === top);
  }
  const substantial = qualified.filter((r) => r.owner || r.title);
  return substantial.length ? [substantial[0]] : [];
}

function tallies(annals: { rows: AnnalRow[] }[]): { victories: Record<string, number>; dq: Record<string, number> } {
  const victories: Record<string, number> = {};
  const dq: Record<string, number> = {};
  for (const a of annals) {
    for (const c of championsOf(a.rows)) if (c.owner) victories[c.owner] = (victories[c.owner] || 0) + 1;
    for (const r of a.rows) if (r.dq && r.owner) dq[r.owner] = (dq[r.owner] || 0) + 1;
  }
  return { victories, dq };
}
const sum = (rec: Record<string, number>) => Object.values(rec).reduce((s, n) => s + n, 0);

// ── csv (semicolon-delimited, quoted fields possible) — copied from importer ──
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

interface HeldBallot { scores: Record<number, number>; notes: Record<number, string> }

// Reconstruct Dominik's held ballots straight from the source CSV, keyed by
// gather date -> cloth -> value, applying the same 1-5 remap the importer used.
function heldBallotsByDate(): Map<string, HeldBallot> {
  const raw = parseCsv(readFileSync(CSV, "utf8"));
  const header = raw[0].map((h) => h.trim());
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name);
  const C = { date: col("date"), cloth: col("cloth"), comments: col("comments") };
  const domCol = header.findIndex((h) => h.toLowerCase() === HISTORICAL_NAME.toLowerCase());
  if (domCol < 0) throw new Error(`No "${HISTORICAL_NAME}" column in the CSV — check --name.`);

  const byDate = new Map<string, HeldBallot>();
  for (const r of raw.slice(1)) {
    const date = (r[C.date] || "").trim();
    if (!date) continue;
    const cloth = Number(r[C.cloth]);
    if (!Number.isFinite(cloth)) continue;
    const scale5 = SCALE5_DATES.has(date);
    const entry = byDate.get(date) || { scores: {}, notes: {} };

    const v = (r[domCol] || "").trim();
    if (v !== "") {
      let s = Number(v.replace(",", "."));
      if (Number.isFinite(s)) {
        if (scale5) s = LINEAR5[Math.round(s / 2)] ?? s; // CSV holds doubled 1-5
        entry.scores[cloth] = Math.max(1, Math.min(10, Math.round(s)));
      }
    }
    const cm = (r[C.comments] || "").trim();
    if (cm) {
      for (const seg of cm.split(/ \| (?=[A-Z])/)) {
        const m = seg.match(/^([^:]+): ([\s\S]+)$/);
        if (m && m[1].trim().toLowerCase() === HISTORICAL_NAME.toLowerCase()) entry.notes[cloth] = m[2].trim();
      }
    }
    byDate.set(date, entry);
  }
  // Keep only nights where he actually left a verdict or a note.
  for (const [date, b] of [...byDate]) {
    if (!Object.keys(b.scores).length && !Object.keys(b.notes).length) byDate.delete(date);
  }
  return byDate;
}

async function main() {
  const env = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SERVICE_ROLE_KEY (env).");
  const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

  // ── resolve the target account (the one he just registered) ───────────────
  const { data: members, error: mErr } = await db.from("members").select("id,email,cult_name,role,active");
  if (mErr) throw new Error(mErr.message);
  let target = TO_EMAIL
    ? (members || []).find((m) => (m.email as string).toLowerCase() === TO_EMAIL)
    : (() => {
        const named = (members || []).filter((m) => /dominiko/i.test(m.cult_name as string));
        return named.find((m) => m.active) || named[0]
          || (members || []).filter((m) => /dominik/i.test(m.cult_name as string)
              && (m.cult_name as string).toLowerCase() !== HISTORICAL_NAME.toLowerCase()).find((m) => m.active);
      })();
  if (!target) {
    throw new Error(TO_EMAIL
      ? `No account carries ${TO_EMAIL}.`
      : `Couldn't find the new account by name (looked for "dominiko"). Pass his email: --to <email>.`);
  }
  const newId = target.id as string, newName = target.cult_name as string;

  // ── an old placeholder member? (only if the importer was re-run with the
  //    unregistered flag flipped) — must be a DIFFERENT row from the target ───
  const oldPlaceholder = (members || []).find((m) => m.id !== newId
    && (HISTORICAL_EMAILS.includes((m.email as string).toLowerCase())
        || (m.cult_name as string).toLowerCase() === HISTORICAL_NAME.toLowerCase()));
  const oldId = oldPlaceholder?.id as string | undefined;

  console.log(`New account: ${newName} <${target.email}> (${newId}) — role ${target.role}, active ${target.active}`);
  console.log(oldPlaceholder
    ? `Old placeholder: ${oldPlaceholder.cult_name} <${oldPlaceholder.email}> (${oldId}) — will be re-pointed and erased.`
    : `No placeholder member for "${HISTORICAL_NAME}" — his ballots were held; they'll be forged from the CSV.`);
  console.log("");

  // ── annals: re-credit the owner string ────────────────────────────────────
  const { data: annals, error: aErr } = await db.from("annals").select("gathering_id,number,theme,date,rows");
  if (aErr) throw new Error(aErr.message);
  const before = tallies((annals || []) as { rows: AnnalRow[] }[]);

  const annalPatches: { gathering_id: string; theme: string; date: string; rows: AnnalRow[]; touched: string[] }[] = [];
  for (const a of annals || []) {
    const rows = (a.rows as AnnalRow[]) || [];
    const touched = rows.filter((r) => r.owner === HISTORICAL_NAME).map((r) => r.title || `cloth ${r.cloth}`);
    if (!touched.length) continue;
    annalPatches.push({
      gathering_id: a.gathering_id, theme: a.theme, date: a.date, touched,
      rows: rows.map((r) => (r.owner === HISTORICAL_NAME ? { ...r, owner: newName } : r)),
    });
  }
  console.log(`Annal rows to re-credit ("${HISTORICAL_NAME}" -> "${newName}"):`);
  if (!annalPatches.length) console.log("  none (already migrated?)");
  for (const p of annalPatches) console.log(`  ${p.date}  ${p.theme}: ${p.touched.join("; ")}`);

  // Verify: re-reckon crowns/marks with the patched rows — totals must hold.
  const patchedAnnals = (annals || []).map((a) => {
    const p = annalPatches.find((x) => x.gathering_id === a.gathering_id);
    return { rows: (p ? p.rows : (a.rows as AnnalRow[])) || [] };
  });
  const after = tallies(patchedAnnals);
  const moved = {
    victories: { from: before.victories[HISTORICAL_NAME] || 0, to: (after.victories[newName] || 0) - (before.victories[newName] || 0) },
    dq: { from: before.dq[HISTORICAL_NAME] || 0, to: (after.dq[newName] || 0) - (before.dq[newName] || 0) },
  };
  console.log(`\nTallies: ${sum(before.victories)} victories and ${sum(before.dq)} disqualifications before; ` +
    `${sum(after.victories)} and ${sum(after.dq)} after.`);
  console.log(`  "${HISTORICAL_NAME}"'s ${moved.victories.from} crown(s) and ${moved.dq.from} mark(s) pass to "${newName}".`);
  if (sum(before.victories) !== sum(after.victories) || sum(before.dq) !== sum(after.dq)
    || moved.victories.from !== moved.victories.to || moved.dq.from !== moved.dq.to) {
    throw new Error("ABORT — the totals would shift; a crown or mark would be lost or invented.");
  }

  // ── gatherings (by date) for ballot targeting + attendee credit ───────────
  const { data: gatherings } = await db.from("gatherings")
    .select("id,number,gather_date,attendees,host_id,host_name,host2_id,host2_name,prophecy");
  const gByDate = new Map((gatherings || []).map((g) => [g.gather_date as string, g]));

  // Held path (the expected one): forge his ballots from the CSV. If a
  // placeholder exists instead, his ballots already live under it — re-point,
  // don't duplicate.
  const held = oldPlaceholder ? new Map<string, HeldBallot>() : heldBallotsByDate();

  const ballotPlan: { gid: string; date: string; number: number | null; scores: Record<number, number>; notes: Record<number, string>; verb: "create" | "update" }[] = [];
  const attendeeAdds: { gid: string; date: string; attendees: string[] }[] = [];
  const orphanDates: string[] = [];
  if (!oldPlaceholder) {
    // Which gatherings does the target already hold a ballot for? (idempotency)
    const { data: hisBallots } = await db.from("ballots").select("gathering_id").eq("member_id", newId);
    const hasBallot = new Set((hisBallots || []).map((b) => b.gathering_id as string));
    for (const [date, b] of [...held].sort((x, y) => x[0].localeCompare(y[0]))) {
      const g = gByDate.get(date);
      if (!g) { orphanDates.push(date); continue; }
      const gid = g.id as string;
      ballotPlan.push({ gid, date, number: (g.number as number) ?? null, scores: b.scores, notes: b.notes, verb: hasBallot.has(gid) ? "update" : "create" });
      const att = (g.attendees as string[]) || [];
      if (!att.includes(newId)) attendeeAdds.push({ gid, date, attendees: [...new Set([...att, newId])] });
    }
    console.log(`\nHeld ballots to seal for "${newName}" (${ballotPlan.length} night(s)):`);
    for (const p of ballotPlan) {
      const nS = Object.keys(p.scores).length, nN = Object.keys(p.notes).length;
      console.log(`  ${p.date}  #${p.number ?? "?"}: ${nS} verdict(s), ${nN} note(s)  [${p.verb}]`);
    }
    if (orphanDates.length) console.log(`  ! no live gathering on: ${orphanDates.join(", ")} — skipped (run the importer first?)`);
    console.log(`Attendee lists to extend: ${attendeeAdds.length}`);
  }

  // ── placeholder path: id references to re-point (Julia-style) ─────────────
  const idWork: [string, string][] = [
    ["ballots", "member_id"], ["scores", "member_id"], ["offerings", "member_id"],
    ["bottles", "member_id"], ["theme_favours", "member_id"], ["application_votes", "member_id"],
    ["wines", "brought_by"], ["themes", "proposed_by"],
  ];
  const gPatches: { id: string; patch: Record<string, unknown> }[] = [];
  const pollPatches: { id: string; options: unknown }[] = [];
  if (oldPlaceholder) {
    const countRows = async (table: string, colName: string) => {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq(colName, oldId);
      return error ? `? (${error.message})` : count || 0;
    };
    console.log("\nId references to re-point (placeholder -> account):");
    for (const [table, colName] of idWork) console.log(`  ${table}.${colName}: ${await countRows(table, colName)}`);

    for (const g of gatherings || []) {
      const patch: Record<string, unknown> = {};
      const att = (g.attendees as string[]) || [];
      if (att.includes(oldId!)) patch.attendees = [...new Set(att.map((x) => (x === oldId ? newId : x)))];
      if (g.host_id === oldId) { patch.host_id = newId; patch.host_name = newName; }
      else if (g.host_name === HISTORICAL_NAME) patch.host_name = newName;
      if (g.host2_id === oldId) { patch.host2_id = newId; patch.host2_name = newName; }
      else if (g.host2_name === HISTORICAL_NAME) patch.host2_name = newName;
      const pr = g.prophecy as { member_id?: string; name?: string } | null;
      if (pr && (pr.member_id === oldId || pr.name === HISTORICAL_NAME)) patch.prophecy = { ...pr, member_id: newId, name: newName };
      if (Object.keys(patch).length) gPatches.push({ id: g.id as string, patch });
    }
    console.log(`  gatherings (attendees/hosts/prophecy): ${gPatches.length}`);

    const { data: polls } = await db.from("polls").select("id,options");
    for (const p of polls || []) {
      const options = (p.options as { id: string; date: string; voters: string[] }[]) || [];
      if (!options.some((o) => (o.voters || []).includes(oldId!))) continue;
      pollPatches.push({
        id: p.id as string,
        options: options.map((o) => ({ ...o, voters: [...new Set((o.voters || []).map((v) => (v === oldId ? newId : v)))] })),
      });
    }
    console.log(`  polls (date votes): ${pollPatches.length}`);
  }

  if (!WRITE) {
    console.log("\nDry run only — nothing written. Re-run with --write to apply.");
    return;
  }

  // ── write ─────────────────────────────────────────────────────────────────
  console.log("\nWriting…");
  for (const p of annalPatches) {
    const { error } = await db.from("annals").update({ rows: p.rows }).eq("gathering_id", p.gathering_id);
    if (error) throw new Error(`annal ${p.date}: ${error.message}`);
    console.log(`  ✓ annal ${p.date} ${p.theme}`);
  }

  if (oldPlaceholder) {
    for (const [table, colName] of idWork) {
      // Rows the account already owns would collide on unique keys; report.
      const { error } = await db.from(table).update({ [colName]: newId }).eq(colName, oldId);
      if (error) console.warn(`  ! ${table}.${colName}: ${error.message} — resolve by hand`);
      else console.log(`  ✓ ${table}.${colName}`);
    }
    for (const g of gPatches) {
      const { error } = await db.from("gatherings").update(g.patch).eq("id", g.id);
      if (error) throw new Error(`gathering ${g.id}: ${error.message}`);
    }
    if (gPatches.length) console.log(`  ✓ ${gPatches.length} gathering(s)`);
    for (const p of pollPatches) {
      const { error } = await db.from("polls").update({ options: p.options }).eq("id", p.id);
      if (error) throw new Error(`poll ${p.id}: ${error.message}`);
    }
    if (pollPatches.length) console.log(`  ✓ ${pollPatches.length} poll(s)`);
    const { error: delErr } = await db.from("members").delete().eq("id", oldId);
    if (delErr) throw new Error(`delete placeholder: ${delErr.message}`);
    console.log(`  ✓ placeholder record erased`);
  } else {
    for (const p of ballotPlan) {
      const { error } = await db.from("ballots").upsert(
        { gathering_id: p.gid, member_id: newId, scores: p.scores, sealed: true, aromas: {}, notes: p.notes, updated_at: new Date().toISOString() },
        { onConflict: "gathering_id,member_id" }
      );
      if (error) throw new Error(`ballot ${p.date}: ${error.message}`);
      console.log(`  ✓ ballot ${p.date} (#${p.number ?? "?"})`);
    }
    for (const a of attendeeAdds) {
      const { error } = await db.from("gatherings").update({ attendees: a.attendees }).eq("id", a.gid);
      if (error) throw new Error(`attendees ${a.date}: ${error.message}`);
    }
    if (attendeeAdds.length) console.log(`  ✓ added to ${attendeeAdds.length} attendee list(s)`);
  }

  // ── prove it ────────────────────────────────────────────────────────────
  const { data: finalAnnals } = await db.from("annals").select("theme,date,rows");
  const his: string[] = [];
  for (const a of finalAnnals || []) {
    for (const r of (a.rows as AnnalRow[]) || []) {
      if (r.owner === newName) his.push(`  ${a.date}  ${a.theme}: ${r.title || `cloth ${r.cloth}`}${r.dq ? " (DQ)" : r.rank === 1 ? " (crowned)" : ""}`);
    }
  }
  const { count: hisBallots } = await db.from("ballots").select("*", { count: "exact", head: true }).eq("member_id", newId);
  console.log(`\n"${newName}"'s record now (${hisBallots || 0} sealed ballot(s)):`);
  his.forEach((h) => console.log(h));
  const finalT = tallies((finalAnnals || []) as { rows: AnnalRow[] }[]);
  console.log(`\nFinal tallies: ${sum(finalT.victories)} victories, ${sum(finalT.dq)} disqualifications ` +
    `(${sum(before.victories)}, ${sum(before.dq)} before — unchanged in total).`);
  console.log("Done. Dominik holds his history.");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
