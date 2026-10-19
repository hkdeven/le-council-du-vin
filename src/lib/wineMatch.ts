// Recognising the same wine twice.
//
// Two questions are asked of a wine as a member logs it:
//
//   1. Has somebody already logged this one for tonight? Nobody is named,
//      and nobody is stopped: the Keiser can bind the cloths afterwards, and
//      the member may simply want to know.
//   2. Has the Council tasted it before? The annals are the Council's own
//      public record, so this one names the night and the bearer.
//
// Matching a wine by its name is guesswork, so the rules here are
// deliberately cautious: a warning that cries wolf is worse than none.
// Everything is pure. scripts/verify-wine-match.ts holds it to account.

export interface PastTasting {
  number: number; // the gathering
  date: string;
  owner: string;
  title: string;
  vintage: number | null;
  score: number | null; // null when the night was recorded without scores
  rank: number | null;
}

// Fold away everything that is punctuation, accent or flourish, so "Kanonkop
// Paul Sauer" and "kanonkop paul-sauer" are one wine.
export function normalise(title: string): string {
  return (title || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The vintage, when the name carries one. Anything outside living memory of
// a wine club is a quantity, not a year.
export function vintageOf(title: string): number | null {
  const years = (title || "").match(/\b(19\d{2}|20\d{2})\b/g);
  if (!years) return null;
  const n = Number(years[years.length - 1]);
  return n >= 1900 && n <= new Date().getFullYear() + 1 ? n : null;
}

// The name with its vintage taken out, which is what decides whether two
// bottles are the same WINE. The vintage is reported separately, because
// "we have had this, the 2019" is worth saying and is not the same warning.
export const bareName = (title: string): string =>
  normalise(title).replace(/\b(19\d{2}|20\d{2})\b/g, " ").replace(/\s+/g, " ").trim();

// Cautious on purpose. Equal names match. One name wholly inside another
// matches only when the shorter still carries two words, so "Kanonkop Paul
// Sauer" meets "Kanonkop Paul Sauer Estate" but a bare "Kanonkop" never
// sweeps up every wine the estate makes.
export function sameWine(a: string, b: string): boolean {
  const x = bareName(a);
  const y = bareName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.split(" ").length < 2) return false;
  return long.startsWith(`${short} `) || long.endsWith(` ${short}`) || long.includes(` ${short} `);
}

// Every past night this wine was poured on, most recent first. A bottle cast
// out or spoiled still counts as tasted: the table did put it in a glass.
export function tastedBefore(
  title: string,
  annals: { number: number; date: string; rows: { title?: string; owner?: string; score?: number; votes?: number; rank?: number | null }[] }[],
): PastTasting[] {
  const out: PastTasting[] = [];
  for (const a of annals) {
    for (const r of a.rows) {
      if (!r.title || !sameWine(title, r.title)) continue;
      out.push({
        number: a.number,
        date: a.date,
        owner: r.owner || "",
        title: r.title,
        vintage: vintageOf(r.title),
        score: (r.votes ?? 0) > 0 ? r.score ?? null : null,
        rank: r.rank ?? null,
      });
    }
  }
  return out.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
}

// What the member is told about a wine the Council has met before. Three
// lines, each standing on its own: the charge, the evidence, the sentence.
export interface MetBefore { lead: string; detail: string; tail: string }

export function tastedBeforeWords(title: string, past: PastTasting[]): MetBefore | null {
  if (!past.length) return null;
  const last = past[0];
  const who = last.owner ? `brought by ${last.owner}` : "bearer unrecorded";
  const how = last.score != null ? `, and it scored ${last.score.toFixed(1)}` : "";
  const mine = vintageOf(title);
  const vintageNote = mine != null && last.vintage != null && mine !== last.vintage
    ? ` That was the ${last.vintage}; yours is the ${mine}.`
    : "";
  const again = past.length > 1 ? ` The Council has met it ${past.length} times.` : "";
  return {
    lead: "Be original. The Council has tasted this before!",
    detail: `Gathering ${roman(last.number)}, ${who}${how}.${vintageNote}${again}`,
    tail: "Bring it if you must, but you will be ridiculed and looked down upon.",
  };
}

// And the one about tonight, which is a popup rather than a line, because a
// second bottle of the same wine costs the table a standing. It names nobody,
// by decree.
export const alreadyTonightWords = () =>
  "Someone else has already logged this wine for the night! Bring it if you must, but your score and ranking will be pooled and averaged with the other matching bottles. You are highly encouraged to bring a different bottle.";

function roman(n: number): string {
  const map: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out || "I";
}
