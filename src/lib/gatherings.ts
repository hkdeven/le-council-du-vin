import type { Gathering } from "./types";

// Gatherings the Keiser has summoned. Persisted per-browser in demo so the
// convene, rite, and reveal all read the same meetings; maps to the
// `gatherings` table when live.

const KEY = "lcv_gatherings";

export function loadGatherings(): Gathering[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]") as Gathering[];
    return list.sort((a, b) => a.gather_date.localeCompare(b.gather_date));
  } catch {
    return [];
  }
}

export function saveGatherings(list: Gathering[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

// The soonest meeting — what the rite and reveal operate on.
export function currentGathering(): Gathering | null {
  return loadGatherings()[0] ?? null;
}
