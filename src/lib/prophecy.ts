// The Prophecy: before a gathering, the vine names the soul it expects to be
// crowned. It weighs EVERYTHING it knows (the Keiser's decree, 2026-07-09):
//   - the bringer's record: how their bottles have scored across all history
//   - the room's grape biases: how each ATTENDING taster leans on the grapes
//     each sealed offering carries
//   - the room's price weakness: how each attending taster's verdicts move
//     with price, applied to each offering's logged price
// Every effect is shrunk toward zero when the history is thin, so one lucky
// night doesn't crown a favourite. Spoken once, then stored on the gathering.

import { championsOf, type AnnalEntry } from "./annals";
import type { HistoryBallot } from "./ballots";
import type { Offering } from "./bottles";
import type { Member } from "./types";

export interface ProphecyVerdict {
  member_id: string;
  name: string;
  at: string; // ISO timestamp of the speaking
}

export function speakProphecy(inp: {
  attendees: string[]; // member ids RSVP'd
  offerings: Record<string, Offering>; // member id -> sealed offering
  members: Pick<Member, "id" | "cult_name">[];
  annals: AnnalEntry[];
  ballots: HistoryBallot[];
  nowMs: number;
}): ProphecyVerdict | null {
  const { attendees, offerings, members, annals, ballots, nowMs } = inp;
  const nameOf = new Map(members.map((m) => [m.id, m.cult_name]));
  const sealed = ballots.filter((b) => b.sealed);

  // Every judged historical row, with its night's varietals and price.
  const rows: { owner: string; score: number; varietals: string[]; price: number | null; gid: string; cloth: number }[] = [];
  for (const a of annals) for (const r of a.rows) {
    if (r.dq || r.votes === 0) continue;
    rows.push({ owner: r.owner, score: r.score, varietals: r.varietals || [], price: r.price ?? null, gid: a.gatheringId, cloth: r.cloth });
  }
  if (!rows.length) return null;
  const tableMean = rows.reduce((s, r) => s + r.score, 0) / rows.length;

  // Per-taster raw verdicts joined to the row they judged.
  const verdicts: { taster: string; score: number; varietals: string[]; price: number | null }[] = [];
  const rowByKey = new Map(rows.map((r) => [`${r.gid}:${r.cloth}`, r]));
  const tasterMean = new Map<string, number>();
  {
    const acc = new Map<string, number[]>();
    for (const b of sealed) {
      for (const [cloth, v] of Object.entries(b.scores)) {
        if (typeof v !== "number" || v <= 0) continue;
        const row = rowByKey.get(`${b.gatheringId}:${cloth}`);
        if (!row) continue;
        verdicts.push({ taster: b.memberId, score: v, varietals: row.varietals, price: row.price });
        const l = acc.get(b.memberId) || []; l.push(v); acc.set(b.memberId, l);
      }
    }
    for (const [t, xs] of acc) tasterMean.set(t, xs.reduce((s, x) => s + x, 0) / xs.length);
  }

  // Bringer's record: their bottles' average vs the table, shrunk by count.
  const ownerDelta = (name: string): number => {
    const own = rows.filter((r) => r.owner === name);
    if (!own.length) return 0;
    const d = own.reduce((s, r) => s + r.score, 0) / own.length - tableMean;
    return d * (own.length / (own.length + 2));
  };

  // A taster's lean on a grape: their verdicts on it vs their own mean, shrunk.
  const grapeLean = (taster: string, grape: string): number => {
    const mine = verdicts.filter((v) => v.taster === taster && v.varietals.includes(grape));
    const mean = tasterMean.get(taster);
    if (!mine.length || mean == null) return 0;
    const d = mine.reduce((s, v) => s + v.score, 0) / mine.length - mean;
    return d * (mine.length / (mine.length + 3));
  };

  // A taster's price slope: how far their verdicts move per rand, shrunk.
  const priceStats = new Map<string, { beta: number; n: number; meanPrice: number }>();
  {
    const byTaster = new Map<string, { s: number; p: number }[]>();
    for (const v of verdicts) {
      if (v.price == null || v.price <= 0) continue;
      const l = byTaster.get(v.taster) || []; l.push({ s: v.score, p: v.price }); byTaster.set(v.taster, l);
    }
    for (const [t, xs] of byTaster) {
      if (xs.length < 4) continue;
      const mp = xs.reduce((s, x) => s + x.p, 0) / xs.length;
      const ms = xs.reduce((s, x) => s + x.s, 0) / xs.length;
      let cov = 0, va = 0;
      for (const x of xs) { cov += (x.p - mp) * (x.s - ms); va += (x.p - mp) ** 2; }
      if (va === 0) continue;
      priceStats.set(t, { beta: (cov / va) * (xs.length / (xs.length + 4)), n: xs.length, meanPrice: mp });
    }
  }

  // Judge every attendee's sealed offering through the room that will taste it.
  const tastersInRoom = attendees.filter((id) => tasterMean.has(id));
  let best: { id: string; predicted: number } | null = null;
  for (const id of attendees) {
    const off = offerings[id];
    const name = nameOf.get(id);
    if (!off?.title || !name) continue;

    let predicted = tableMean + ownerDelta(name);

    if (off.varietals.length && tastersInRoom.length) {
      let sum = 0, n = 0;
      for (const t of tastersInRoom) {
        const leans = off.varietals.map((g) => grapeLean(t, g));
        sum += leans.reduce((s, x) => s + x, 0) / leans.length;
        n++;
      }
      if (n) predicted += sum / n;
    }

    if (off.price != null && off.price > 0 && tastersInRoom.length) {
      let sum = 0, n = 0;
      for (const t of tastersInRoom) {
        const ps = priceStats.get(t);
        if (!ps) continue;
        sum += ps.beta * (off.price - ps.meanPrice);
        n++;
      }
      if (n) predicted += sum / n;
    }

    if (!best || predicted > best.predicted) best = { id, predicted };
  }
  if (!best) return null;
  return { member_id: best.id, name: nameOf.get(best.id)!, at: new Date(nowMs).toISOString() };
}

// The vine's record: nights where a prophecy was spoken AND the annal is
// sealed. Right when the named soul owns a rank-1 bottle that night.
export function prophecyRecord(
  gatherings: { id: string; prophecy?: ProphecyVerdict | null }[],
  annals: AnnalEntry[]
): { right: number; total: number } {
  let right = 0, total = 0;
  const byId = new Map(annals.map((a) => [a.gatheringId, a]));
  for (const g of gatherings) {
    if (!g.prophecy) continue;
    const a = byId.get(g.id);
    if (!a) continue;
    total++;
    if (championsOf(a).some((r) => r.owner === g.prophecy!.name)) right++;
  }
  return { right, total };
}
