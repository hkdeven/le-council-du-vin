// Each member may privately log the wine they plan to bring to a gathering.
// It is hidden from every other soul — including the Keiser — until the reveal.
// Demo mode keeps it in localStorage (per-browser, so inherently private);
// live mode maps to a `bottles` table whose RLS lets only the owner read/write
// their row until the gathering is revealed.

const key = (gatheringId: string, memberId: string) => `lcv_bottle_${gatheringId}_${memberId}`;

export function getBottleTitle(gatheringId: string, memberId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key(gatheringId, memberId));
  } catch {
    return null;
  }
}

export function setBottleTitle(gatheringId: string, memberId: string, title: string) {
  if (typeof window === "undefined") return;
  try {
    const k = key(gatheringId, memberId);
    if (title.trim()) localStorage.setItem(k, title.trim());
    else localStorage.removeItem(k);
  } catch {}
}
