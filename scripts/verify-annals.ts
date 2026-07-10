// Checks for championsOf(), the single source of truth for who took a night.
//
//   npx tsx scripts/verify-annals.ts

import { championsOf, type AnnalEntry, type AnnalRow } from "../src/lib/annals";

const night = (rows: AnnalRow[]): AnnalEntry => ({ gatheringId: "g", number: 1, theme: "t", date: "2024-01-01", committed_at: "", rows });
const r = (owner: string, opts: Partial<AnnalRow> = {}): AnnalRow => ({ cloth: 1, owner, title: opts.title ?? (owner ? "A wine" : ""), score: 0, votes: 0, rank: null, dq: false, ...opts });

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const owners = (a: AnnalEntry) => championsOf(a).map((x) => x.owner).join(",");

// The French reds case: three DQs, one unscored survivor.
check("unscored night, 3 DQs: sole survivor crowned",
  owners(night([r("A", { dq: true }), r("B", { dq: true }), r("C", { dq: true }), r("Seer Matthew")])) === "Seer Matthew");

// The same night sealed with a leftover blank row: the phantom cannot block the crown.
check("leftover blank row does not block the crown",
  owners(night([r("A", { dq: true }), r("B", { dq: true }), r("C", { dq: true }), r("Seer Matthew"), r("", { title: "" })])) === "Seer Matthew");

// A named-but-unclaimed second survivor is a real contender: no crown.
check("a second real unscored survivor: no crown",
  championsOf(night([r("A", { dq: true }), r("Seer Matthew"), r("", { title: "Mystery Syrah" })])).length === 0);

// Scored night, normal: rank 1 non-DQ wins.
check("scored night: rank 1 crowned",
  owners(night([r("A", { rank: 1, score: 8.5, votes: 5 }), r("B", { rank: 2, score: 7, votes: 5 })])) === "A");

// Scored night where the raw first place is DQ'd: best survivor promoted, DQ never credited.
{
  const champs = championsOf(night([r("A", { rank: 1, score: 9, votes: 5, dq: true }), r("B", { rank: 2, score: 8, votes: 5 }), r("C", { rank: 3, score: 7, votes: 5 })]));
  check("DQ'd first place: next best promoted", champs.map((x) => x.owner).join() === "B");
  check("DQ'd first place: DQ member never credited", !champs.some((x) => x.owner === "A"));
}

// Unscored night, two substantial survivors: ambiguous, no crown.
check("unscored night, two survivors: no crown",
  championsOf(night([r("A", { dq: true }), r("B"), r("C")])).length === 0);

// Unscored night, no DQs at all: no crown invented.
check("unscored night, no DQs: no crown invented",
  championsOf(night([r("A"), r("B")])).length === 0);

// All DQ'd: nobody.
check("all disqualified: no champion",
  championsOf(night([r("A", { dq: true }), r("B", { dq: true })])).length === 0);

// Tie among survivors after a DQ'd first: co-champions.
check("tied survivors share the crown",
  owners(night([r("A", { rank: 1, score: 9, votes: 5, dq: true }), r("B", { rank: 2, score: 8, votes: 5 }), r("C", { rank: 2, score: 8, votes: 5 })])) === "B,C");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
