// The cloth number's writing rule, and the hand-entry path's spoiled mark.
//
//   npx tsx scripts/verify-cloth.ts

import { wineNameText } from "../src/components/Cloth";
import { reckonRows, isBlankRow, keptRows, type DraftRowInput } from "../src/lib/meeting-entry";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

// ------------------------------------------------- only "Bottle" gives way

check("an unclaimed bottle keeps the word and the number", wineNameText("", 5) === "Bottle 5");
check("a claimed bottle swaps only the word", wineNameText("Porseleinberg 2021", 5) === "Porseleinberg 2021 5");
check("the number always trails the name", wineNameText("Kanonkop", 12).endsWith("12"));
check("a nameless bottle on a nameless cloth is just the word", wineNameText("", null) === "Bottle");
check("a named bottle with no cloth keeps its name alone", wineNameText("Meerlust Rubicon", null) === "Meerlust Rubicon");
check("null and undefined titles read the same", wineNameText(null, 3) === wineNameText(undefined, 3));
// The fault this rule exists to cure: the pour and the place were both roman,
// so "II · Bottle III" could not be read. Plain numerals end that for good.
check("the cloth is never a roman numeral", !/[IVX]/.test(wineNameText("", 4)));
check("cloth 1 is written 1", wineNameText("", 1) === "Bottle 1");
check("cloth 9 is written 9", wineNameText("", 9) === "Bottle 9");

// ------------------------------------------- the codex's own hand-entry

const row = (o: Partial<DraftRowInput> = {}): DraftRowInput => ({
  cloth: "", title: "A wine", owner: "A soul", score: "", dq: false, votes: 1, varietals: [], price: "", ...o,
});

{
  const out = reckonRows([
    row({ cloth: "1", title: "Alpha", score: "8.2" }),
    row({ cloth: "2", title: "Beta", score: "9.1", spoiled: true }),
    row({ cloth: "3", title: "Gamma", score: "7.0" }),
  ]);
  const by = (t: string) => out.find((r) => r.title === t)!;
  check("a spoiled bottle is written into the record", out.length === 3);
  check("a spoiled bottle takes no rank", by("Beta").rank === null);
  check("and is not disqualified", by("Beta").dq === false && by("Beta").spoiled === true);
  check("its score cannot steal first place", by("Alpha").rank === 1);
  check("the rest place as if it were not there", by("Gamma").rank === 2);
  check("the spoiled bottle's own score is still remembered", by("Beta").score === 9.1);
}

{
  // A row bearing nothing but the spoiled mark is a real row, not debris.
  check("a spoiled row is not a blank row", isBlankRow(row({ title: "", owner: "", score: "", spoiled: true })) === false);
  check("a truly empty row still is", isBlankRow(row({ title: "", owner: "", score: "" })) === true);
  check("blank rows are dropped and marked rows kept",
    keptRows([row({ title: "", owner: "", score: "" }), row({ title: "", owner: "", score: "", spoiled: true })]).length === 1);
}

{
  // Spoiled and disqualified sit side by side without confusing the ranks.
  const out = reckonRows([
    row({ title: "Sound", score: "7.5" }),
    row({ title: "Spoiled", score: "8.9", spoiled: true }),
    row({ title: "CastOut", score: "9.4", dq: true }),
  ]);
  const by = (t: string) => out.find((r) => r.title === t)!;
  check("the one sound wine takes first", by("Sound").rank === 1);
  check("neither mark takes a rank", by("Spoiled").rank === null && by("CastOut").rank === null);
  check("the marks stay distinct in the record", by("Spoiled").spoiled === true && by("Spoiled").dq === false && by("CastOut").dq === true && !by("CastOut").spoiled);
}

{
  // An unmarked night must look exactly as it always has: no spoiled key
  // appears on a row that was never marked.
  const out = reckonRows([row({ title: "Alpha", score: "8" }), row({ title: "Beta", score: "7" })]);
  check("an ordinary night carries no spoiled mark", out.every((r) => r.spoiled === undefined));
  check("and ranks as before", out[0].rank === 1 && out[1].rank === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
