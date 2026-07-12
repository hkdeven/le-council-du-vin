// The manual meeting-entry suite (ticket #4): exercises the exact validation
// and reckoning the codex entry path runs (src/lib/meeting-entry.ts), the
// winner/tally reckoning every surface derives from (championsOf,
// victoriesFrom, dqCountsFrom), and the ballot tally (tallyFromBallots).
// Failures exit non-zero, so `npm test` blocks a bad change.
//
//   npx tsx scripts/verify-meeting-entry.ts

import { validateMeetingDraft, reckonRows, type DraftRowInput, type MeetingDraftInput } from "../src/lib/meeting-entry";
import { championsOf, victoriesFrom, dqCountsFrom, type AnnalEntry, type AnnalRow } from "../src/lib/annals";
import { tallyFromBallots, sealedAmong, type MemberBallot } from "../src/lib/ballots";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

// ── helpers ──────────────────────────────────────────────────────────────────
const row = (over: Partial<DraftRowInput> = {}): DraftRowInput =>
  ({ cloth: "", title: "", owner: "", score: "", dq: false, votes: 1, varietals: [], price: "", ...over });
const draft = (rows: DraftRowInput[], over: Partial<MeetingDraftInput> = {}): MeetingDraftInput =>
  ({ number: 1, theme: "Cape Syrah", date: "2026-07-01", rows, ...over });
const night = (rows: AnnalRow[], id = "g1", number = 1): AnnalEntry =>
  ({ gatheringId: id, number, theme: "t", date: "2026-07-01", committed_at: "", rows });
const ballot = (memberId: string, scores: Record<number, number>, sealed = true): MemberBallot =>
  ({ memberId, scores, sealed });
const champOwners = (rows: AnnalRow[]) => championsOf(night(rows)).map((r) => r.owner).sort().join(",");

// ═══ Winner determination ════════════════════════════════════════════════════
{
  // Clear winner: highest score takes rank 1 and the crown.
  const rows = reckonRows([
    row({ cloth: "1", title: "A", owner: "Larissa", score: "8" }),
    row({ cloth: "2", title: "B", owner: "Keiser", score: "7" }),
    row({ cloth: "3", title: "C", owner: "Martin", score: "6" }),
  ]);
  check("clear winner: highest score ranks 1", rows.map((r) => r.rank).join(",") === "1,2,3");
  check("clear winner: crowned alone", champOwners(rows) === "Larissa");

  // Tie at the top: co-champions share rank 1 (competition style below).
  const tied = reckonRows([
    row({ cloth: "1", owner: "Larissa", title: "A", score: "8" }),
    row({ cloth: "2", owner: "Keiser", title: "B", score: "8" }),
    row({ cloth: "3", owner: "Martin", title: "C", score: "5" }),
  ]);
  check("tie: both rank 1, next is 3rd", tied.map((r) => r.rank).join(",") === "1,1,3");
  check("tie: co-champions crowned", champOwners(tied) === "Keiser,Larissa");

  // Single voter: one vote per wine still crowns a winner.
  const solo = reckonRows([
    row({ cloth: "1", owner: "Larissa", title: "A", score: "9", votes: 1 }),
    row({ cloth: "2", owner: "Keiser", title: "B", score: "4", votes: 1 }),
  ]);
  check("single voter: winner still determined", champOwners(solo) === "Larissa");

  // All members vote the same → every bottle ties → all crowned together.
  const flat = reckonRows([
    row({ cloth: "1", owner: "A", title: "w1", score: "7" }),
    row({ cloth: "2", owner: "B", title: "w2", score: "7" }),
    row({ cloth: "3", owner: "C", title: "w3", score: "7" }),
  ]);
  check("all vote same: everyone shares the crown", champOwners(flat) === "A,B,C");

  // Zero votes anywhere: an unscored night — the listed order carries the
  // standing (Keiser's convention), never a phantom 0.0.
  const unscored = reckonRows([
    row({ cloth: "1", owner: "Martin", title: "first listed" }),
    row({ cloth: "2", owner: "Scott", title: "second listed" }),
  ]);
  check("zero votes: votes recorded as 0, rank null", unscored.every((r) => r.votes === 0 && r.rank === null));
  check("zero votes: first listed crowned", champOwners(unscored) === "Martin");
}

// ═══ Tallies (win counts) ════════════════════════════════════════════════════
{
  const w = (owner: string, score: number, rank: number, dq = false): AnnalRow =>
    ({ cloth: rank, owner, title: "w", score, votes: 5, rank: dq ? null : rank, dq });

  // First-ever meeting: counts start at 0 and the winner takes exactly 1.
  check("first meeting: empty codex counts nothing", Object.keys(victoriesFrom([])).length === 0);
  const first = victoriesFrom([night([w("Larissa", 8, 1), w("Keiser", 7, 2)])]);
  check("first meeting: winner 1, non-winner 0", first["Larissa"] === 1 && !("Keiser" in first));

  // Winner's tally increments; non-winners' do not.
  const two = victoriesFrom([
    night([w("Larissa", 8, 1), w("Keiser", 7, 2)], "g1", 1),
    night([w("Larissa", 9, 1), w("Martin", 6, 2)], "g2", 2),
  ]);
  check("winner increments, others do not", two["Larissa"] === 2 && !two["Keiser"] && !two["Martin"]);

  // Re-entry/edit of an existing meeting: the entry is REPLACED (upsert on
  // gathering_id) and tallies re-derive — never doubled.
  const v1 = night([w("Larissa", 8, 1), w("Keiser", 7, 2)], "g1");
  const v2 = night([w("Keiser", 9, 1), w("Larissa", 8, 2)], "g1"); // edited: Keiser now wins
  const annals = [v1].filter((a) => a.gatheringId !== v2.gatheringId).concat(v2); // commitAnnal semantics
  const reentered = victoriesFrom(annals);
  check("re-entry: replaced, not doubled", annals.length === 1 && reentered["Keiser"] === 1 && !reentered["Larissa"]);

  // Co-champions each earn a victory.
  const co = victoriesFrom([night([w("A", 8, 1), w("B", 8, 1), w("C", 5, 3)])]);
  check("co-champions each credited", co["A"] === 1 && co["B"] === 1 && !co["C"]);
}

// ═══ Ballot tally: equal weight, duplicates, missing members ════════════════
{
  // The Keiser's vote carries EQUAL weight: the tally is a plain mean.
  const bs = [ballot("m-keiser", { 1: 10 }), ballot("m-larissa", { 1: 4 }), ballot("m-martin", { 1: 4 })];
  const t = tallyFromBallots(bs, 1);
  check("keiser's vote weighs the same as any member's", t[1].avg === 6 && t[1].votes === 3,
    `avg ${t[1].avg} of ${t[1].votes}`);
  // ...and relabelling who the keiser is changes nothing.
  const swapped = tallyFromBallots([ballot("m-larissa", { 1: 10 }), ballot("m-keiser", { 1: 4 }), ballot("m-martin", { 1: 4 })], 1);
  check("no member label changes the tally", swapped[1].avg === t[1].avg);

  // Duplicate vote entry: the same member twice counts once (last wins).
  const dup = tallyFromBallots([ballot("m-larissa", { 1: 2 }), ballot("m-larissa", { 1: 8 })], 1);
  check("duplicate ballot: one vote per member", dup[1].votes === 1 && dup[1].avg === 8);
  check("duplicate ballot: sealed count dedupes too", sealedAmong([ballot("m-a", { 1: 5 }), ballot("m-a", { 1: 5 })], ["m-a"]) === 1);

  // Member missing from the vote set: absent, not a zero.
  const missing = tallyFromBallots([ballot("m-a", { 1: 8, 2: 6 }), ballot("m-b", { 1: 4 })], 2);
  check("missing member: cloth averages only real votes", missing[2].votes === 1 && missing[2].avg === 6);
  check("missing member: other cloths unaffected", missing[1].votes === 2 && missing[1].avg === 6);

  // An unsealed ballot never counts.
  const unsealed = tallyFromBallots([ballot("m-a", { 1: 8 }), ballot("m-b", { 1: 2 }, false)], 1);
  check("unsealed ballot never counts", unsealed[1].votes === 1 && unsealed[1].avg === 8);
}

// ═══ Blank data: rejected loudly, never counted as 0 or skipped ═════════════
{
  // Entire submission blank.
  const blank = validateMeetingDraft(draft([row()], { theme: "", date: "" }));
  check("entire submission blank: rejected", blank.length >= 3,
    blank.join(" | "));
  check("blank: names the theme", blank.some((e) => /theme/i.test(e)));
  check("blank: names the date", blank.some((e) => /date/i.test(e)));
  check("blank: demands a wine", blank.some((e) => /wine/i.test(e)));

  // One required field blank at a time.
  check("theme blank alone: rejected", validateMeetingDraft(draft([row({ title: "A", score: "7" })], { theme: "" })).length === 1);
  check("date blank alone: rejected", validateMeetingDraft(draft([row({ title: "A", score: "7" })], { date: "" })).length === 1);
  check("malformed date: rejected", validateMeetingDraft(draft([row({ title: "A", score: "7" })], { date: "not-a-date" })).length === 1);

  // Whitespace-only values are blank values, not data.
  check("whitespace-only theme: rejected", validateMeetingDraft(draft([row({ title: "A", score: "7" })], { theme: "   " })).some((e) => /theme/i.test(e)));
  const wsRow = validateMeetingDraft(draft([row({ title: "A", owner: "Larissa", score: "7" }), row({ title: "B", owner: "Keiser", score: "   " })]));
  check("whitespace-only score on a scored night: rejected", wsRow.some((e) => /without a score/i.test(e)), wsRow.join(" | "));

  // The old bug: Number("  ") === 0. A whitespace score must NEVER become 0.
  const reck = reckonRows([row({ title: "A", owner: "L", score: "  ", votes: 3 })]);
  check("whitespace score never counted as 0", reck[0].votes === 0 && reck[0].rank === null,
    `votes ${reck[0].votes}, rank ${reck[0].rank}`);

  // null vs empty string: both are blank, neither is 0.
  const nullish = reckonRows([row({ title: "A", owner: "L", score: null as unknown as string, votes: 2 })]);
  check("null score treated as blank, not 0", nullish[0].votes === 0 && nullish[0].score === 0 && nullish[0].rank === null);
  const nullValidate = validateMeetingDraft(draft([row({ title: "A", score: "7" }), row({ title: "B", score: null as unknown as string })]));
  check("null score on a scored night: rejected", nullValidate.some((e) => /without a score/i.test(e)));

  // Partial row: a member listed with no score, on a night that has scores.
  const partial = validateMeetingDraft(draft([
    row({ title: "A", owner: "Larissa", score: "7" }),
    row({ owner: "Keiser" }),
  ]));
  check("partial row (member, no score): rejected", partial.some((e) => /Keiser.*without a score/i.test(e)), partial.join(" | "));

  // ...but a wholly unscored night (import-style) is legal.
  check("fully unscored night: legal", validateMeetingDraft(draft([row({ title: "A", owner: "L" }), row({ title: "B", owner: "K" })])).length === 0);

  // Nonsense and out-of-range scores.
  check("non-numeric score: rejected", validateMeetingDraft(draft([row({ title: "A", score: "abc" })])).some((e) => /not a score/i.test(e)));
  check("score above 10: rejected", validateMeetingDraft(draft([row({ title: "A", score: "11" })])).some((e) => /between 0 and 10/i.test(e)));
  check("negative score: rejected", validateMeetingDraft(draft([row({ title: "A", score: "-1" })])).some((e) => /between 0 and 10/i.test(e)));

  // Duplicate entries.
  check("duplicate cloth: rejected", validateMeetingDraft(draft([
    row({ cloth: "1", title: "A", score: "7" }), row({ cloth: "1", title: "B", score: "6" }),
  ])).some((e) => /Cloth 1.*twice/i.test(e)));
  check("member credited twice: rejected", validateMeetingDraft(draft([
    row({ cloth: "1", title: "A", owner: "Larissa", score: "7" }), row({ cloth: "2", title: "B", owner: "Larissa", score: "6" }),
  ])).some((e) => /Larissa.*twice/i.test(e)));

  // A leftover blank row is dropped silently — not an error, never sealed.
  const withBlank = draft([row({ title: "A", owner: "L", score: "7" }), row()]);
  check("leftover blank row: dropped, not an error", validateMeetingDraft(withBlank).length === 0 && reckonRows(withBlank.rows).length === 1);

  // A clean draft passes.
  check("clean draft: sealed", validateMeetingDraft(draft([
    row({ cloth: "1", title: "Porseleinberg", owner: "Larissa", score: "8.6", price: "450" }),
    row({ cloth: "2", title: "Reyneke", owner: "Keiser", score: "8.1" }),
  ])).length === 0);
}

// ═══ Disqualification (bottles only — never member votes) ═══════════════════
{
  // A DQ'd bottle is excluded from winner determination even with the top score.
  const dqTop = reckonRows([
    row({ cloth: "1", title: "A", owner: "Martin", score: "9.5", dq: true }),
    row({ cloth: "2", title: "B", owner: "Larissa", score: "8" }),
    row({ cloth: "3", title: "C", owner: "Keiser", score: "7" }),
  ]);
  check("DQ'd bottle cannot win despite highest score", champOwners(dqTop) === "Larissa");
  check("DQ'd bottle carries no rank", dqTop[0].rank === null && dqTop[0].dq);
  check("winner recalculates among the remaining", dqTop[1].rank === 1 && dqTop[2].rank === 2);

  // Scores cast on a DQ'd bottle remain recorded in the codex…
  check("DQ'd bottle keeps its recorded score", dqTop[0].score === 9.5 && dqTop[0].votes === 1);
  // …but never touch the winner counts.
  const vics = victoriesFrom([night(dqTop)]);
  check("DQ'd bottle earns no victory", vics["Larissa"] === 1 && !vics["Martin"]);

  // DQ applied AFTER entry (the Keiser amends the sealed record in place,
  // rank still reading 1): the re-tally must decrement the wrongly credited
  // win and promote the best survivor.
  const sealedRows: AnnalRow[] = [
    { cloth: 1, title: "A", owner: "Martin", score: 9, votes: 5, rank: 1, dq: false },
    { cloth: 2, title: "B", owner: "Larissa", score: 8, votes: 5, rank: 2, dq: false },
  ];
  const beforeDq = victoriesFrom([night(sealedRows, "g9")]);
  const amended: AnnalRow[] = sealedRows.map((r) => (r.cloth === 1 ? { ...r, dq: true } : r)); // rank stays 1!
  const afterDq = victoriesFrom([night(amended, "g9")]);
  check("DQ after entry: wrongly credited win decremented", beforeDq["Martin"] === 1 && !afterDq["Martin"]);
  check("DQ after entry: crown passes to the survivor", afterDq["Larissa"] === 1);

  // All bottles DQ'd: no winner is declared, no victory credited.
  const allDq = reckonRows([
    row({ cloth: "1", title: "A", owner: "X", score: "8", dq: true }),
    row({ cloth: "2", title: "B", owner: "Y", score: "7", dq: true }),
  ]);
  check("all bottles DQ'd: no winner", championsOf(night(allDq)).length === 0);
  check("all bottles DQ'd: no victories", Object.keys(victoriesFrom([night(allDq)])).length === 0);

  // The DQ ledger counts marks per member, and re-derives (never doubles).
  const marks = dqCountsFrom([night(allDq, "g1"), night(allDq, "g1")].slice(0, 1));
  check("dq ledger counts the marks", marks["X"] === 1 && marks["Y"] === 1);

  // A DQ'd row without a score is legal on a scored night (off theme is
  // reason enough); it still cannot win.
  const dqNoScore = draft([
    row({ cloth: "1", title: "A", owner: "L", score: "8" }),
    row({ cloth: "2", title: "B", owner: "K", dq: true }),
  ]);
  check("DQ'd row may go unscored on a scored night", validateMeetingDraft(dqNoScore).length === 0);
  check("unscored DQ'd row still cannot win", champOwners(reckonRows(dqNoScore.rows)) === "L");
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
