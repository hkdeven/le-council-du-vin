// The Palate Dossier: everything the vine has learned of a member, derived
// from data the app already keeps — sealed ballots, committed annals, and the
// gatherings themselves. Pure computation lives in computeDossier() (testable
// without a browser); dossierFor() gathers the inputs for live or demo mode.

import { supabase } from "./supabase";
import { fetchGatherings, gatheringsLive } from "./gatherings";
import { fetchAnnals, fetchDqCounts, type AnnalEntry } from "./annals";
import { fetchBallotHistory, type HistoryBallot } from "./ballots";
import { loadMembers } from "./members";
import { toRoman } from "./util";
import { AROMAS, meaningfulWords } from "./aromas";
import type { Gathering, Member } from "./types";

export interface DossierStats {
  moonsStood: number;
  bottlesCrowned: number;
  marks: number;
  temper: { label: "Generous" | "Balanced" | "Miser"; delta: number } | null;
  kindred: string | null;
  wheel: string | null; // "3 moons since hosting" | "hosting this moon" | null = never hosted
  communion: number; // longest run of consecutive gatherings stood
  nose: { aroma: string; count: number }[]; // top aromas, most-marked first
  pours: { title: string; score: number; rank: number; meta: string }[]; // top 3 they brought
}

export interface DossierInputs {
  member: Pick<Member, "id" | "cult_name"> & { last_hosted?: string | null };
  members: Pick<Member, "id" | "cult_name">[];
  gatherings: Gathering[];
  annals: AnnalEntry[];
  ballots: HistoryBallot[];
  dq: Record<string, number>;
  nowMs: number;
}

const SYNODIC = 29.53; // days per moon

export function computeDossier(inp: DossierInputs): DossierStats {
  const { member, members, gatherings, annals, ballots, dq, nowMs } = inp;
  const mine = ballots.filter((b) => b.memberId === member.id && b.sealed);

  // Moons stood + longest communion (consecutive gatherings with a sealed ballot).
  const ordered = [...gatherings]
    .filter((g) => g.gather_date)
    .sort((a, b) => (a.gather_date! < b.gather_date! ? -1 : 1));
  const stoodSet = new Set(mine.map((b) => b.gatheringId));
  const moonsStood = ordered.filter((g) => stoodSet.has(g.id)).length;
  let communion = 0, run = 0;
  for (const g of ordered) {
    run = stoodSet.has(g.id) ? run + 1 : 0;
    communion = Math.max(communion, run);
  }

  // Crowns + marks from the annals.
  let bottlesCrowned = 0;
  const pours: DossierStats["pours"] = [];
  for (const a of annals) {
    for (const r of a.rows) {
      if (r.owner !== member.cult_name) continue;
      if (r.rank === 1 && !r.dq) bottlesCrowned++;
      if (!r.dq) {
        pours.push({
          title: r.title || `Cloth ${r.cloth}`,
          score: r.score,
          rank: r.rank ?? 99,
          meta: `Gathering ${toRoman(a.number)}${a.theme ? ` · ${a.theme}` : ""}`,
        });
      }
    }
  }
  pours.sort((a, b) => b.score - a.score);
  const marks = dq[member.cult_name] || 0;

  // Palate temper: their average given vs the whole table's average.
  const sealed = ballots.filter((b) => b.sealed);
  const all: number[] = [];
  const own: number[] = [];
  for (const b of sealed) {
    for (const v of Object.values(b.scores)) {
      if (typeof v === "number" && v > 0) {
        all.push(v);
        if (b.memberId === member.id) own.push(v);
      }
    }
  }
  let temper: DossierStats["temper"] = null;
  if (own.length >= 5 && all.length > own.length) {
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const delta = mean(own) - mean(all);
    temper = { label: delta > 0.25 ? "Generous" : delta < -0.25 ? "Miser" : "Balanced", delta };
  }

  // Kindred palate: whose scores track theirs closest across shared wines.
  let kindred: string | null = null;
  let bestScore = -2;
  const mineByGathering = new Map(mine.map((b) => [b.gatheringId, b.scores]));
  for (const other of members) {
    if (other.id === member.id) continue;
    const xs: number[] = [], ys: number[] = [];
    for (const b of sealed) {
      if (b.memberId !== other.id) continue;
      const mySc = mineByGathering.get(b.gatheringId);
      if (!mySc) continue;
      for (const [cloth, v] of Object.entries(b.scores)) {
        const m = mySc[Number(cloth)];
        if (typeof v === "number" && v > 0 && typeof m === "number" && m > 0) {
          xs.push(m); ys.push(v);
        }
      }
    }
    if (xs.length < 5) continue;
    const n = xs.length;
    const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, x) => s + x, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    const r = dx && dy ? num / Math.sqrt(dx * dy) : 0;
    if (r > bestScore) { bestScore = r; kindred = other.cult_name; }
  }

  // The wheel: moons since they last hosted (gatherings first, profile fallback).
  let lastHosted: string | null = member.last_hosted || null;
  for (const g of ordered) {
    if (!g.gather_date || new Date(g.gather_date).getTime() > nowMs) continue;
    const hosted = g.host_id === member.id || g.host_name === member.cult_name ||
      (g as Gathering & { host2_id?: string | null; host2_name?: string | null }).host2_id === member.id ||
      (g as Gathering & { host2_name?: string | null }).host2_name === member.cult_name;
    if (hosted && (!lastHosted || g.gather_date > lastHosted)) lastHosted = g.gather_date;
  }
  let wheel: string | null = null;
  if (lastHosted) {
    const moons = Math.floor((nowMs - new Date(lastHosted).getTime()) / 86400000 / SYNODIC);
    wheel = moons <= 0 ? "hosting this moon" : `${moons} moon${moons === 1 ? "" : "s"} since hosting`;
  }

  // The Nose: every aroma they have ever marked (pills and typed), tallied —
  // plus their whispered notes mined in full: aroma-bank phrases first, then
  // every remaining meaningful word (fillers stripped). Imported history's
  // comments land in notes, so they scent the cloud the same way.
  const tally: Record<string, number> = {};
  for (const b of mine) {
    for (const list of Object.values(b.aromas || {})) {
      for (const a of list) tally[a] = (tally[a] || 0) + 1;
    }
    for (const [cloth, note] of Object.entries(b.notes || {})) {
      if (!note) continue;
      const marked = new Set((b.aromas || {})[Number(cloth)] || []);
      let low = note.toLowerCase();
      // Multi-word bank aromas ("black cherry") are matched as whole-word
      // phrases and consumed, so their halves don't also count as separate
      // words — and "rose" can't fire inside "rosemary".
      for (const a of AROMAS) {
        const re = new RegExp(`\\b${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        if (!re.test(low)) continue;
        low = low.replace(new RegExp(re.source, "g"), " ");
        if (!marked.has(a)) tally[a] = (tally[a] || 0) + 1;
      }
      for (const w of new Set(meaningfulWords(low))) {
        if (!marked.has(w)) tally[w] = (tally[w] || 0) + 1;
      }
    }
  }
  const nose = Object.entries(tally)
    .map(([aroma, count]) => ({ aroma, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);

  return { moonsStood, bottlesCrowned, marks, temper, kindred, wheel, communion, nose, pours: pours.slice(0, 3) };
}

// Gather the inputs (live or demo) and compute.
export async function dossierFor(member: { id: string; cult_name: string; last_hosted?: string | null }): Promise<DossierStats> {
  const [gatherings, annals, dq] = await Promise.all([fetchGatherings(), fetchAnnals(), fetchDqCounts()]);
  let members: Pick<Member, "id" | "cult_name">[];
  if (gatheringsLive()) {
    const { data } = await supabase!.from("members").select("id,cult_name,last_hosted");
    members = (data as Member[]) || [];
  } else {
    members = loadMembers();
  }
  const ballots = await fetchBallotHistory(gatherings.map((g) => g.id), members.map((m) => m.id));
  return computeDossier({ member, members, gatherings, annals, ballots, dq, nowMs: Date.now() });
}
