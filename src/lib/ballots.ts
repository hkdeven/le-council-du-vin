// Sealed ballots from the rite, and the reckoning math the reveal runs on them.
// Demo mode persists per-browser; live mode maps to the `scores` table.

export interface Ballot {
  scores: Record<number, number>; // cloth number -> 1..10
  sealed: boolean;
}

const key = (gatheringId: string, memberId: string) => `lcv_ballot_${gatheringId}_${memberId}`;

export function loadBallot(gatheringId: string, memberId: string): Ballot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(gatheringId, memberId));
    return raw ? (JSON.parse(raw) as Ballot) : null;
  } catch {
    return null;
  }
}

export function saveBallot(gatheringId: string, memberId: string, ballot: Ballot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(gatheringId, memberId), JSON.stringify(ballot));
  } catch {}
}

// Average each cloth's score across every sealed ballot found.
export function tallyScores(
  gatheringId: string,
  memberIds: string[],
  wineCount: number
): Record<number, { avg: number; votes: number }> {
  const out: Record<number, { avg: number; votes: number }> = {};
  for (let cloth = 1; cloth <= wineCount; cloth++) out[cloth] = { avg: 0, votes: 0 };
  for (const mid of memberIds) {
    const b = loadBallot(gatheringId, mid);
    if (!b?.sealed) continue;
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
