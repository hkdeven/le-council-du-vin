// Binding, spoiling, and the arithmetic of a night.
//
// Two things can happen at a table that a flat list of cloths cannot express:
//
//   1. TWO SOULS BRING THE SAME WINE. Each poured into a cloth of its own, so
//      the table scored one wine twice and it took two places. The Keiser binds
//      the cloths; they become one entry carrying every pour number, the mean
//      of every verdict cast on any of them, and a single standing.
//
//   2. A BOTTLE IS SPOILED. It measures the bottle, not the soul who carried
//      it, so it is recorded and never judged: no standing, no score, and no
//      weight anywhere a member's average is reckoned. It is NOT a
//      disqualification; casting out counts against a soul and five of them
//      summon them to the tribunal, and a spoiled wine is nobody's fault.
//
// Everything here is pure: no React, no database, no clock. scripts/verify-tally.ts
// holds the arithmetic to account.

export interface TallyRow {
  cloth: number;
  title: string;
  owner: string;
  score: number; // the mean verdict on THIS cloth
  votes: number; // how many souls judged it
  dq: boolean;
  spoiled?: boolean;
  // The group a bound cloth belongs to: the lowest cloth number in the set.
  // Null, or absent, and the cloth stands alone.
  bind?: number | null;
}

export interface BoundRow {
  cloth: number; // the group key: the lowest pour number in the set
  cloths: number[]; // every pour number, ascending
  title: string;
  owner: string; // every bearer, as the record writes them
  owners: string[];
  score: number; // the mean of every verdict cast on every sound cloth
  votes: number; // how many verdicts that mean rests on
  dq: boolean;
  spoiled: boolean;
  rows: TallyRow[]; // the physical cloths behind it, in pour order
}

// A cloth's group. Binding to a cloth that is not in the night, or to itself,
// leaves it standing alone rather than vanishing into a group of nobody.
export const bindKeyOf = (r: TallyRow, present?: Set<number>): number => {
  const k = r.bind;
  if (k == null || k === r.cloth) return r.cloth;
  if (present && !present.has(k)) return r.cloth;
  return k;
};

// The mean of every individual verdict, not the mean of the means: a cloth
// judged by seven souls must weigh more than one judged by two.
function weightedMean(rows: TallyRow[]): { score: number; votes: number } {
  const votes = rows.reduce((n, r) => n + (r.votes || 0), 0);
  if (votes <= 0) return { score: 0, votes: 0 };
  const total = rows.reduce((n, r) => n + (r.score || 0) * (r.votes || 0), 0);
  return { score: total / votes, votes };
}

// Collapse the bound cloths into single entries. A cloth that is bound to
// nothing comes through untouched, which is every cloth on an ordinary night.
export function bindRows(rows: TallyRow[]): BoundRow[] {
  const present = new Set(rows.map((r) => r.cloth));
  const groups = new Map<number, TallyRow[]>();
  for (const r of rows) {
    const k = bindKeyOf(r, present);
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }

  const out: BoundRow[] = [];
  for (const [, g] of groups) {
    const members = [...g].sort((a, b) => a.cloth - b.cloth);
    // One bottle of three being corked says nothing about the other two, so a
    // spoiled cloth is dropped from the mean rather than dragging it down.
    // Only when every cloth was spoiled is the wine itself unjudgeable.
    const sound = members.filter((r) => !r.spoiled);
    const spoiled = sound.length === 0;
    const { score, votes } = weightedMean(spoiled ? [] : sound);
    out.push({
      cloth: members[0].cloth,
      cloths: members.map((r) => r.cloth),
      // The name is whatever hand got to it first; bound cloths are one wine.
      title: members.find((r) => r.title)?.title || "",
      owners: members.map((r) => r.owner).filter(Boolean),
      owner: members.map((r) => r.owner).filter(Boolean).join(" and "),
      score,
      votes,
      // They are the same wine, so a ruling of "off theme" falls on all of it.
      dq: members.some((r) => r.dq),
      spoiled,
      rows: members,
    });
  }
  return out.sort((a, b) => a.cloth - b.cloth);
}

// Which entries contend for a standing. A disqualified wine is out by the
// Keiser's word, a spoiled one by misfortune, and an unjudged one has nothing
// to stand on.
export const contends = (r: { dq: boolean; spoiled: boolean; votes: number }) => !r.dq && !r.spoiled && r.votes > 0;

// Competition ranking: ties share a place, and the next wine takes the place
// its score has actually earned (two seconds, then a fourth).
export function rankIn(all: BoundRow[], row: BoundRow): number | null {
  if (!contends(row)) return null;
  const field = all.filter(contends);
  return 1 + field.filter((x) => x.score > row.score).length;
}

// The night's champion, or champions when the top score is shared, which is
// exactly how bound cloths and an honest tie both come out.
export function championsIn(all: BoundRow[]): BoundRow[] {
  const field = all.filter(contends);
  if (!field.length) return [];
  const top = Math.max(...field.map((r) => r.score));
  if (top <= 0) return [];
  return field.filter((r) => r.score === top);
}

// The whole night, bound and placed, ordered as the reveal reads it: the
// standing wines by their place, then the spoiled, then the cast out.
export function placeNight(rows: TallyRow[]): { row: BoundRow; rank: number | null }[] {
  const bound = bindRows(rows);
  const ranked = bound.map((row) => ({ row, rank: rankIn(bound, row) }));
  const order = (x: { row: BoundRow; rank: number | null }) => (x.rank != null ? 0 : x.row.spoiled ? 1 : 2);
  return ranked.sort((a, b) => order(a) - order(b) || (a.rank ?? 0) - (b.rank ?? 0) || a.row.cloth - b.row.cloth);
}

// What each physical cloth is written as in the Annals.
//
// The record stays flat, one line per bottle actually carried, because the
// chalices and the victories are counted per soul. But NOBODY KNOWS WHICH
// GLASS WAS WHOSE: three souls poured the same wine into three cloths and
// the table judged the cloths, not the bearers. Crediting one of them with
// 7.8 and another with 6.9 would be inventing a fact. So every bound row
// carries the GROUP'S score, the group's vote count and the group's place,
// and the three bearers stand exactly level.
//
// Each row also keeps `raw` for its own cloth, which is the only thing that
// makes amendment safe: this function runs again on every amendment, and
// re-averaging an average would walk the score and double the votes on each
// save. Writers must feed the raw figures back in, never the shared ones.
export interface AnnalScore { score: number; votes: number; rank: number | null; rawScore: number; rawVotes: number }

export function annalScores(rows: TallyRow[]): Map<number, AnnalScore> {
  const bound = bindRows(rows);
  const out = new Map<number, AnnalScore>();
  for (const b of bound) {
    const rank = rankIn(bound, b);
    for (const r of b.rows) {
      // A spoiled cloth keeps its own verdict in the record and takes no
      // place: it was never judged on merit, whatever its siblings earned.
      out.set(r.cloth, r.spoiled
        ? { score: r.score, votes: r.votes, rank: null, rawScore: r.score, rawVotes: r.votes }
        : { score: b.score, votes: b.votes, rank, rawScore: r.score, rawVotes: r.votes });
    }
  }
  return out;
}
