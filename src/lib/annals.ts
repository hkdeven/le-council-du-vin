// The Annals: committed, locked gathering results — and the disqualification
// ledger. Once the Keiser commits a reveal, it is recorded here, surfaces in
// the codex, and only the Keiser may amend it. Live (login enforced + Supabase):
// the `annals` table. Demo: per-browser localStorage.

import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

export interface AnnalRow {
  cloth: number | null; // the pour number; null when a hand-recorded night never knew it
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
// Keiser's convention: the LISTED ORDER carries the standing, so the first
// qualified wine in the record takes the crown (the cloth is the pour
// number, not the standing, and may be blank; phantom rows, with no owner
// and no title, are recording debris and never contend). Every surface
// that counts victories (codex crownings, chalices, the dossier, the
// prophecy's grade) must go through this, so a disqualified first place
// is never credited anywhere.
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
  return [substantial[0]];
}

const ANNALS_KEY = "lcv_annals";

// The demo codex is never bare: two committed nights (scores, prices,
// grapes, one disqualification) seed the store on first visit, like the
// rest of the demo's furniture. Live mode never sees these. The averages
// here are exactly what the seeded ballots (seed.ts seedBallots) compute,
// so the per-member breakdowns and the totals agree.
const SEED_ANNALS: AnnalEntry[] = [
  {
    gatheringId: "seed-night-1", number: 1, theme: "Cape Syrah", date: "2026-04-18",
    committed_at: "2026-04-19T09:00:00.000Z",
    rows: [
      { cloth: 1, owner: "Seer Matthew", title: "Porseleinberg 2021", score: 8.7, votes: 6, rank: 1, dq: false, varietals: ["Syrah"], price: 450 },
      { cloth: 2, owner: "The Keiser", title: "Reyneke Syrah 2022", score: 8.2, votes: 6, rank: 2, dq: false, varietals: ["Syrah"], price: 260 },
      { cloth: 3, owner: "Priestess Larissa", title: "Mullineux Kloof Street 2022", score: 7.8, votes: 6, rank: 3, dq: false, varietals: ["Syrah"], price: 165 },
      { cloth: 4, owner: "Elder Martin", title: "A chilled Pinotage", score: 5.8, votes: 6, rank: null, dq: true, varietals: ["Pinotage"], price: 120 },
    ],
  },
  {
    gatheringId: "seed-night-2", number: 2, theme: "White Blends", date: "2026-06-13",
    committed_at: "2026-06-14T09:00:00.000Z",
    rows: [
      { cloth: 1, owner: "The Keiser", title: "Palladius 2021", score: 8.8, votes: 5, rank: 1, dq: false, varietals: ["White Blend"], price: 780 },
      { cloth: 2, owner: "Adept Wernardt", title: "Sadie Skerpioen 2022", score: 8.2, votes: 5, rank: 2, dq: false, varietals: ["Chenin Blanc", "Palomino"], price: 420 },
      { cloth: 3, owner: "Seer Matthew", title: "Alheit Cartology 2022", score: 8.0, votes: 5, rank: 3, dq: false, varietals: ["Chenin Blanc"], price: 395 },
    ],
  },
];

// Disqualifications per member name, threshold five: at five the member is
// summoned before the tribunal and the Council votes to keep or cast them out.
export const DQ_THRESHOLD = 5;

function localAnnals(): AnnalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ANNALS_KEY);
    const parsed = raw == null ? null : (JSON.parse(raw) as AnnalEntry[]);
    if (parsed == null || parsed.length === 0) {
      localStorage.setItem(ANNALS_KEY, JSON.stringify(SEED_ANNALS));
      return [...SEED_ANNALS];
    }
    // Keep the furniture current: a browser that seeded an OLDER version of a
    // demo night (and never amended it — committed_at still wears the seeded
    // stamp) takes the code's values, so the annal's averages always agree
    // with the seeded ballots behind them. Amended nights are left alone.
    let refreshedAny = false;
    const refreshed = parsed.map((a) => {
      const seed = SEED_ANNALS.find((s) => s.gatheringId === a.gatheringId);
      if (seed && a.committed_at === seed.committed_at && JSON.stringify(a) !== JSON.stringify(seed)) {
        refreshedAny = true;
        return seed;
      }
      return a;
    });
    if (refreshedAny) localStorage.setItem(ANNALS_KEY, JSON.stringify(refreshed));
    return refreshed;
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

// Victories per member name, derived fresh from the committed entries — never
// incremented in place, so an amended or re-entered night can never double a
// crown, and a DQ applied after entry takes a wrongly credited win with it.
export function victoriesFrom(annals: AnnalEntry[]): Record<string, number> {
  const victories: Record<string, number> = {};
  for (const a of annals) {
    // Co-champions each count as a victory.
    for (const champ of championsOf(a)) {
      if (champ.owner) victories[champ.owner] = (victories[champ.owner] || 0) + 1;
    }
  }
  return victories;
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
