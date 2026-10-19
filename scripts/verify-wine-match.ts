// Recognising the same wine twice, which decides two warnings a member sees
// as they log a bottle. A warning that cries wolf is worse than none, so
// most of what follows is about what must NOT match.
//
//   npx tsx scripts/verify-wine-match.ts

import { normalise, vintageOf, bareName, sameWine, tastedBefore, tastedBeforeWords, alreadyTonightWords } from "../src/lib/wineMatch";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

// ------------------------------------------------------------- the folding

check("case is folded", normalise("KANONKOP") === "kanonkop");
check("accents are folded", normalise("Château Pétrus") === "chateau petrus");
check("punctuation is folded", normalise("Rust-en-Vrede, Estate.") === "rust en vrede estate");
check("spacing is folded", normalise("  Meerlust   Rubicon ") === "meerlust rubicon");
check("nothing folds to nothing", normalise("") === "");

check("a vintage is found", vintageOf("Kanonkop Paul Sauer 2019") === 2019);
check("the last year wins", vintageOf("2019 vs 2021 Kanonkop") === 2021);
check("no year is null", vintageOf("Kanonkop Paul Sauer") === null);
check("a quantity is not a year", vintageOf("Case of 1500") === null);
check("the vintage comes out of the name", bareName("Kanonkop Paul Sauer 2019") === "kanonkop paul sauer");

// ------------------------------------------------------------ what matches

check("the very same wine", sameWine("Kanonkop Paul Sauer 2019", "Kanonkop Paul Sauer 2019"));
check("the same wine, different vintage", sameWine("Kanonkop Paul Sauer 2019", "Kanonkop Paul Sauer 2021"));
check("the same wine, typed differently", sameWine("kanonkop paul-sauer 2019", "Kanonkop Paul Sauer, 2019"));
check("the same wine with a word added", sameWine("Kanonkop Paul Sauer", "Kanonkop Paul Sauer Estate 2019"));
check("the same wine with a word before it", sameWine("Paul Sauer 2019", "Kanonkop Paul Sauer 2019"));
check("accents do not divide a wine", sameWine("Chateau Petrus 2015", "Château Pétrus 2015"));

// -------------------------------------------------------- what must not

check("two wines from one estate are not one wine", !sameWine("Kanonkop Pinotage", "Kanonkop Cabernet Sauvignon"));
check("a bare estate name sweeps up nothing", !sameWine("Kanonkop", "Kanonkop Paul Sauer 2019"));
check("one word is never enough", !sameWine("Rubicon", "Meerlust Rubicon 2018"));
check("different wines do not match", !sameWine("Porseleinberg 2021", "Meerlust Rubicon 2018"));
check("an empty name matches nothing", !sameWine("", "Meerlust Rubicon"));
check("a year alone matches nothing", !sameWine("2019", "Kanonkop Paul Sauer 2019"));
// A shared word in the middle must not join two unrelated wines.
check("a shared middle word is not a match", !sameWine("Boekenhoutskloof Syrah", "Mullineux Syrah"));

// ---------------------------------------------------------- the annals

const annals = [
  { number: 1, date: "2026-04-18", rows: [
    { title: "Porseleinberg 2021", owner: "Seer Matthew", score: 8.7, votes: 6, rank: 1 },
    { title: "A chilled Pinotage", owner: "Elder Martin", score: 5.8, votes: 6, rank: null },
  ] },
  { number: 9, date: "2026-07-11", rows: [
    { title: "Kanonkop Paul Sauer 2017", owner: "Priestess Larissa", score: 8.1, votes: 5, rank: 2 },
  ] },
  { number: 14, date: "2026-09-12", rows: [
    { title: "Kanonkop Paul Sauer 2019", owner: "The Keiser", score: 8.4, votes: 7, rank: 1 },
    { title: "An unrecorded bottle", owner: "James", score: 0, votes: 0, rank: null },
  ] },
];

{
  const past = tastedBefore("Kanonkop Paul Sauer 2019", annals);
  check("a wine met before is found", past.length === 2);
  check("the most recent night comes first", past[0].number === 14);
  check("the bearer is named", past[0].owner === "The Keiser");
  check("the score is carried", past[0].score === 8.4);
  check("an older vintage of the same wine counts", past[1].number === 9 && past[1].vintage === 2017);
}

check("a wine never met returns nothing", tastedBefore("Alheit Cartology 2022", annals).length === 0);
check("an unscored row carries no score", tastedBefore("An unrecorded bottle", annals)[0].score === null);
check("a cast-out bottle still counts as tasted", tastedBefore("A chilled Pinotage", annals).length === 1);
check("nothing is found for an empty name", tastedBefore("", annals).length === 0);

// ------------------------------------------------------------- the words

{
  const w = tastedBeforeWords("Kanonkop Paul Sauer 2019", tastedBefore("Kanonkop Paul Sauer 2019", annals))!;
  check("the warning opens with the charge", w.lead === "Be original. The Council has tasted this before!");
  check("the evidence names the night", /Gathering XIV/.test(w.detail));
  check("and the bearer", /The Keiser/.test(w.detail));
  check("and the score", /8\.4/.test(w.detail));
  check("and says it twice met", /2 times/.test(w.detail));
  check("the sentence does not forbid the bottle", /Bring it if you must/.test(w.tail));
  check("each line stands alone", !w.lead.includes(w.detail) && !w.detail.includes(w.tail));
  check("no long dashes anywhere in it", ![w.lead, w.detail, w.tail].some((x) => /[—–]/.test(x)));
}

{
  // A different vintage is worth pointing out, because to a table it is a
  // different wine.
  const w = tastedBeforeWords("Kanonkop Paul Sauer 2021", tastedBefore("Kanonkop Paul Sauer 2021", annals))!;
  check("a different vintage is called out", /That was the 2019; yours is the 2021/.test(w.detail), w.detail);
}
{
  const w = tastedBeforeWords("Porseleinberg 2021", tastedBefore("Porseleinberg 2021", annals))!;
  check("the same vintage is not called out", !/yours is the/.test(w.detail));
  check("one meeting is not reported as many", !/times/.test(w.detail));
  check("a bearer with no name does not read blank", /brought by Seer Matthew/.test(w.detail));
}
check("no past tasting, no words", tastedBeforeWords("Alheit Cartology", []) === null);

{
  const words = alreadyTonightWords();
  check("tonight's warning names no soul", !/matthew|larissa|martin|wernardt|dominik|james|scott|keiser/i.test(words));
  check("and attributes it to nobody", !/\bby\b/i.test(words));
  check("it warns that the scores are pooled", /pooled and averaged/.test(words));
  check("and urges a different bottle", /different bottle/.test(words));
  check("but does not forbid it", /Bring it if you must/.test(words));
  check("no long dashes in tonight's warning", !/[—–]/.test(words));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
