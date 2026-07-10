// The Palate Dossier: everything the vine has learned of a member, derived
// from data the app already keeps — sealed ballots, committed annals, and the
// gatherings themselves. Pure computation lives in computeDossier() (testable
// without a browser); dossierFor() gathers the inputs for live or demo mode.

import { supabase } from "./supabase";
import { fetchGatherings, gatheringsLive } from "./gatherings";
import { fetchAnnals, fetchDqCounts, championsOf, type AnnalEntry } from "./annals";
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
  // Coin rows (Keiser-approved pair). Null until 2+ of their bottles carry prices.
  coin: { perHundred: number; table: number } | null; // points per R100 as a bringer
  purse: { mine: number; table: number } | null; // average bottle spend vs the table
}

export interface DossierInputs {
  member: Pick<Member, "id" | "cult_name"> & { last_hosted?: string | null };
  members: (Pick<Member, "id" | "cult_name"> & Partial<Pick<Member, "role" | "active">>)[];
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

  // Moons stood + longest communion. Standing a moon is proven by EITHER a
  // sealed ballot OR owning a bottle in that night's annal (nobody's cloth
  // reaches the table without them): imported and unscored nights have no
  // ballots, but their bringers still stood. Only nights already gathered
  // count; a summoned future night must not break anyone's run.
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const nightDates = new Map<string, string>();
  for (const g of gatherings) {
    if (g.gather_date && g.gather_date <= today) nightDates.set(g.id, g.gather_date);
  }
  for (const a of annals) {
    if (!nightDates.has(a.gatheringId) && a.date && a.date <= today) nightDates.set(a.gatheringId, a.date);
  }
  const nights = [...nightDates.entries()].sort((x, y) => (x[1] < y[1] ? -1 : 1));
  const stoodSet = new Set(mine.map((b) => b.gatheringId));
  for (const a of annals) {
    if (a.rows.some((r) => r.owner === member.cult_name)) stoodSet.add(a.gatheringId);
  }
  const moonsStood = nights.filter(([id]) => stoodSet.has(id)).length;
  let communion = 0, run = 0;
  for (const [id] of nights) {
    run = stoodSet.has(id) ? run + 1 : 0;
    communion = Math.max(communion, run);
  }

  // Crowns + marks from the annals.
  let bottlesCrowned = 0;
  const pours: DossierStats["pours"] = [];
  for (const a of annals) {
    const champs = championsOf(a);
    for (const r of a.rows) {
      if (r.owner !== member.cult_name) continue;
      if (champs.includes(r)) bottlesCrowned++;
      // votes 0 = a night recorded without scores; not a pour to rank.
      if (!r.dq && r.votes > 0) {
        pours.push({
          title: r.title || (r.cloth != null ? `Cloth ${r.cloth}` : "A bottle unrecorded"),
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
    for (const v of Object.values(b.scores || {})) {
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
  // Only living, full members qualify as kindred — imported departed souls
  // and initiates share history but not standing.
  let kindred: string | null = null;
  let bestScore = -2;
  const mineByGathering = new Map(mine.map((b) => [b.gatheringId, b.scores]));
  for (const other of members) {
    if (other.id === member.id) continue;
    if (other.active === false || other.role === "initiate") continue;
    const xs: number[] = [], ys: number[] = [];
    for (const b of sealed) {
      if (b.memberId !== other.id) continue;
      const mySc = mineByGathering.get(b.gatheringId);
      if (!mySc) continue;
      for (const [cloth, v] of Object.entries(b.scores || {})) {
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
  for (const g of gatherings) {
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

  // Coin's return + the purse: from every priced, judged bottle in the annals.
  const pricedAll: { score: number; price: number; owner: string }[] = [];
  for (const a of annals) for (const r of a.rows) {
    if (!r.dq && r.votes > 0 && (r.price ?? 0) > 0) pricedAll.push({ score: r.score, price: r.price!, owner: r.owner });
  }
  const minePriced = pricedAll.filter((x) => x.owner === member.cult_name);
  let coin: DossierStats["coin"] = null;
  let purse: DossierStats["purse"] = null;
  if (minePriced.length >= 2 && pricedAll.length >= 4) {
    const per = (list: typeof pricedAll) => list.reduce((s, x) => s + x.score, 0) / list.reduce((s, x) => s + x.price, 0) * 100;
    coin = { perHundred: per(minePriced), table: per(pricedAll) };
    const avg = (list: typeof pricedAll) => list.reduce((s, x) => s + x.price, 0) / list.length;
    purse = { mine: avg(minePriced), table: avg(pricedAll) };
  }

  return { moonsStood, bottlesCrowned, marks, temper, kindred, wheel, communion, nose, pours: pours.slice(0, 3), coin, purse };
}

// Gather the inputs (live or demo) and compute.
export async function dossierFor(member: { id: string; cult_name: string; last_hosted?: string | null }): Promise<DossierStats> {
  const [gatherings, annals, dq] = await Promise.all([fetchGatherings(), fetchAnnals(), fetchDqCounts()]);
  let members: Pick<Member, "id" | "cult_name">[];
  if (gatheringsLive()) {
    const { data } = await supabase!.from("members").select("id,cult_name,last_hosted,role,active");
    members = (data as Member[]) || [];
  } else {
    members = loadMembers();
  }
  const ballots = await fetchBallotHistory(gatherings.map((g) => g.id), members.map((m) => m.id));
  return computeDossier({ member, members, gatherings, annals, ballots, dq, nowMs: Date.now() });
}
