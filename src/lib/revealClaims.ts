// Who holds which bottle on the night, decided in one place and nowhere else.
//
// A claim is a number on the claimant's own offering row (offerings.cloth).
// The reveal draws its rows from the ballots (scores) and then lays the
// claims over them here: the owner's name, and the wine, grapes and price the
// owner logged before the night, wherever the Keiser has not written
// something over them by hand. The Keiser's commit writes the result to the
// annals, so every claim made on the night is in the record without any soul
// but the claimant having to write anything.
//
// Pure, so it can be held by scripts/verify-reveal-claims.ts.

import type { Offering } from "./bottles";

export interface ClaimableRow {
  cloth: number;
  owner: string;
  title: string;
  varietals?: string[];
  price?: number | null;
}

// The member id whose offering claims this cloth, or null. If two rows ever
// share a cloth (the vault forbids it; demo mode has no vault) the lowest id
// wins, so every viewer sees the same hand.
export function claimantOf(offerings: Record<string, Offering>, cloth: number): string | null {
  const ids = Object.keys(offerings).filter((id) => offerings[id]?.cloth === cloth).sort();
  return ids[0] ?? null;
}

// The cloth this member has claimed on this night, or null.
export function claimedCloth(offerings: Record<string, Offering>, memberId: string | null): number | null {
  if (!memberId) return null;
  const c = offerings[memberId]?.cloth;
  return typeof c === "number" ? c : null;
}

// Lay the claims over the rows. A row already owned (a name the Keiser wrote
// in by hand) is never overwritten by a claim: the Keiser's hand is final.
export function applyClaims<R extends ClaimableRow>(
  rows: R[],
  offerings: Record<string, Offering>,
  names: Record<string, string>,
): R[] {
  return rows.map((r) => {
    if (r.owner) return r;
    const id = claimantOf(offerings, r.cloth);
    if (!id) return r;
    const off = offerings[id];
    return {
      ...r,
      owner: names[id] || "A soul yet unnamed",
      title: r.title || off.title || "",
      varietals: r.varietals?.length ? r.varietals : off.varietals?.length ? off.varietals : undefined,
      price: r.price ?? off.price ?? undefined,
    };
  });
}

// Claimants whose names are not known. The commit must refuse while any
// exist: writing "A soul yet unnamed" into the annals would make the record
// wrong for ever, on the one write that counts, over a name that was merely
// slow to load.
export function unnamedClaimants(offerings: Record<string, Offering>, names: Record<string, string>): string[] {
  return Object.keys(offerings)
    .filter((id) => typeof offerings[id]?.cloth === "number" && !names[id])
    .sort();
}
