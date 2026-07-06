// The Annals: committed, locked gathering results — and the disqualification
// ledger. Once the Keiser commits a reveal, it is recorded here, surfaces in
// the codex, and only the Keiser may amend it. Demo mode persists per-browser;
// live mode maps to gatherings/wines tables plus a dq ledger.

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
const DQ_KEY = "lcv_dq_counts";

export function loadAnnals(): AnnalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ANNALS_KEY) || "[]") as AnnalEntry[];
  } catch {
    return [];
  }
}

export function getAnnal(gatheringId: string): AnnalEntry | null {
  return loadAnnals().find((a) => a.gatheringId === gatheringId) ?? null;
}

// Commit (or, for the Keiser's later amendments, re-commit) a gathering.
// The disqualification ledger is rebuilt from all committed entries so counts
// never double when an entry is amended.
export function commitAnnal(entry: AnnalEntry) {
  if (typeof window === "undefined") return;
  try {
    const rest = loadAnnals().filter((a) => a.gatheringId !== entry.gatheringId);
    const all = [...rest, entry].sort((a, b) => b.number - a.number);
    localStorage.setItem(ANNALS_KEY, JSON.stringify(all));

    const dq: Record<string, number> = {};
    for (const a of all)
      for (const r of a.rows)
        if (r.dq && r.owner) dq[r.owner] = (dq[r.owner] || 0) + 1;
    localStorage.setItem(DQ_KEY, JSON.stringify(dq));
  } catch {}
}

// Disqualifications per member name, threshold five: at five the member is
// summoned before the tribunal and the Council votes to keep or cast them out.
export const DQ_THRESHOLD = 5;

export function loadDqCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DQ_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
