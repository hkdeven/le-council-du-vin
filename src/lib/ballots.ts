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
      .select("member_id,scores,sealed")
      .eq("gathering_id", gatheringId);
    return (data || []).map((r) => ({ memberId: r.member_id as string, scores: (r.scores as Record<number, number>) || {}, sealed: !!r.sealed }));
  }
  if (typeof window === "undefined") return [];
  const prefix = `lcv_ballot_${gatheringId}_`;
  const out: MemberBallot[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        const b = JSON.parse(localStorage.getItem(k) || "{}") as Ballot;
        out.push({ memberId: k.slice(prefix.length), scores: b.scores || {}, sealed: !!b.sealed });
      }
    }
  } catch {}
  return out;
}

// How many of the given attendees have a sealed ballot.
export function sealedAmong(ballots: MemberBallot[], attendees: string[]): number {
  return ballots.filter((b) => b.sealed && attendees.includes(b.memberId)).length;
}

// Average each cloth's score across every sealed ballot.
export function tallyFromBallots(ballots: MemberBallot[], wineCount: number): Record<number, { avg: number; votes: number }> {
  const out: Record<number, { avg: number; votes: number }> = {};
  for (let cloth = 1; cloth <= wineCount; cloth++) out[cloth] = { avg: 0, votes: 0 };
  for (const b of ballots) {
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
