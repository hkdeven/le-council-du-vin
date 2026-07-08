// Stale-while-revalidate for the Council's list data: pages paint from the
// last snapshot instantly (no zeros, no spinner after the first visit), then
// the fresh truth lands and corrects anything stale — same trick as the login
// member cache. Live mode only: demo data already lives in localStorage.

import { gatheringsLive } from "./gatherings";

const keyOf = (key: string) => `lcv_swr_${key}`;

// Calls onData up to twice: once with the cached snapshot (fresh=false, if one
// exists), once with the fetched truth (fresh=true). Fetch errors are silent —
// the snapshot, if any, remains on screen.
export function swr<T>(key: string, fetcher: () => Promise<T>, onData: (data: T, fresh: boolean) => void): void {
  if (!gatheringsLive()) {
    fetcher().then((d) => onData(d, true)).catch(() => {});
    return;
  }
  try {
    const raw = localStorage.getItem(keyOf(key));
    if (raw) onData(JSON.parse(raw) as T, false);
  } catch {}
  fetcher()
    .then((data) => {
      writeSwr(key, data);
      onData(data, true);
    })
    .catch(() => {});
}

// For write paths that refetch (commits, claims): keep the snapshot honest so
// the next visit doesn't flash pre-edit data.
export function writeSwr<T>(key: string, data: T): void {
  if (!gatheringsLive()) return;
  try { localStorage.setItem(keyOf(key), JSON.stringify(data)); } catch {}
}
