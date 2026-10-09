// The /member/<name> address: every soul answers to their given name, a shared
// given name is told apart by the full cult name, nothing matches nothing.
//
//   npx tsx scripts/verify-member-slug.ts

import { slugify, givenSlug, slugsFor, slugFor, findBySlug } from "../src/lib/memberSlug";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const roster = [
  { cult_name: "The Keiser" },
  { cult_name: "Magus Dominik" },
  { cult_name: "Priestess Larissa" },
  { cult_name: "Warden James" },
  { cult_name: "Scribe James" },
  { cult_name: "Adept Zoë" },
];
const [keiser, dominik, larissa, wardenJames, scribeJames, zoe] = roster;

check("slugify lowercases and hyphenates", slugify("Magus Dominik") === "magus-dominik");
check("slugify drops accents", slugify("Adept Zoë") === "adept-zoe");
check("slugify strips punctuation", slugify("  The Keiser!  ") === "the-keiser");
check("givenSlug is the last word", givenSlug("Priestess Larissa") === "larissa");
check("givenSlug of The Keiser is keiser", givenSlug("The Keiser") === "keiser");
check("slugsFor lists given then full", JSON.stringify(slugsFor("Magus Dominik")) === '["dominik","magus-dominik"]');
check("slugsFor of a one-word name is one slug", JSON.stringify(slugsFor("Cassian")) === '["cassian"]');

check("slugFor uses the given name when unique", slugFor(dominik, roster) === "dominik");
check("slugFor falls back to the full name on a clash", slugFor(wardenJames, roster) === "warden-james" && slugFor(scribeJames, roster) === "scribe-james");
check("slugFor of the Keiser is keiser", slugFor(keiser, roster) === "keiser");

check("findBySlug by given name", findBySlug(roster, "dominik")[0] === dominik && findBySlug(roster, "dominik").length === 1);
check("findBySlug by full name", findBySlug(roster, "magus-dominik")[0] === dominik);
check("findBySlug is case-blind", findBySlug(roster, "Larissa")[0] === larissa);
check("findBySlug accepts accents in the url", findBySlug(roster, "zoë")[0] === zoe);
check("findBySlug returns both on a shared given name", findBySlug(roster, "james").length === 2);
check("findBySlug full name settles a shared given name", findBySlug(roster, "scribe-james").length === 1 && findBySlug(roster, "scribe-james")[0] === scribeJames);
check("findBySlug of a stranger is empty", findBySlug(roster, "nobody").length === 0);
check("findBySlug of nothing is empty", findBySlug(roster, "").length === 0 && findBySlug(roster, "---").length === 0);
check("every soul round-trips through slugFor", roster.every((m) => findBySlug(roster, slugFor(m, roster))[0] === m));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
