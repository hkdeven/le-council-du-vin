// Sealed ballots from the rite, and the reckoning math the reveal runs on them.
// Live (login enforced + Supabase): the `ballots` table (one row per member per
// gathering). Demo: per-browser localStorage.

import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

export interface Ballot {
  scores: Record<number, number>; // cloth number -> 1..10
  sealed: boolean;
  aromas?: Record<number, string[]>; // cloth number -> aromas the taster marked
  notes?: Record<number, string>; // cloth number -> the taster's whispered notes
}

export interface MemberBallot extends Ballot {
  memberId: string;
}

const key = (gatheringId: string, memberId: string) => `lcv_ballot_${gatheringId}_${memberId}`;

// One member's own ballot (rite restore).
export async function fetchBallot(gatheringId: string, memberId: string): Promise<Ballot | null> {
  if (gatheringsLive()) {
    const { data } = await supabase!
      .from("ballots")
      .select("scores,sealed,aromas,notes")
      .eq("gathering_id", gatheringId)
      .eq("member_id", memberId)
      .maybeSingle();
    return data ? { scores: (data.scores as Record<number, number>) || {}, sealed: !!data.sealed, aromas: (data.aromas as Record<number, string[]>) || {}, notes: (data.notes as Record<number, string>) || {} } : null;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(gatheringId, memberId));
    return raw ? (JSON.parse(raw) as Ballot) : null;
  } catch {
    return null;
  }
}

export async function saveBallot(gatheringId: string, memberId: string, ballot: Ballot): Promise<void> {
  if (gatheringsLive()) {
    const { error } = await supabase!.from("ballots").upsert(
      { gathering_id: gatheringId, member_id: memberId, scores: ballot.scores, sealed: ballot.sealed, aromas: ballot.aromas || {}, notes: ballot.notes || {}, updated_at: new Date().toISOString() },
      { onConflict: "gathering_id,member_id" }
    );
    if (error) throw new Error(error.message);
    return;
  }
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(gatheringId, memberId), JSON.stringify(ballot));
  } catch {}
}

// Every ballot for a gathering (reveal tally + lock).
export async function fetchAllBallots(gatheringId: string): Promise<MemberBallot[]> {
  if (gatheringsLive()) {
    const { data } = await supabase!
      .from("ballots")
      .select("member_id,scores,sealed,notes")
      .eq("gathering_id", gatheringId);
    return (data || []).map((r) => ({ memberId: r.member_id as string, scores: (r.scores as Record<number, number>) || {}, sealed: !!r.sealed, notes: (r.notes as Record<number, string>) || {} }));
  }
  if (typeof window === "undefined") return [];
  const prefix = `lcv_ballot_${gatheringId}_`;
  const out: MemberBallot[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        const b = JSON.parse(localStorage.getItem(k) || "{}") as Ballot;
        out.push({ memberId: k.slice(prefix.length), scores: b.scores || {}, sealed: !!b.sealed, notes: b.notes || {} });
      }
    }
  } catch {}
  return out;
}

// One ballot per member, always: should duplicates ever sneak into a list
// (demo storage, a bad import), the LAST row per member wins — a member's
// vote must never count twice. The live table's primary key already forbids
// duplicates; this guards every other path.
export function dedupeBallots<T extends MemberBallot>(ballots: T[]): T[] {
  const seen = new Map<string, T>();
  for (const b of ballots) seen.set(b.memberId, b);
  return [...seen.values()];
}

// How many of the given attendees have a sealed ballot.
export function sealedAmong(ballots: MemberBallot[], attendees: string[]): number {
  return dedupeBallots(ballots).filter((b) => b.sealed && attendees.includes(b.memberId)).length;
}

// Average each cloth's score across every sealed ballot. Every ballot weighs
// the same — the Keiser's included; no vote carries more than any other.
export function tallyFromBallots(ballots: MemberBallot[], wineCount: number): Record<number, { avg: number; votes: number }> {
  const out: Record<number, { avg: number; votes: number }> = {};
  for (let cloth = 1; cloth <= wineCount; cloth++) out[cloth] = { avg: 0, votes: 0 };
  for (const b of dedupeBallots(ballots)) {
    if (!b.sealed) continue;
    for (let cloth = 1; cloth <= wineCount; cloth++) {
      const s = b.scores[cloth];
      if (typeof s === "number" && s > 0) {
        const cur = out[cloth];
        cur.avg = (cur.avg * cur.votes + s) / (cur.votes + 1);
        cur.votes += 1;
      }
    }
  }
  return out;
}

// What the reveal page runs on: aggregates only, so the same shape serves
// full members (derived from the ballots they may read) and initiates (from
// the reveal_summary RPC, which never surrenders an individual's scores).
export interface RevealStats {
  sealedIds: string[]; // member ids with a sealed ballot (who, not what)
  totals: Record<number, { avg: number; votes: number; min: number; max: number }>;
  notes: { cloth: number; note: string }[]; // sealed ballots' whispers, anonymous
}

export function statsFromBallots(ballots: MemberBallot[]): RevealStats {
  const sealed = dedupeBallots(ballots).filter((b) => b.sealed);
  const totals: RevealStats["totals"] = {};
  const notes: RevealStats["notes"] = [];
  for (const b of sealed) {
    for (const [c, v] of Object.entries(b.scores || {})) {
      if (typeof v !== "number" || v <= 0) continue;
      const cloth = Number(c);
      const t = totals[cloth] || { avg: 0, votes: 0, min: Infinity, max: -Infinity };
      t.avg = (t.avg * t.votes + v) / (t.votes + 1);
      t.votes += 1;
      t.min = Math.min(t.min, v);
      t.max = Math.max(t.max, v);
      totals[cloth] = t;
    }
    for (const [c, note] of Object.entries(b.notes || {})) {
      if (note?.trim()) notes.push({ cloth: Number(c), note });
    }
  }
  return { sealedIds: sealed.map((b) => b.memberId), totals, notes };
}

// The initiate's road to the reveal: the security-definer summary. Falls back
// to whatever rows RLS will surrender (their own ballot) on an older database
// that lacks the function — degraded, never broken.
export async function fetchRevealStats(gatheringId: string): Promise<RevealStats> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!.rpc("reveal_summary", { gid: gatheringId });
    if (!error && data) {
      const d = data as {
        sealed?: string[];
        totals?: Record<string, { avg: number; votes: number; min: number; max: number }>;
        notes?: { cloth: number | string; note: string }[];
      };
      return {
        sealedIds: d.sealed || [],
        totals: Object.fromEntries(
          Object.entries(d.totals || {}).map(([c, t]) => [Number(c), { avg: Number(t.avg), votes: Number(t.votes), min: Number(t.min), max: Number(t.max) }])
        ),
        notes: (d.notes || []).map((n) => ({ cloth: Number(n.cloth), note: n.note })),
      };
    }
  }
  return statsFromBallots(await fetchAllBallots(gatheringId));
}

// Every ballot across every gathering — the Palate Dossier reads the whole
// history at once. Live: one select. Demo: walk this browser's stored ballots
// for the known gatherings + members (ids can contain underscores, so the
// key is re-derived rather than parsed).
export interface HistoryBallot extends MemberBallot { gatheringId: string }
export async function fetchBallotHistory(gatheringIds: string[], memberIds: string[]): Promise<HistoryBallot[]> {
  if (gatheringsLive()) {
    const { data } = await supabase!.from("ballots").select("gathering_id,member_id,scores,sealed,aromas,notes");
    return (data || []).map((r) => ({
      gatheringId: r.gathering_id as string,
      memberId: r.member_id as string,
      scores: (r.scores as Record<number, number>) || {},
      sealed: !!r.sealed,
      aromas: (r.aromas as Record<number, string[]>) || {},
      notes: (r.notes as Record<number, string>) || {},
    }));
  }
  if (typeof window === "undefined") return [];
  const out: HistoryBallot[] = [];
  try {
    for (const g of gatheringIds) {
      for (const m of memberIds) {
        const raw = localStorage.getItem(key(g, m));
        if (!raw) continue;
        const b = JSON.parse(raw) as Ballot;
        out.push({ gatheringId: g, memberId: m, scores: b.scores || {}, sealed: !!b.sealed, aromas: b.aromas || {}, notes: b.notes || {} });
      }
    }
  } catch {}
  return out;
}
