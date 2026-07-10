// Triple-check for the Vedic engine, per Council doctrine. Three layers:
//  1. Constants vs published references (Lahiri ayanamsa, node behaviour)
//  2. Rules vs independent implementations (navamsa counted the classical
//     way; nakshatra boundaries; a hand-computed Vimshottari worked example)
//  3. Invariants (dashas tile 120 years exactly; antars tile their maha;
//     end-to-end sidereal sanity for a known instant)
//
//   npx tsx scripts/verify-vedic.ts

import { ayanamsaLahiri, meanRahu, nakshatraOf, navamsaOf, vimshottari, vedicChart, NAKSHATRAS, DASHA_LORDS, DASHA_YEARS, RASHI_WESTERN } from "../src/lib/vedic";
import { julianDay } from "../src/lib/astrology";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ── 1. Lahiri ayanamsa vs published values ──────────────────────────────────
// Published Lahiri: 1950-01-01 ≈ 23°09.8' (23.163°), 2000-01-01 ≈ 23°51.2'
// (23.853°), 2026 ≈ 24°12.7' (24.212°).
{
  const jd1950 = julianDay("1950-01-01", "12:00", "UTC")!;
  const jd2000 = julianDay("2000-01-01", "12:00", "UTC")!;
  const jd2026 = julianDay("2026-01-01", "12:00", "UTC")!;
  check("ayanamsa 1950 ≈ 23.163°", close(ayanamsaLahiri(jd1950), 23.163, 0.03), ayanamsaLahiri(jd1950).toFixed(4));
  check("ayanamsa 2000 ≈ 23.853°", close(ayanamsaLahiri(jd2000), 23.853, 0.01), ayanamsaLahiri(jd2000).toFixed(4));
  check("ayanamsa 2026 ≈ 24.212°", close(ayanamsaLahiri(jd2026), 24.212, 0.03), ayanamsaLahiri(jd2026).toFixed(4));
}

// ── 1b. The mean node ───────────────────────────────────────────────────────
{
  const jd2000 = 2451545.0;
  check("mean node at J2000 = 125.0445°", close(meanRahu(jd2000), 125.0445, 0.001), meanRahu(jd2000).toFixed(4));
  // The node regresses: one full revolution in ~18.61 years.
  const later = meanRahu(jd2000 + 18.6129 * 365.25);
  check("node regression period ≈ 18.61y", close(later, 125.0445, 0.5), later.toFixed(3));
  const dayRate = meanRahu(jd2000) - meanRahu(jd2000 + 1);
  check("node moves ≈ −0.0529°/day", close(dayRate, 0.05295, 0.0005), dayRate.toFixed(5));
}

// ── 2. Nakshatra boundaries ─────────────────────────────────────────────────
{
  const t = (lon: number, name: string, padaWant: number) => {
    const { nakshatra, pada } = nakshatraOf(lon);
    check(`nakshatra at ${lon}° = ${name} pada ${padaWant}`, NAKSHATRAS[nakshatra] === name && pada === padaWant, `${NAKSHATRAS[nakshatra]} p${pada}`);
  };
  t(0, "Ashwini", 1);
  t(13.32, "Ashwini", 4);
  t(13.34, "Bharani", 1);
  t(50, "Rohini", 4); // 40°–53°20', 10° in → 4th pada
  t(359.9, "Revati", 4);
  t(93.32, "Punarvasu", 4); // Punarvasu spans 80°–93°20′
  t(93.34, "Pushya", 1); // and Pushya begins the instant after
}

// ── 2b. Navamsa: formula vs the classical movable/fixed/dual rule ───────────
{
  // Independent implementation: movable signs count from themselves, fixed
  // from the 9th sign, dual from the 5th.
  const classical = (lon: number) => {
    const rashi = Math.floor((((lon % 360) + 360) % 360) / 30);
    const pada9 = Math.floor(((((lon % 360) + 360) % 360) - rashi * 30) / (30 / 9));
    const type = rashi % 3; // 0 movable, 1 fixed, 2 dual
    const start = type === 0 ? rashi : type === 1 ? (rashi + 8) % 12 : (rashi + 4) % 12;
    return (start + pada9) % 12;
  };
  let all = true;
  for (let i = 0; i < 108; i++) {
    const lon = i * (30 / 9) + 1.5; // centre of each navamsa
    if (navamsaOf(lon) !== classical(lon)) { all = false; break; }
  }
  check("navamsa formula = classical rule across all 108 padas", all);
}

// ── 2c. Vimshottari worked example (hand-computed) ──────────────────────────
{
  // Moon sidereal 50° → Rohini (idx 3), lord Moon (10y), 75% elapsed →
  // balance 2.5y. Sequence: Moon 2.5y, Mars 7, Rahu 18, Jupiter 16…
  const yr = 365.25 * 86400000;
  const birth = Date.UTC(2000, 0, 1);
  const { mahadashas, current } = vimshottari(50, birth, birth + 1 * yr);
  check("first lord = Moon", mahadashas[0].lord === "Moon");
  check("balance = 2.5y", close((mahadashas[0].toMs - mahadashas[0].fromMs) / yr, 2.5, 0.001), ((mahadashas[0].toMs - mahadashas[0].fromMs) / yr).toFixed(3));
  check("second = Mars 7y", mahadashas[1].lord === "Mars" && close((mahadashas[1].toMs - mahadashas[1].fromMs) / yr, 7, 0.001));
  // Hand-walk the antars of the shortened Moon maha from its notional start
  // (birth − 7.5y): Moon .833, Mars .583, Rahu 1.5, Jup 1.333, Sat 1.583,
  // Merc 1.417, Ketu .583 (ends birth+0.333), Venus 1.667 (ends birth+2.0).
  // At birth+1y we must be in the VENUS antardasha of the Moon maha.
  check("antar at birth+1y = Venus of Moon", current?.maha.lord === "Moon" && current?.antar.lord === "Venus", `${current?.antar.lord} of ${current?.maha.lord}`);
  // Invariant: the first nine mahadashas tile exactly balance + remaining cycle.
  const total = (mahadashas[8].toMs - birth) / yr;
  check("first 9 mahadashas span 112.5y (120 − 7.5 elapsed)", close(total, 112.5, 0.01), total.toFixed(2));
}

// ── 2d. Antardashas tile their mahadasha exactly ────────────────────────────
{
  const yr = 365.25 * 86400000;
  const birth = Date.UTC(1990, 5, 15);
  // Probe a FULL (unshortened) mahadasha: the second one. Sum of its antars
  // must equal its own span. We probe by sweeping nows across it and asserting
  // the antar windows abut with no gaps.
  const { mahadashas } = vimshottari(200, birth, birth);
  const md = mahadashas[1];
  let cursorLord: string | null = null, transitions = 0;
  for (let t = md.fromMs + 1e7; t < md.toMs; t += (md.toMs - md.fromMs) / 5000) {
    const { current } = vimshottari(200, birth, t);
    if (current!.antar.lord !== cursorLord) { cursorLord = current!.antar.lord; transitions++; }
    if (current!.maha.lord !== md.lord) { transitions = -999; break; }
  }
  check("a full mahadasha contains exactly 9 antardashas, no gaps", transitions === 9, `${transitions} windows`);
}

// ── 3. End-to-end sidereal sanity: J2000 noon UTC ───────────────────────────
{
  const chart = vedicChart("2000-01-01", "12:00", "UTC", 28.6, 77.2, Date.UTC(2026, 6, 9));
  if (!chart) { check("J2000 chart computes", false); }
  else {
    const sun = chart.planets.find((p) => p.key === "sun")!;
    // Tropical Sun ≈ 280.4° − ayanamsa 23.85° ≈ 256.5° → Dhanu (Sagittarius).
    check("J2000 sidereal Sun in Dhanu ≈ 256.5°", RASHI_WESTERN[sun.rashi] === "Sagittarius" && close(sun.lon, 256.5, 1.2), `${sun.lon.toFixed(2)}° ${RASHI_WESTERN[sun.rashi]}`);
    const rahu = chart.planets.find((p) => p.key === "rahu")!;
    const ketu = chart.planets.find((p) => p.key === "ketu")!;
    const sep = ((rahu.lon - ketu.lon) % 360 + 360) % 360;
    check("Ketu opposes Rahu exactly", close(sep, 180, 0.001), sep.toFixed(4));
    // Houses: whole-sign — every planet's house must equal its rashi offset from lagna.
    const housesOk = chart.planets.every((p) => p.house === ((p.rashi - chart.lagna.rashi + 12) % 12) + 1);
    check("whole-sign houses consistent for all 9 grahas", housesOk);
    // The 120-year cycle tiles exactly from the first full cycle.
    const yr = 365.25 * 86400000;
    const first9 = chart.mahadashas.slice(0, 9);
    const spanned = (first9[8].toMs - first9[0].fromMs) / yr;
    const moonNk = nakshatraOf(chart.planets.find((p) => p.key === "moon")!.lon);
    const expected = 120 - DASHA_YEARS[DASHA_LORDS[moonNk.nakshatra % 9]] * moonNk.fractionElapsed;
    check("dasha cycle tiles 120y minus elapsed balance", close(spanned, expected, 0.01), `${spanned.toFixed(2)} vs ${expected.toFixed(2)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
