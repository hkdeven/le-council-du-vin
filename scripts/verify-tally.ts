// The arithmetic of a night, to account: bound cloths (two souls, one wine)
// and spoiled bottles (recorded, never judged).
//
//   npx tsx scripts/verify-tally.ts

import { bindRows, rankIn, championsIn, placeNight, annalScores, contends, bindKeyOf, type TallyRow } from "../src/lib/tally";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

const r = (cloth: number, score: number, votes: number, o: Partial<TallyRow> = {}): TallyRow => ({
  cloth, title: `Wine ${cloth}`, owner: `Owner ${cloth}`, score, votes, dq: false, ...o,
});

// ---------------------------------------------------------------- plain nights

{
  const rows = [r(1, 7.4, 7), r(2, 8.4, 7), r(3, 7.9, 7)];
  const bound = bindRows(rows);
  check("an unbound night is untouched", bound.length === 3 && bound.every((b) => b.cloths.length === 1));
  check("cloth order is preserved", bound.map((b) => b.cloth).join() === "1,2,3");
  check("the best score takes first", rankIn(bound, bound.find((b) => b.cloth === 2)!) === 1);
  check("the worst takes third", rankIn(bound, bound.find((b) => b.cloth === 1)!) === 3);
  check("one champion", championsIn(bound).map((b) => b.cloth).join() === "2");
}

{
  // Competition ranking: a shared second is followed by a fourth, never a third.
  const bound = bindRows([r(1, 9, 5), r(2, 8, 5), r(3, 8, 5), r(4, 7, 5)]);
  const at = (c: number) => rankIn(bound, bound.find((b) => b.cloth === c)!);
  check("tied seconds both place second", at(2) === 2 && at(3) === 2);
  check("the wine below a shared second places fourth", at(4) === 4);
}

// --------------------------------------------------- three souls, one wine

{
  // The Keiser binds cloths 2, 6 and 9: all three are the same bottle.
  const rows = [
    r(1, 8.0, 6),
    r(2, 7.8, 6, { bind: 2, title: "Kanonkop Paul Sauer 2019", owner: "Larissa" }),
    r(6, 7.2, 6, { bind: 2, title: "", owner: "Martin" }),
    r(9, 6.9, 6, { bind: 2, title: "", owner: "Great Scott" }),
  ];
  const bound = bindRows(rows);
  const same = bound.find((b) => b.cloth === 2)!;

  check("three cloths collapse into one entry", bound.length === 2);
  check("every pour number is kept", same.cloths.join() === "2,6,9");
  check("the mean of the three is carried", near(same.score, (7.8 + 7.2 + 6.9) / 3), String(same.score));
  check("the verdicts are summed", same.votes === 18);
  check("all three bearers are named", same.owner === "Larissa and Martin and Great Scott");
  check("the wine's name survives from whichever cloth had it", same.title === "Kanonkop Paul Sauer 2019");
  check("the bound wine takes one standing", rankIn(bound, same) === 2);
  check("the single bottle still wins", championsIn(bound).map((b) => b.cloth).join() === "1");

  // The whole point: three entries became one, so no wine holds three places.
  const places = placeNight(rows).filter((x) => x.rank != null).map((x) => x.rank);
  check("a night of four bottles yields two standings", places.join() === "1,2");
}

{
  // Unequal juries: the mean must be of the VERDICTS, not of the averages.
  // Seven souls at 8.0 and one soul at 4.0 is 7.5, not 6.0.
  const bound = bindRows([r(1, 8.0, 7, { bind: 1 }), r(2, 4.0, 1, { bind: 1 })]);
  check("the mean is weighted by how many judged", near(bound[0].score, (8 * 7 + 4) / 8), String(bound[0].score));
  check("and it is not the mean of the means", !near(bound[0].score, 6));
}

{
  // Binding wins the night: two seconds become one first.
  const rows = [r(1, 8.0, 5), r(2, 8.2, 5, { bind: 2 }), r(3, 8.2, 5, { bind: 2 })];
  const bound = bindRows(rows);
  check("a bound pair can take the crown together", championsIn(bound).map((b) => b.cloths.join("+")).join() === "2+3");
  check("and the lone bottle falls to second", rankIn(bound, bound.find((b) => b.cloth === 1)!) === 2);
}

{
  // Each bearer is written into the record in their own right, carrying the
  // group's score and standing: that is what makes them co-champions.
  const rows = [r(1, 7.0, 5), r(2, 8.2, 5, { bind: 2 }), r(3, 8.0, 5, { bind: 2 })];
  const w = annalScores(rows);
  check("both bound cloths record the same score", near(w.get(2)!.score, 8.1) && near(w.get(3)!.score, 8.1));
  check("both bound cloths record the same place", w.get(2)!.rank === 1 && w.get(3)!.rank === 1);
  check("the unbound cloth is unaffected", near(w.get(1)!.score, 7.0) && w.get(1)!.rank === 2);
  check("every bottle carried is still its own line", w.size === 3);
}

{
  // Binding is forgiving: a key naming a cloth that is not in the night, or
  // naming itself, leaves the cloth standing alone rather than losing it.
  const rows = [r(1, 7, 5, { bind: 99 }), r(2, 8, 5, { bind: 2 })];
  const bound = bindRows(rows);
  check("a binding to a missing cloth stands alone", bound.length === 2 && bound.every((b) => b.cloths.length === 1));
  check("a cloth bound to itself stands alone", bindKeyOf(rows[1]) === 2);
  check("no bottle is ever lost to binding", bound.reduce((n, b) => n + b.cloths.length, 0) === 2);
}

// ---------------------------------------------------------- spoiled bottles

{
  const rows = [r(1, 8.4, 6), r(2, 7.9, 6), r(3, 6.2, 6, { spoiled: true })];
  const bound = bindRows(rows);
  const bad = bound.find((b) => b.cloth === 3)!;

  check("a spoiled bottle is marked spoiled", bad.spoiled === true);
  check("a spoiled bottle carries no score", bad.score === 0 && bad.votes === 0);
  check("a spoiled bottle takes no standing", rankIn(bound, bad) === null);
  check("a spoiled bottle does not contend", contends(bad) === false);
  check("the sound bottles place as if it were not there", rankIn(bound, bound[0]) === 1 && rankIn(bound, bound[1]) === 2);
  check("a spoiled bottle is still in the night", bound.length === 3);
  check("and it is listed after the placed wines", placeNight(rows).map((x) => x.row.cloth).join() === "1,2,3");
}

{
  // The ugly case: the best score of the night was a bottle that had turned.
  // It must not take the crown, and it must not be promoted either.
  const rows = [r(1, 9.6, 6, { spoiled: true }), r(2, 8.0, 6), r(3, 7.0, 6)];
  const bound = bindRows(rows);
  check("a spoiled bottle never takes the crown", championsIn(bound).map((b) => b.cloth).join() === "2");
  check("the best sound wine wins instead", rankIn(bound, bound.find((b) => b.cloth === 2)!) === 1);
}

{
  // Spoiled is not disqualified. They are separate marks and must stay so,
  // because disqualification is what summons a soul to the tribunal.
  const rows = [r(1, 8, 6, { spoiled: true }), r(2, 7, 6, { dq: true }), r(3, 6, 6)];
  const bound = bindRows(rows);
  const sp = bound.find((b) => b.cloth === 1)!;
  const out = bound.find((b) => b.cloth === 2)!;
  check("a spoiled bottle is not disqualified", sp.spoiled === true && sp.dq === false);
  check("a disqualified bottle is not spoiled", out.dq === true && out.spoiled === false);
  check("neither takes a standing", rankIn(bound, sp) === null && rankIn(bound, out) === null);
  check("the one sound bottle takes the night", championsIn(bound).map((b) => b.cloth).join() === "3");
  check("spoiled is listed before cast out", placeNight(rows).map((x) => x.row.cloth).join() === "3,1,2");
}

{
  // Every bottle spoiled: a night with no champion, and nothing invented.
  const bound = bindRows([r(1, 5, 4, { spoiled: true }), r(2, 6, 4, { spoiled: true })]);
  check("a wholly spoiled night crowns nobody", championsIn(bound).length === 0);
  check("and places nobody", bound.every((b) => rankIn(bound, b) === null));
}

// ------------------------------------------- the two faults in one night

{
  // Three identical bottles, one of which was corked. The spoiled cloth is
  // dropped from the mean: one bad bottle says nothing about the wine.
  const rows = [
    r(1, 8.0, 5),
    r(2, 7.8, 5, { bind: 2, owner: "Larissa", title: "Kanonkop Paul Sauer 2019" }),
    r(3, 3.1, 5, { bind: 2, owner: "Martin", spoiled: true }),
    r(4, 7.6, 5, { bind: 2, owner: "Great Scott" }),
  ];
  const bound = bindRows(rows);
  const same = bound.find((b) => b.cloth === 2)!;

  check("the group survives one spoiled cloth", same.spoiled === false);
  check("the spoiled cloth is left out of the mean", near(same.score, (7.8 + 7.6) / 2), String(same.score));
  check("and out of the vote count", same.votes === 10);
  check("the spoiled cloth is still named in the group", same.cloths.join() === "2,3,4");
  check("all three bearers are still credited", same.owners.length === 3);
  check("the group takes one standing", rankIn(bound, same) === 2);

  const w = annalScores(rows);
  check("the sound bound cloths record the group's score", near(w.get(2)!.score, 7.7) && near(w.get(4)!.score, 7.7));
  check("the spoiled cloth records no score of its own", w.get(3)!.score === 0 && w.get(3)!.votes === 0);
  check("and the spoiled cloth takes no place", w.get(3)!.rank === null);
  check("while its sound siblings share a place", w.get(2)!.rank === 2 && w.get(4)!.rank === 2);
}

{
  // Every cloth of a bound group spoiled: the wine itself goes unjudged.
  const bound = bindRows([r(1, 8, 5), r(2, 4, 5, { bind: 2, spoiled: true }), r(3, 5, 5, { bind: 2, spoiled: true })]);
  const same = bound.find((b) => b.cloth === 2)!;
  check("a wholly spoiled group is spoiled", same.spoiled === true);
  check("it carries no score", same.score === 0 && same.votes === 0);
  check("and no standing", rankIn(bound, same) === null);
}

{
  // A bound group where the Keiser casts one cloth out: it is one wine, so
  // the ruling falls on the whole of it.
  const bound = bindRows([r(1, 7, 5), r(2, 9, 5, { bind: 2, dq: true }), r(3, 9, 5, { bind: 2 })]);
  const same = bound.find((b) => b.cloth === 2)!;
  check("casting out one bound cloth casts out the wine", same.dq === true);
  check("so it cannot win on its other cloth", championsIn(bound).map((b) => b.cloth).join() === "1");
}

// ------------------------------------------------------------- degenerate

{
  const bound = bindRows([]);
  check("an empty night binds to nothing", bound.length === 0 && championsIn(bound).length === 0);
}
{
  // Cloths nobody judged: no score, no place, and no invented champion.
  const bound = bindRows([r(1, 0, 0), r(2, 0, 0)]);
  check("unjudged cloths take no standing", bound.every((b) => rankIn(bound, b) === null));
  check("and crown nobody", championsIn(bound).length === 0);
}
{
  // A score with no verdicts behind it cannot sneak into the mean.
  const bound = bindRows([r(1, 8, 0, { bind: 1 }), r(2, 6, 4, { bind: 1 })]);
  check("a voteless cloth does not move the mean", near(bound[0].score, 6), String(bound[0].score));
  check("and does not inflate the count", bound[0].votes === 4);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
