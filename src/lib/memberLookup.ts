// WHICH ROW IS THIS SOUL'S, and nothing else.
//
// Access hangs entirely on this: `hasAccess = !!member`. Get it wrong in one
// direction and a full member is told they are not of the Council (James, shut
// out for six weeks by a capital letter). Get it wrong in the other and one
// member is handed another member's row, which is far worse.
//
// The lookup asks the database with `ilike`, which is case-blind but ALSO
// treats `_` and `%` as wildcards, so `a_b@x.com` can match `aXb@x.com`. The
// database query is therefore only a net: this function decides the match, and
// it compares canonically and exactly. Nothing is accepted on the strength of
// the ilike alone.
//
// Guarded by scripts/verify-member-lookup.ts.

/** The canonical form of an address: what every comparison must happen on. */
export function canonicalEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

/**
 * The caller's own row out of whatever the query surrendered, or null.
 * A row matches only when its canonical address equals the canonical address
 * we are looking for. Case and surrounding space are ignored; nothing else is.
 */
export function pickMemberRow<T extends { email?: string | null }>(
  rows: T[] | null | undefined,
  email: string | null | undefined
): T | null {
  const want = canonicalEmail(email);
  if (!want) return null;
  return (rows || []).find((r) => canonicalEmail(r.email) === want) ?? null;
}
