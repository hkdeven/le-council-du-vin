"use client";

import { useEffect, useState } from "react";

// The number of wines for a gathering. The Keiser sets it at the start and can
// adjust it during scoring. Persisted to localStorage per gathering so it's
// shared between Convene and the Rite in demo; once live this maps to
// `gatherings.wine_count`.
export function useWineCount(gatheringId: string, fallback: number) {
  const key = `lcv_wine_count_${gatheringId}`;
  const [count, setCount] = useState(fallback);

  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (v) setCount(parseInt(v, 10));
  }, [key]);

  const update = (n: number) => {
    const clamped = Math.max(1, Math.min(30, Math.round(n)));
    setCount(clamped);
    if (typeof window !== "undefined") localStorage.setItem(key, String(clamped));
    // Once live: also persist to gatherings.wine_count for this gathering.
  };

  return [count, update] as const;
}
