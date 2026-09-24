// Verify the Atlas: the positions against the Swiss Ephemeris, the geometry
// against what must hold by construction, and the roster against what
// happens when new members join.
// Run: npx tsx scripts/verify-atlas.ts
//
// scripts/fixtures/atlas-swisseph.json holds reference positions computed
// with pyswisseph (Swiss Ephemeris 2.10) for ten birth records: the
// Keiser's, and invented new members across both hemispheres, seven
// decades, daylight saving, a half-hour zone and the date line. Regenerate
// it with the Swiss Ephemeris, never by hand.

import fixtures from "./fixtures/atlas-swisseph.json";
import {
  atlasChart, distanceToLine, askOfPlace, citiesFor, councilCities, kindredGround, foldSouls, initialsOf, haversineKm,
  LINE_KINDS, REACH_KM, QUESTIONS, COUNCIL_THEMES, type RosterRow,
} from "../src/lib/atlas";
import { ATLAS_CITIES } from "../src/lib/atlas-cities";

let fails = 0, passes = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
  ok ? passes++ : fails++;
};
const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const section = (t: string) => console.log(`\n── ${t}`);

type Fixture = { name: string; date: string; time: string; tz: string; lat: number; lon: number; jd: number; gmst: number; planets: Record<string, { lon: number; lat: number; ra: number; dec: number }> };

// ── 1. Positions against the Swiss Ephemeris ────────────────────────────────
section("Positions against the Swiss Ephemeris");
const TOL_DEG = 0.1; // about 11 km on the ground
let worst = 0, worstWho = "";
for (const f of fixtures as Fixture[]) {
  const c = atlasChart({ dateStr: f.date, timeStr: f.time, tz: f.tz, lat: f.lat, lon: f.lon });
  if (!c) { check(`${f.name}: chart drawn`, false); continue; }
  check(`${f.name}: birth instant agrees to the second`, Math.abs(c.jd - f.jd) * 86400 < 1, `${(Math.abs(c.jd - f.jd) * 86400).toFixed(2)} s`);
  check(`${f.name}: Greenwich sidereal time within 0.01°`, Math.abs(angDiff(c.gmst, f.gmst)) < 0.01, `${angDiff(c.gmst, f.gmst).toFixed(4)}°`);
  let maxErr = 0;
  for (const p of c.planets) {
    const ref = f.planets[p.key];
    const e = Math.max(Math.abs(angDiff(p.ra, ref.ra)), Math.abs(p.dec - ref.dec));
    if (e > maxErr) maxErr = e;
    if (e > worst) { worst = e; worstWho = `${p.name} for ${f.name}`; }
  }
  check(`${f.name}: every planet's RA and declination within ${TOL_DEG}°`, maxErr < TOL_DEG, `worst ${maxErr.toFixed(3)}°`);
}
check(`worst error across all records is ${worstWho}`, worst < TOL_DEG, `${worst.toFixed(3)}° ≈ ${Math.round(worst * 111)} km`);

// ── 2. Geometry by construction ─────────────────────────────────────────────
section("Geometry by construction");
const chart = atlasChart({ dateStr: "1985-01-14", timeStr: "02:00", tz: "America/Detroit", lat: 45.06, lon: -83.43 })!;
const sun = chart.planets.find((p) => p.key === "sun")!;
const expectedIc = -83.43 - 21.5; // 02:00 EST at 83.4°W is 01:26 local solar time: the Sun is 1h26m past the IC
check("Sun's underfoot line lies ~21° west of a 02:00 birthplace", Math.abs(sun.ic - expectedIc) < 3, `ic=${sun.ic.toFixed(1)} expected≈${expectedIc.toFixed(1)}`);
check("Sun's overhead line is exactly opposite its underfoot line", Math.abs((((sun.mc - sun.ic) % 360) + 360) % 360 - 180) < 0.01);
for (const p of chart.planets) {
  const ascLons = new Set(p.asc.flat().map((q) => q[0]));
  check(`${p.name}: rising and setting curves never share a longitude`, !p.dsc.flat().some((q) => ascLons.has(q[0])));
  for (const k of ["asc", "dsc"] as const) {
    const seg = p[k][0]; if (!seg) continue;
    const q = seg[Math.floor(seg.length / 2)];
    check(`${p.name} ${k}: a point lifted from the curve lies on it`, distanceToLine(chart, p, k, q[1], q[0]) < 15);
  }
  check(`${p.name} overhead: a point on the meridian lies on it`, distanceToLine(chart, p, "mc", 20, p.mc) < 1);
}
const ctj = haversineKm(-33.93, 18.42, -26.20, 28.05);
check("great-circle Cape Town to Johannesburg ≈ 1260 km", Math.abs(ctj - 1262) < 15, `${ctj.toFixed(0)} km`);

// ── 3. Readings ─────────────────────────────────────────────────────────────
section("Readings");
const hits = askOfPlace(chart, 38.72, -9.14);
check("select a place: every hit within reach", hits.every((h) => h.km < REACH_KM));
check("select a place: nearest first", hits.every((h, i) => i === 0 || hits[i - 1].km <= h.km));
check("select a place: every hit names a real line", hits.every((h) => LINE_KINDS.includes(h.kind)));
const far = askOfPlace(chart, -89, 0);
check("select a place: nothing comes back beyond reach", far.every((h) => h.km < REACH_KM));
for (const q of QUESTIONS) {
  const rows = citiesFor(chart, q, 5);
  check(`favours · ${q.title}: at most five, all within reach, nearest first`, rows.length <= 5 && rows.every((r) => r.km < REACH_KM) && rows.every((r, i) => i === 0 || rows[i - 1].km <= r.km));
  check(`favours · ${q.title}: only the question's own lines`, rows.every((r) => q.kinds.includes(r.kind)));
}
const loveRows = citiesFor(chart, QUESTIONS[0], 5);
const metroNames = loveRows.map((r) => r.city[0]);
check("favours: one row per metro (no two suburbs of one city)", new Set(metroNames).size === metroNames.length);

// ── 4. The roster: when new members join ────────────────────────────────────
section("The roster: when new members join");
const keiser: RosterRow = { id: "k", cult_name: "The Keiser", short_name: "KE", role: "keiser", active: true, date_of_birth: "1985-01-14", time_of_birth: "02:00", birth_lat: 45.06, birth_lon: -83.43, birth_tz: "America/Detroit" };
const full: RosterRow = { id: "m1", cult_name: "Magus Dominik", short_name: "MD", role: "member", active: true, date_of_birth: "1988-11-05", time_of_birth: "03:30", birth_lat: -26.96, birth_lon: 24.73, birth_tz: "Africa/Johannesburg" };
const initiate: RosterRow = { ...full, id: "i1", cult_name: "Cassian Vale", short_name: "CV", role: "initiate" };
const sleeping: RosterRow = { ...full, id: "s1", cult_name: "Elder Martin", short_name: "EM", active: false };
const noTime: RosterRow = { ...full, id: "n1", cult_name: "Scribe Scott", short_name: "SS", time_of_birth: null };
const noPlace: RosterRow = { ...full, id: "n2", cult_name: "Seer Matthew", short_name: "SM", birth_lat: null, birth_lon: null };
const noDate: RosterRow = { ...full, id: "n3", cult_name: "Warden James", short_name: "WJ", date_of_birth: null };
const noShort: RosterRow = { ...full, id: "n4", cult_name: "Priestess Larissa", short_name: null };

const souls = foldSouls([keiser, full, initiate, sleeping, noTime, noPlace, noDate, noShort], "k");
const ids = souls.map((s) => s.id);
check("a complete full member stands on the map", ids.includes("m1"));
check("the Keiser stands on the map", ids.includes("k"));
check("an initiate never stands on the map, even with a complete chart", !ids.includes("i1"));
check("a sleeping seat never stands on the map", !ids.includes("s1"));
check("a member without a time of birth is veiled, not guessed", !ids.includes("n1"));
check("a member without a place of birth is veiled, not guessed", !ids.includes("n2"));
check("a member without a date of birth is veiled, not guessed", !ids.includes("n3"));
check("a member without initials gets them from their name", souls.find((s) => s.id === "n4")?.initials === "PL");
check("the viewer is marked as self, and nobody else is", souls.filter((s) => s.self).map((s) => s.id).join() === "k");
check("initials come from short_name when present", initialsOf(full) === "MD");

check("atlasChart: null without a time", atlasChart({ dateStr: "1990-01-01", timeStr: null, tz: "UTC", lat: 0, lon: 0 }) === null);
check("atlasChart: null without a place", atlasChart({ dateStr: "1990-01-01", timeStr: "12:00", tz: "UTC", lat: null, lon: null }) === null);
check("atlasChart: null without a date", atlasChart({ dateStr: "", timeStr: "12:00", tz: "UTC", lat: 0, lon: 0 }) === null);
let threw = false;
try { atlasChart({ dateStr: "1990-01-01", timeStr: "12:00", tz: "Mars/Olympus", lat: 0, lon: 0 }); } catch { threw = true; }
check("atlasChart: an unknown timezone never throws", !threw);

const luck = COUNCIL_THEMES[0];
const before = councilCities(souls, luck, 50);
const newcomer: RosterRow = { id: "new", cult_name: "Adept Wernardt", short_name: "AW", role: "member", active: true, date_of_birth: "1992-12-21", time_of_birth: "23:45", birth_lat: -33.93, birth_lon: 18.42, birth_tz: "Africa/Johannesburg" };
const grown = foldSouls([keiser, full, initiate, sleeping, noTime, noPlace, noDate, noShort, newcomer], "k");
const after = councilCities(grown, luck, 50);
check("council's map: a newcomer adds one soul", grown.length === souls.length + 1);
check("council's map: no city lists fewer souls after a newcomer joins", before.every((b) => (after.find((a) => a.city === b.city)?.who.length ?? 0) >= b.who.length));
check("council's map: a soul is never counted twice for one city", after.every((r) => new Set(r.who.map((w) => w.id)).size === r.who.length));
check("council's map: a city needs at least two souls to be listed", after.every((r) => r.who.length >= 2));
check("council's map: most souls first", after.every((r, i) => i === 0 || after[i - 1].who.length >= r.who.length));
check("council's map: one row per metro", new Set(after.map((r) => r.city[0])).size === after.length);
check("council's map: a lone soul gathers nowhere", councilCities([souls[0]], luck).length === 0);
check("council's map: an empty roster gathers nowhere", councilCities([], luck).length === 0);

const a = souls.find((s) => s.id === "k")!.chart, b = souls.find((s) => s.id === "m1")!.chart;
const ab = kindredGround(a, b, 5), ba = kindredGround(b, a, 5);
check("kindred: both lines within reach", ab.every((h) => h.mine.km < REACH_KM && h.theirs.km < REACH_KM));
check("kindred: Saturn is never the meeting line", ab.every((h) => h.mine.planet.key !== "saturn" && h.theirs.planet.key !== "saturn"));
check("kindred: nearest pairing first", ab.every((h, i) => i === 0 || ab[i - 1].score <= h.score));
check("kindred: the same ground from either side", ab.map((h) => h.city[0]).join() === ba.map((h) => h.city[0]).join());
check("kindred: sides swap cleanly", ab.every((h, i) => h.mine.km === ba[i].theirs.km && h.theirs.km === ba[i].mine.km));
const self = kindredGround(a, a, 5);
check("kindred: a chart shares ground with itself", self.length > 0 && self.every((h) => h.mine.km === h.theirs.km));

const twelve: RosterRow[] = Array.from({ length: 12 }, (_, i) => ({ ...full, id: `p${i}`, cult_name: `Soul ${i}`, short_name: `S${i}`, time_of_birth: `${String(i * 2).padStart(2, "0")}:15` }));
const t0 = Date.now();
const many = foldSouls(twelve, "p0");
for (const theme of COUNCIL_THEMES) councilCities(many, theme);
for (const s of many.slice(1)) kindredGround(many[0].chart, s.chart, 2);
const ms = Date.now() - t0;
check("twelve souls: council's map and kindred ground for every theme in under 3 s", ms < 3000, `${ms} ms over ${ATLAS_CITIES.length} cities`);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
