"use client";

import { useEffect, useState } from "react";
import type { Gathering } from "./types";
import { updateGathering } from "./gatherings";

// The number of wines for a gathering, sourced from the gathering itself
// (gatherings.wine_count) so Convene, the Rite and the Reveal always agree and
// every member sees the same count. The Keiser's changes persist through the
// gatherings layer (Supabase when live, localStorage in demo).
export function useWineCount(g: Gathering | null) {
  const [count, setCount] = useState(g?.wine_count ?? 6);

  // Re-sync whenever the gathering (or its stored count) arrives/changes —
  // this is the fix for the count defaulting to 11 while the gathering loaded.
  useEffect(() => {
    if (g) setCount(g.wine_count ?? 6);
  }, [g?.id, g?.wine_count]);

  const update = (n: number) => {
    const clamped = Math.max(1, Math.min(30, Math.round(n)));
    setCount(clamped);
    // Swallowing this left the count changed on screen and unchanged in the
    // vault: put it back and say so.
    if (g) updateGathering(g.id, { wine_count: clamped }).catch((e: Error) => {
      setCount(g.wine_count || 1);
      alert(`The count would not hold: ${e.message}`);
    });
  };

  return [count, update] as const;
}
