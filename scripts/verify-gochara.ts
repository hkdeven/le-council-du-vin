// Checks for the turning sky (gochara.ts): the panchang against a
// DrikPanchang-confirmed day, tara/Chandra bala against hand counts, the
// gochara ledger against live sidereal positions, the sign-entry scanner
// against the earlier engine scans, and the iron passage's real dates.
//
//   npx tsx scripts/verify-gochara.ts

import { panchangOf, dayStarFor, gocharaFor, signEntries, yearTurnings, ironPassageFor, clockWithin } from "../src/lib/gochara";
import { vedicChart, RASHIS } from "../src/lib/vedic";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const V = { obj: "you", pos: "your", subj: "you" };

// A fixed instant: Friday 2026-07-10 noon SAST, cross-checked against
// DrikPanchang's published Pretoria panchang during the audit.
const NOW = new Date(2026, 6, 10, 12, 0).getTime();
const KEISER = vedicChart("1988-11-05", "03:30", "Africa/Johannesburg", -26.95, 24.73, NOW)!;

// ── panchang ────────────────────────────────────────────────────────────────
{
  const p = panchangOf(NOW)!;
  check("tithi: Krishna Ekadashi", p.tithi === "Krishna Ekadashi", p.tithi);
  check("tithi note speaks for Ekadashi", !!p.tithiNote && p.tithiNote.includes("restraint"));
  check("day lord: Shukra (Friday)", p.dayLord === "Shukra (Friday)", p.dayLord);
  check("nakshatra of the day: Krittika", p.nakshatra === "Krittika", p.nakshatra);
  check("yoga (SIDEREAL sum): Shula", p.yoga === "Shula", p.yoga);
  check("karana: Bava", p.karana === "Bava", p.karana);
}

// ── the day's star ──────────────────────────────────────────────────────────
{
  const d = dayStarFor(KEISER, NOW, V)!;
  check("Keiser's tara today: Janma (Krittika from Uttara Phalguni folds to 1)", d.tara === "Janma tara", d.tara);
  check("Janma reads mixed, not hostile", d.taraGoodDay === null);
  check("Chandra bala: Moon ninth from natal Moon (Mesha from Simha)", d.moonLine.includes("ninth"), d.moonLine.slice(0, 40));
}

// ── gochara ─────────────────────────────────────────────────────────────────
{
  const g = gocharaFor(KEISER, NOW);
  const by = Object.fromEntries(g.map((r) => [r.key, r]));
  check("six grahas in the ledger (Moon belongs to the day)", g.length === 6, String(g.length));
  check("Shukra over the Moon (1st), favourable", by.venus.house === 1 && by.venus.favourable, `${by.venus.house}`);
  check("Surya 11th, favourable", by.sun.house === 11 && by.sun.favourable);
  check("Budha 11th, favourable", by.mercury.house === 11 && by.mercury.favourable);
  check("Mangala 10th, unfavourable", by.mars.house === 10 && !by.mars.favourable);
  check("Guru 12th, unfavourable", by.jupiter.house === 12 && !by.jupiter.favourable);
  check("Shani 8th, unfavourable (the eighth passage)", by.saturn.house === 8 && !by.saturn.favourable && by.saturn.line.includes("eighth passage"));
  check("favourable rows sort first", g.slice(0, 3).every((r) => r.favourable));
}

// ── sign entries vs the earlier engine scans ────────────────────────────────
{
  const jup = signEntries("jupiter", NOW, NOW + 200 * 86400000);
  const first = jup[0];
  const d = new Date(first.ms).toISOString().slice(0, 10);
  check("Guru enters Simha around 2026-10-31", RASHIS[first.to] === "Simha" && d >= "2026-10-28" && d <= "2026-11-03", d);
  const rahu = signEntries("rahu", NOW, NOW + 200 * 86400000);
  const rd = new Date(rahu[0].ms).toISOString().slice(0, 10);
  check("Rahu slides into Makara around 2026-12-06", RASHIS[rahu[0].to] === "Makara" && rd >= "2026-12-03" && rd <= "2026-12-09", rd);
}

// ── the year's turnings ─────────────────────────────────────────────────────
{
  const t = yearTurnings(KEISER, NOW);
  check("turnings found for the year", t.length >= 3 && t.length <= 4, String(t.length));
  check("Guru onto the Moon named as the great blessing", t.some((x) => x.text.includes("great blessing")));
  check("Rahu into the 6th named", t.some((x) => x.text.includes("6th")));
  check("turnings sorted by date", t.every((x, i) => i === 0 || x.ms >= t[i - 1].ms));
}

// ── the iron passage ────────────────────────────────────────────────────────
{
  const iron = ironPassageFor(KEISER, NOW, V)!;
  check("Ashtama Shani active now", iron.title === "Ashtama Shani" && iron.active, iron.title);
  check("release honours the retrograde wobble: February 2028, not June 2027", iron.whisper.includes("February 2028"), iron.whisper);
  check("next Sade Sati honestly dated 2034", !!iron.next && iron.next.includes("2034"), iron.next || "");
  // After Saturn leaves Meena for good (mid 2028), the iron rests.
  const rest = ironPassageFor(KEISER, new Date(2029, 0, 15).getTime(), V)!;
  check("2029: the iron rests", rest.title === "The iron rests" && !rest.active, rest.title);
  // Deep inside the Sade Sati (2035): rising or peak phase, dated release.
  const sade = ironPassageFor(KEISER, new Date(2035, 5, 1).getTime(), V)!;
  check("2035: inside the Sade Sati", sade.title.startsWith("Sade Sati") && sade.active, sade.title);
  check("Sade Sati release honours the wobble: September 2041", !!sade.next && sade.next.includes("September 2041"), sade.next || "");
}

// ── the clock within ────────────────────────────────────────────────────────
{
  const c = clockWithin(KEISER, NOW);
  check("clock rows present", c.length >= 4, String(c.length));
  check("CHANDRA is NOW until 17 Jul 2026", c[0].lord === "CHANDRA" && c[0].now && c[0].range.includes("17 Jul"), `${c[0].lord} ${c[0].range}`);
  check("MANGALA follows to 18 Aug", c[1].lord === "MANGALA" && c[1].range.includes("18 Aug"), c[1].range);
  check("exactly one row is NOW", c.filter((r) => r.now).length === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
