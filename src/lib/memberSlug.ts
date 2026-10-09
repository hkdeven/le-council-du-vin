// A HUMAN URL FOR EVERY SOUL: /member/dominik, /member/keiser, /member/larissa.
//
// The slug is the given name, the last word of the cult name, lowercased and
// stripped of accents ("Magus Dominik" -> "dominik", "The Keiser" -> "keiser").
// The full cult name slugged ("magus-dominik") is accepted too, so a link
// never breaks when a title changes hands, and it is the tie-breaker when two
// souls share a given name.
//
// Guarded by scripts/verify-member-slug.ts.

export interface Slugged {
  cult_name: string;
}

/** Lowercase ASCII words joined by hyphens; accents dropped, punctuation gone. */
export function slugify(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The friendly slug: the given name (last word of the cult name). */
export function givenSlug(cultName: string): string {
  const parts = slugify(cultName).split("-").filter(Boolean);
  return parts[parts.length - 1] || "";
}

/** Every slug this soul answers to, friendliest first. */
export function slugsFor(cultName: string): string[] {
  const full = slugify(cultName);
  const given = givenSlug(cultName);
  return given && given !== full ? [given, full] : [full];
}

/**
 * The link to share for one soul among the roster: the given name unless
 * another soul shares it, in which case the full cult name keeps them apart.
 */
export function slugFor<T extends Slugged>(member: T, roster: T[]): string {
  const given = givenSlug(member.cult_name);
  const clash = roster.some((m) => m !== member && m.cult_name !== member.cult_name && givenSlug(m.cult_name) === given);
  return clash || !given ? slugify(member.cult_name) : given;
}

/**
 * Who a slug names. An exact full-name match wins outright; otherwise every
 * soul whose given name matches is returned, so a shared given name becomes
 * a choice rather than a wrong card.
 */
export function findBySlug<T extends Slugged>(roster: T[], slug: string): T[] {
  const want = slugify(slug);
  if (!want) return [];
  const full = roster.filter((m) => slugify(m.cult_name) === want);
  if (full.length) return full.slice(0, 1);
  return roster.filter((m) => givenSlug(m.cult_name) === want);
}
