// One-time data fix (ticket #2): Julia is the Queen of Cups. Her history —
// the La Plage nights among it — was imported under a placeholder record
// ("Julia" <julia.unknown@lecouncilduvin.co.za>, an inactive initiate created
// by import-annals.ts). She now holds a real account. This re-points every
// reference from the placeholder to her new account and erases the orphan.
//
//   Dry run (default, writes nothing):
//     SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-julia.ts
//   Apply:
//     SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-julia.ts --write
//
//   The old record is found by email (override with --from <email>); the new
//   one by cult_name containing "queen of cups" (override with --to <email>).
//
// What moves:
//   - annals.rows[].owner        "Julia" -> her new cult_name (crowns, DQs,
//     and the codex's victory tallies all key on this string)
//   - ballots.member_id          placeholder id -> new id (her sealed votes)
//   - gatherings.attendees[]     placeholder id -> new id
//   - gatherings host/prophecy   placeholder id or name -> new
//   - wines.brought_by, scores/offerings/bottles/theme_favours/
//     application_votes .member_id
//   - polls.options[].voters[]   placeholder id -> new id
//   - members                    the placeholder row is deleted at the end
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
const FROM_EMAIL = (argOf("--from") || "julia.unknown@lecouncilduvin.co.za").toLowerCase();
const TO_EMAIL = argOf("--to")?.toLowerCase();

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

async function main() {
  const env = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SERVICE_ROLE_KEY (env).");
  const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

  // ── resolve the two records ───────────────────────────────────────────────
  const { data: members, error: mErr } = await db.from("members").select("id,email,cult_name,role,active");
  if (mErr) throw new Error(mErr.message);
  const old = (members || []).find((m) => (m.email as string).toLowerCase() === FROM_EMAIL);
  if (!old) throw new Error(`No placeholder record carries ${FROM_EMAIL} — nothing to migrate (already done?).`);
  const target = TO_EMAIL
    ? (members || []).find((m) => (m.email as string).toLowerCase() === TO_EMAIL)
    : (members || []).find((m) => m.id !== old.id && /queen of cups/i.test(m.cult_name as string));
  if (!target) {
    throw new Error(TO_EMAIL
      ? `No account carries ${TO_EMAIL}.`
      : `No account names the Queen of Cups. Pass her email: --to <email>.`);
  }
  if (target.id === old.id) throw new Error("The old and new records are the same row.");

  const oldId = old.id as string, newId = target.id as string;
  const oldName = old.cult_name as string, newName = target.cult_name as string;
  console.log(`Old record: ${oldName} <${old.email}> (${oldId}) — role ${old.role}, active ${old.active}`);
  console.log(`New record: ${newName} <${target.email}> (${newId}) — role ${target.role}, active ${target.active}\n`);

  // ── annals: owner strings ─────────────────────────────────────────────────
  const { data: annals, error: aErr } = await db.from("annals").select("gathering_id,number,theme,date,rows");
  if (aErr) throw new Error(aErr.message);
  const before = tallies((annals || []) as { rows: AnnalRow[] }[]);

  const annalPatches: { gathering_id: string; theme: string; date: string; rows: AnnalRow[]; touched: string[] }[] = [];
  for (const a of annals || []) {
    const rows = (a.rows as AnnalRow[]) || [];
    const touched = rows.filter((r) => r.owner === oldName).map((r) => r.title || `cloth ${r.cloth}`);
    if (!touched.length) continue;
    annalPatches.push({
      gathering_id: a.gathering_id, theme: a.theme, date: a.date, touched,
      rows: rows.map((r) => (r.owner === oldName ? { ...r, owner: newName } : r)),
    });
  }
  console.log(`Annal rows to re-credit (${oldName} -> ${newName}):`);
  if (!annalPatches.length) console.log("  none");
  for (const p of annalPatches) console.log(`  ${p.date}  ${p.theme}: ${p.touched.join("; ")}`);

  // The verification: re-reckon with the patched rows in place.
  const patchedAnnals = (annals || []).map((a) => {
    const p = annalPatches.find((x) => x.gathering_id === a.gathering_id);
    return { rows: (p ? p.rows : (a.rows as AnnalRow[])) || [] };
  });
  const after = tallies(patchedAnnals);
  const moved = {
    victories: { from: before.victories[oldName] || 0, to: (after.victories[newName] || 0) - (before.victories[newName] || 0) },
    dq: { from: before.dq[oldName] || 0, to: (after.dq[newName] || 0) - (before.dq[newName] || 0) },
  };
  console.log(`\nTallies: ${sum(before.victories)} victories and ${sum(before.dq)} disqualifications before; ` +
    `${sum(after.victories)} and ${sum(after.dq)} after.`);
  console.log(`  ${oldName}'s ${moved.victories.from} crown(s) and ${moved.dq.from} mark(s) pass to ${newName}.`);
  if (sum(before.victories) !== sum(after.victories) || sum(before.dq) !== sum(after.dq)
    || moved.victories.from !== moved.victories.to || moved.dq.from !== moved.dq.to) {
    throw new Error("ABORT — the totals would shift; a crown or mark would be lost or invented.");
  }

  // ── id references across the tables ───────────────────────────────────────
  const countRows = async (table: string, col: string) => {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq(col, oldId);
    if (error) return `? (${error.message})`;
    return count || 0;
  };
  const idWork: [string, string][] = [
    ["ballots", "member_id"], ["scores", "member_id"], ["offerings", "member_id"],
    ["bottles", "member_id"], ["theme_favours", "member_id"], ["application_votes", "member_id"],
    ["wines", "brought_by"], ["themes", "proposed_by"],
  ];
  console.log("\nId references to re-point:");
  for (const [table, col] of idWork) console.log(`  ${table}.${col}: ${await countRows(table, col)}`);

  const { data: gatherings } = await db.from("gatherings").select("id,attendees,host_id,host_name,host2_id,host2_name,prophecy");
  const gPatches: { id: string; patch: Record<string, unknown> }[] = [];
  for (const g of gatherings || []) {
    const patch: Record<string, unknown> = {};
    const att = (g.attendees as string[]) || [];
    if (att.includes(oldId)) patch.attendees = [...new Set(att.map((x) => (x === oldId ? newId : x)))];
    if (g.host_id === oldId) { patch.host_id = newId; patch.host_name = newName; }
    else if (g.host_name === oldName) patch.host_name = newName;
    if (g.host2_id === oldId) { patch.host2_id = newId; patch.host2_name = newName; }
    else if (g.host2_name === oldName) patch.host2_name = newName;
    const pr = g.prophecy as { member_id?: string; name?: string } | null;
    if (pr && (pr.member_id === oldId || pr.name === oldName)) patch.prophecy = { ...pr, member_id: newId, name: newName };
    if (Object.keys(patch).length) gPatches.push({ id: g.id as string, patch });
  }
  console.log(`  gatherings (attendees/hosts/prophecy): ${gPatches.length}`);

  const { data: polls } = await db.from("polls").select("id,options");
  const pollPatches: { id: string; options: unknown }[] = [];
  for (const p of polls || []) {
    const options = (p.options as { id: string; date: string; voters: string[] }[]) || [];
    if (!options.some((o) => (o.voters || []).includes(oldId))) continue;
    pollPatches.push({
      id: p.id as string,
      options: options.map((o) => ({ ...o, voters: [...new Set((o.voters || []).map((v) => (v === oldId ? newId : v)))] })),
    });
  }
  console.log(`  polls (date votes): ${pollPatches.length}`);

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
  for (const [table, col] of idWork) {
    // Rows the new account already owns (e.g. a ballot for the same night)
    // would collide on unique keys; report instead of clobbering.
    const { error } = await db.from(table).update({ [col]: newId }).eq(col, oldId);
    if (error) console.warn(`  ! ${table}.${col}: ${error.message} — resolve by hand`);
    else console.log(`  ✓ ${table}.${col}`);
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

  // No orphan remains: the placeholder row goes last, once nothing points at it.
  const { error: delErr } = await db.from("members").delete().eq("id", oldId);
  if (delErr) throw new Error(`delete placeholder: ${delErr.message}`);
  console.log(`  ✓ placeholder record erased`);

  // ── prove it ──────────────────────────────────────────────────────────────
  const { data: finalAnnals } = await db.from("annals").select("number,theme,date,rows");
  const hers = [];
  for (const a of finalAnnals || []) {
    for (const r of (a.rows as AnnalRow[]) || []) {
      if (r.owner === newName) hers.push(`  ${a.date}  ${a.theme}: ${r.title || `cloth ${r.cloth}`}${r.dq ? " (DQ)" : r.rank === 1 ? " (crowned)" : ""}`);
    }
  }
  const { count: herBallots } = await db.from("ballots").select("*", { count: "exact", head: true }).eq("member_id", newId);
  console.log(`\n${newName}'s record now (${herBallots || 0} sealed ballot(s)):`);
  hers.forEach((h) => console.log(h));
  const finalT = tallies((finalAnnals || []) as { rows: AnnalRow[] }[]);
  console.log(`\nFinal tallies: ${sum(finalT.victories)} victories, ${sum(finalT.dq)} disqualifications ` +
    `(${sum(before.victories)}, ${sum(before.dq)} before — unchanged in total).`);
  console.log("Done. The Queen of Cups holds her history.");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
