// Reading a wine off a photographed label: the parsing, which is the part
// that can quietly ruin a member's offering.
//
//   npx tsx scripts/verify-label.ts

import { parseLabelAnswer, readPrice, tidyGrapes, priceCaveat, LABEL_PROMPT } from "../src/lib/labelRead";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const good = '{"title":"Kanonkop Paul Sauer 2019","grape":"Cabernet Sauvignon, Merlot","price":780,"priceNote":"typical SA retail","confident":true}';

// ------------------------------------------------------------- the answer

{
  const r = parseLabelAnswer(good)!;
  check("a clean answer reads", !!r);
  check("the wine is named", r.title === "Kanonkop Paul Sauer 2019");
  check("the grapes come through", r.grape === "Cabernet Sauvignon, Merlot");
  check("the price is a number", r.price === 780);
  check("the note comes through", r.priceNote === "typical SA retail");
  check("and it is confident", r.confident === true);
}

{
  // Models wrap JSON in prose and fences. A member's photograph must not be
  // lost to either.
  const fenced = "Here is what I found:\n```json\n" + good + "\n```\nHope that helps.";
  check("a fenced answer still reads", parseLabelAnswer(fenced)?.title === "Kanonkop Paul Sauer 2019");
  check("a prefixed answer still reads", parseLabelAnswer("Sure! " + good)?.price === 780);
}

{
  check("nothing in, nothing out", parseLabelAnswer("") === null);
  check("prose with no object is refused", parseLabelAnswer("I cannot read this label.") === null);
  check("broken json is refused", parseLabelAnswer('{"title":"X",') === null);
  check("an answer with no wine is refused", parseLabelAnswer('{"title":"","price":200}') === null);
  check("a json array is refused", parseLabelAnswer('["Kanonkop"]') === null);
}

{
  // An unreadable photograph must come back as unsure, not as a confident
  // invention. This is the fault that would put a wine nobody brought into
  // the record.
  const r = parseLabelAnswer('{"title":"A red wine","grape":"","price":null,"confident":false}')!;
  check("an unsure reading says so", r.confident === false);
  check("and carries no price", r.price === null);
  check("a missing confident flag is not taken as yes", parseLabelAnswer('{"title":"X"}')!.confident === true);
}

// -------------------------------------------------------------- the price

check("a plain number", readPrice(780) === 780);
check("rand in front", readPrice("R780") === 780);
check("a decimal", readPrice("780.50") === 780.5);
check("a comma decimal", readPrice("780,50") === 780.5);
check("a thousands comma", readPrice("1,250") === 1250);
check("words around it", readPrice("about R780 a bottle") === 780);
check("a range takes the lower figure", readPrice("650-800") === 650);
check("null is null", readPrice(null) === null);
check("no digits is null", readPrice("unknown") === null);
check("zero is not a price", readPrice(0) === null);
check("a negative is not a price", readPrice(-50) === null);
check("an absurd figure is refused", readPrice(99_000_000) === null);
check("a price survives the whole answer", parseLabelAnswer('{"title":"X","price":"R1,250"}')!.price === 1250);

// -------------------------------------------------------------- the grape

check("a known grape is spelled the Council's way", tidyGrapes("cabernet sauvignon", "") === "Cabernet Sauvignon");
check("two known grapes both come through", tidyGrapes("Cabernet Sauvignon and Merlot", "").includes("Merlot"));
check("a grape in the name is found", tidyGrapes("", "Reyneke Syrah 2022") === "Syrah");
check("an unknown grape is kept as written", tidyGrapes("Hárslevelű", "") === "Hárslevelű");
check("an empty grape stays empty", tidyGrapes("", "A wine") === "");
check("a long list is trimmed", tidyGrapes("A, B, C, D, E, F", "").split(",").length <= 4);

// --------------------------------------------------------------- the words

{
  const c = priceCaveat("typical SA retail");
  check("the caveat says it is not what they paid", /not what you paid/i.test(c));
  check("the caveat invites a correction", /change it/i.test(c));
  check("a missing note still reads", /typical retail/.test(priceCaveat("")));
  // The Keiser's standing rule on copy.
  check("no long dashes in the caveat", !/[—–]/.test(c));
}

check("the prompt asks for rand", /rand/i.test(LABEL_PROMPT));
check("the prompt forbids inventing a bottle", /rather than inventing/i.test(LABEL_PROMPT));
check("the prompt asks for one figure, not a range", /no range/i.test(LABEL_PROMPT));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
