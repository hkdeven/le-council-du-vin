// The Annals: committed, locked gathering results — and the disqualification
// ledger. Once the Keiser commits a reveal, it is recorded here, surfaces in
// the codex, and only the Keiser may amend it. Live (login enforced + Supabase):
// the `annals` table. Demo: per-browser localStorage.

import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

export interface AnnalRow {
  cloth: number;
  owner: string;
  title: string;
  score: number;
  votes: number;
  rank: number | null; // null when disqualified
  dq: boolean;
}

export interface AnnalEntry {
  gatheringId: string;
  number: number;
  theme: string;
  date: string;
  rows: AnnalRow[];
  committed_at: string;
}

const ANNALS_KEY = "lcv_annals";

// Disqualifications per member name, threshold five: at five the member is
// summoned before the tribunal and the Council votes to keep or cast them out.
export const DQ_THRESHOLD = 5;

function localAnnals(): AnnalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ANNALS_KEY) || "[]") as AnnalEntry[];
  } catch {
    return [];
  }
}

function fromRow(r: Record<string, any>): AnnalEntry {
  return {
    gatheringId: r.gathering_id,
    number: r.number,
    theme: r.theme || "",
    date: r.date,
    rows: (r.rows as AnnalRow[]) || [],
    committed_at: r.committed_at,
  };
}

export async function fetchAnnals(): Promise<AnnalEntry[]> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("annals").select("*").order("number", { ascending: false });
    if (error) {
      console.error("Could not load annals:", error.message);
      return [];
    }
    return (data || []).map(fromRow);
  }
  return [...localAnnals()].sort((a, b) => b.number - a.number);
}

export async function fetchAnnal(gatheringId: string): Promise<AnnalEntry | null> {
  if (gatheringsLive()) {
    const { data } = await supabase!.from("annals").select("*").eq("gathering_id", gatheringId).maybeSingle();
    return data ? fromRow(data) : null;
  }
  return localAnnals().find((a) => a.gatheringId === gatheringId) ?? null;
}

// Commit (or, for the Keiser's later amendments, re-commit) a gathering.
export async function commitAnnal(entry: AnnalEntry): Promise<void> {
  if (gatheringsLive()) {
    const { error } = await supabase!.from("annals").upsert(
      { gathering_id: entry.gatheringId, number: entry.number, theme: entry.theme, date: entry.date, rows: entry.rows, committed_at: entry.committed_at },
      { onConflict: "gathering_id" }
    );
    if (error) throw new Error(error.message);
    return;
  }
  if (typeof window === "undefined") return;
  try {
    const rest = localAnnals().filter((a) => a.gatheringId !== entry.gatheringId);
    localStorage.setItem(ANNALS_KEY, JSON.stringify([...rest, entry]));
  } catch {}
}

// The disqualification ledger is derived from all committed entries so counts
// never double when an entry is amended.
export function dqCountsFrom(annals: AnnalEntry[]): Record<string, number> {
  const dq: Record<string, number> = {};
  for (const a of annals)
    for (const r of a.rows)
      if (r.dq && r.owner) dq[r.owner] = (dq[r.owner] || 0) + 1;
  return dq;
}

export async function fetchDqCounts(): Promise<Record<string, number>> {
  return dqCountsFrom(await fetchAnnals());
}
