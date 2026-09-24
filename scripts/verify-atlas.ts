// Verify the Atlas geometry against things that must be true by construction.
// Run: npx tsx scripts/verify-atlas.ts
//
// Fixture: a birth at 02:00 local, EST (UTC-5), at 45.06N 83.43W. Local mean
// solar time there is about 01:26, so the Sun sits ~1h26m past the IC: its
// underfoot line must lie ~21° WEST of the birthplace, and its overhead line
// on the far side of the globe. No planet's rising curve may share a
// longitude with its own setting curve, and every line must pass within a
// stone's throw of a point taken from that very line.

import { atlasChart, distanceToLine, askOfPlace, councilCities, haversineKm, LINE_KINDS } from "../src/lib/atlas";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`); if (!ok) fails++; };

const chart = atlasChart({ dateStr: "1985-01-14", timeStr: "02:00", tz: "America/Detroit", lat: 45.06, lon: -83.43 });
if (!chart) { console.log("FAIL chart is null"); process.exit(1); }

const sun = chart.planets.find((p) => p.key === "sun")!;
const expectedIc = -83.43 - 21.5; // 1h26m of solar time west of the birthplace
check("Sun underfoot line lies ~21° west of the birthplace", Math.abs(sun.ic - expectedIc) < 3, `ic=${sun.ic.toFixed(1)} expected≈${expectedIc.toFixed(1)}`);
check("Sun overhead line is opposite the underfoot line", Math.abs((((sun.mc - sun.ic) % 360) + 360) % 360 - 180) < 0.01);

for (const p of chart.planets) {
  const ascLons = new Set(p.asc.flat().map((q) => q[0]));
  const clash = p.dsc.flat().some((q) => ascLons.has(q[0]));
  check(`${p.name}: rising and setting curves never share a longitude`, !clash);
  // A point lifted from each curve must be (nearly) on that curve.
  for (const k of ["asc", "dsc"] as const) {
    const seg = p[k][0]; if (!seg) continue;
    const q = seg[Math.floor(seg.length / 2)];
    const d = distanceToLine(chart, p, k, q[1], q[0]);
    check(`${p.name} ${k}: sampled point is on its own line`, d < 15, `${d.toFixed(1)} km`);
  }
  const dMc = distanceToLine(chart, p, "mc", 20, p.mc);
  check(`${p.name} mc: point on meridian is on the line`, dMc < 1, `${dMc.toFixed(2)} km`);
}

// Distances agree with the great-circle helper on a known pair (Cape Town to Johannesburg ≈ 1260 km).
const ctj = haversineKm(-33.93, 18.42, -26.20, 28.05);
check("haversine Cape Town to Johannesburg ≈ 1260 km", Math.abs(ctj - 1262) < 15, `${ctj.toFixed(0)} km`);

// Ask of a place returns only lines within reach, nearest first.
const hits = askOfPlace(chart, 38.72, -9.14);
check("askOfPlace: all hits within 600 km", hits.every((h) => h.km < 600));
check("askOfPlace: sorted nearest first", hits.every((h, i) => i === 0 || hits[i - 1].km <= h.km));
check("askOfPlace: every hit names a real kind", hits.every((h) => LINE_KINDS.includes(h.kind)));

// The council's map: a soul is never counted twice for one city, and a city
// needs two souls to be listed.
const twin = { ...chart };
const ranked = councilCities([
  { id: "a", initials: "AA", name: "A", chart },
  { id: "b", initials: "BB", name: "B", chart: twin },
], { key: "luck", title: "Luck", planet: "jupiter", kinds: ["mc", "asc"], why: "" }, 3);
check("councilCities: identical charts gather in the same cities", ranked.length > 0 && ranked.every((r) => r.who.length === 2));

console.log(fails ? `\n${fails} failing` : "\nall good");
process.exit(fails ? 1 : 0);
