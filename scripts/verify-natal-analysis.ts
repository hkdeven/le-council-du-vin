// Checks for the Wheel's deeper readings (natal-analysis.ts), against the
// Keiser's independently confirmed chart and constructed edge cases.
//
//   npx tsx scripts/verify-natal-analysis.ts

import { temperamentOf, figuresOf, bearerOf, birthMoonOf } from "../src/lib/natal-analysis";
import { fullChart } from "../src/lib/natal";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const V = { subj: "you", Subj: "You", obj: "you", pos: "your", Pos: "Your" };

const K = fullChart("1988-11-05", "03:30", "Africa/Johannesburg", -26.95, 24.73)!;

// ── temperament ─────────────────────────────────────────────────────────────
{
  const t = temperamentOf(K, V);
  check("Air leads with 4", t.elements[0].name === "Air" && t.elements[0].count === 4, `${t.elements[0].name} ${t.elements[0].count}`);
  check("Cardinal leads with 5", t.modes[0].name === "Cardinal" && t.modes[0].count === 5, `${t.modes[0].name} ${t.modes[0].count}`);
  check("eleven placements tallied (ten planets + ascendant)", t.elements.reduce((n, e) => n + e.count, 0) === 11);
  check("verdict is the Air|Cardinal passage", t.verdict.includes("moves first and moves others"), t.verdict.slice(0, 50));
}

// ── figures ─────────────────────────────────────────────────────────────────
{
  const f = figuresOf(K, V);
  const names = f.map((x) => x.name).join(" | ");
  check("Sun conjunct Pluto found (0.3 degrees)", f.some((x) => x.name === "Sun conjunct Pluto, exact"), names);
  check("Saturn conjunct Uranus found (0.7 degrees)", f.some((x) => x.name === "Saturn conjunct Uranus, exact"));
  check("no stellium invented", !f.some((x) => x.name.startsWith("Stellium")));
  check("no grand trine or T-square invented", !f.some((x) => x.name === "Grand trine" || x.name === "T-square"));
  check("special Sun-Pluto passage used", f.find((x) => x.name.includes("Sun conjunct Pluto"))!.text.includes("vault"));
}

// ── bearer ──────────────────────────────────────────────────────────────────
{
  const b = bearerOf(K, V)!;
  check("Venus bears the Libra ascendant, own sign", b.title === "Venus, in her own sign", b.title);
  check("whisper places her: Libra 7, 1st house", b.whisper.includes("Libra 7°") && b.whisper.includes("1st house"), b.whisper);
  check("dignity clause speaks of home ground", b.text.includes("home ground"));
}

// ── birth moon ──────────────────────────────────────────────────────────────
{
  const m = birthMoonOf(K, V)!;
  check("last quarter (309 degrees)", m.title === "The last quarter" && m.whisper.includes("309"), `${m.title} · ${m.whisper}`);
  check("passage speaks of harvest and prune", m.text.includes("harvest and prune"));
}

// ── constructed edges ───────────────────────────────────────────────────────
{
  // A 1962-02-05 chart: the famous seven-planet Aquarius pile-up → stellium.
  const s = fullChart("1962-02-05", "12:00", "UTC", 0, 0)!;
  const f = figuresOf(s, V);
  check("1962-02-05: Aquarius stellium detected", f.some((x) => x.name === "Stellium in Aquarius"), f.map((x) => x.name).join(" | "));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
