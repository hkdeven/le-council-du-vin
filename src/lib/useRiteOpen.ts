"use client";

import { useEffect, useState } from "react";
import type { Gathering } from "./types";
import { isRiteOpen, riteOpensAt } from "./gatherings";

// Whether the rite is open — and it re-renders the caller the moment it opens,
// so the "Enter the rite" button (and the rite page itself) appear without an
// app refresh.
export function useRiteOpen(g: Gathering | null): boolean {
  const [, tick] = useState(0);
  const open = isRiteOpen(g);

  useEffect(() => {
    if (!g || open) return;
    const ms = riteOpensAt(g).getTime() - Date.now();
    if (ms <= 0) {
      tick((n) => n + 1);
      return;
    }
    // Cap under setTimeout's max (~24.8 days); if longer, it fires early and
    // reschedules on the next render since `open` is still false.
    const delay = Math.min(ms + 400, 2_000_000_000);
    const id = setTimeout(() => tick((n) => n + 1), delay);
    return () => clearTimeout(id);
  }, [g, open]);

  return open;
}
