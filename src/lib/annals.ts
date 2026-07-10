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
  varietals?: string[]; // the grapes, Keiser-identified or carried from the offering
  price?: number | null; // rand, when known
}

export interface AnnalEntry {
  gatheringId: string;
  number: number;
  theme: string;
  date: string;
  rows: AnnalRow[];
  committed_at: string;
}

// Who truly took a night. The crowned are rank 1 and never disqualified;
// when a scored night's first place fell to disqualification, the best
// surviving score is promoted. A night recorded WITHOUT scores follows the
// Keiser's convention: the CLOTH ORDER carries the standing, so the
// qualified wine with the lowest cloth takes the crown (phantom rows, with
// no owner and no title, are recording debris and never contend). Every
// surface that counts victories (codex crownings, chalices, the dossier,
// the prophecy's grade) must go through this, so a disqualified first
// place is never credited anywhere.
export function championsOf(a: AnnalEntry): AnnalRow[] {
  const crowned = a.rows.filter((r) => r.rank === 1 && !r.dq);
  if (crowned.length) return crowned;
  const qualified = a.rows.filter((r) => !r.dq);
  if (!qualified.length) return [];
  const scored = qualified.filter((r) => r.votes > 0);
  if (scored.length) {
    const top = Math.max(...scored.map((r) => r.score));
    return scored.filter((r) => r.score === top);
  }
  const substantial = qualified.filter((r) => r.owner || r.title);
  if (!substantial.length) return [];
  const first = substantial.reduce((a2, b) => (b.cloth < a2.cloth ? b : a2));
  return [first];
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

// Erase a committed record entirely (Keiser only; e.g. a botched manual entry).
export async function deleteAnnal(gatheringId: string): Promise<void> {
  if (gatheringsLive()) {
    const { error } = await supabase!.from("annals").delete().eq("gathering_id", gatheringId);
    if (error) throw new Error(error.message);
    return;
  }
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANNALS_KEY, JSON.stringify(localAnnals().filter((a) => a.gatheringId !== gatheringId)));
  } catch {}
}
