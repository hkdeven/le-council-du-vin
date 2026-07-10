// The Kundli's readings, computed from the verified Vedic engine — no
// libraries, per doctrine. Everything here is classical rule application on
// exact positions: nothing is guessed, and charts that lack a condition
// simply do not receive its reading.
//
// Conventions, stated for the record:
//  - Kuta (kindred stars): the classical ashta-koota out of 36, moon to moon.
//    Gun milan is directional (bride → groom); the Council compares members,
//    not betrothals, so the shown score is the MEAN of both directions.
//  - Muhurta: tara bala counted from the member's birth nakshatra against the
//    Moon's nakshatra each day (good taras 2/4/6/8/9, hostile 3/5/7), crossed
//    with the weekday lord's friendship toward the lagna lord.
//  - Yogas: only detected when their strict classical condition holds.

import { julianDay, moonLongitude } from "./astrology";
import {
  ayanamsaLahiri, nakshatraOf, RASHIS,
  type VedicChart, type DashaLord,
} from "./vedic";

const rev = (x: number) => ((x % 360) + 360) % 360;

// ── the sky's rulerships ────────────────────────────────────────────────────
// Rashi lords, in rashi order (Mesha..Meena).
export const RASHI_LORDS: DashaLord[] = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
  "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
];

// Permanent planetary friendship (classical, Brihat Parashara): for each
// planet, its friends and enemies; everyone else is neutral.
const FRIENDS: Record<string, string[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
};
const ENEMIES: Record<string, string[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
};
type Feeling = "friend" | "neutral" | "enemy";
export function feelingOf(a: string, b: string): Feeling {
  if (a === b) return "friend";
  if (FRIENDS[a]?.includes(b)) return "friend";
  if (ENEMIES[a]?.includes(b)) return "enemy";
  return "neutral";
}

// ── ashta-koota ─────────────────────────────────────────────────────────────
// Varna by moon rashi: Vipra (water signs), Kshatriya (fire), Vaishya
// (earth), Shudra (air). Higher-or-equal groom varna scores the point.
// The hierarchy, explicit: 3 Vipra > 2 Kshatriya > 1 Vaishya > 0 Shudra.
const VARNA_RANK: number[] = [
  2, // Mesha (Kshatriya)
  1, // Vrishabha (Vaishya)
  0, // Mithuna (Shudra)
  3, // Karka (Vipra)
  2, // Simha (Kshatriya)
  1, // Kanya (Vaishya)
  0, // Tula (Shudra)
  3, // Vrischika (Vipra)
  2, // Dhanu (Kshatriya)
  1, // Makara (Vaishya)
  0, // Kumbha (Shudra)
  3, // Meena (Vipra)
];
// Vashya groups, resolved with the classical half-sign rules (we hold exact
// degrees, so Dhanu and Makara split properly).
// 0 Chatushpada (quadruped), 1 Manava (human), 2 Jalachara (water),
// 3 Vanachara (wild), 4 Keeta (insect).
export function vashyaGroup(moonSidLon: number): number {
  const l = rev(moonSidLon);
  const rashi = Math.floor(l / 30);
  const firstHalf = l - rashi * 30 < 15;
  switch (rashi) {
    case 0: case 1: return 0; // Mesha, Vrishabha
    case 2: case 5: case 6: case 10: return 1; // Mithuna, Kanya, Tula, Kumbha
    case 3: case 11: return 2; // Karka, Meena
    case 4: return 3; // Simha
    case 7: return 4; // Vrischika
    case 8: return firstHalf ? 1 : 0; // Dhanu: man first, horse second
    case 9: return firstHalf ? 0 : 2; // Makara: deer first, water second
    default: return 1;
  }
}
// Points matrix [groom][bride], the common standard consistent with the
// DrikPanchang tutorial's wording (2 / 1.5 / 1 / 0 steps), cross-checked
// against three published tables and the AstroSage worked example.
const VASHYA_PTS: number[][] = [
  // C    M    J    V    K      (columns: bride group)
  [2, 1, 1, 0, 1], // groom Chatushpada
  [1, 2, 1.5, 0, 1], // groom Manava
  [1, 1.5, 2, 1, 1], // groom Jalachara
  [1.5, 0, 0, 2, 0], // groom Vanachara
  [1, 1, 1, 0, 2], // groom Keeta
];

// Tara: count nakshatras from A to B inclusive, fold to 1..9.
// Two rules, per the audited conventions:
//  - Kuta scoring uses the dominant even-remainder rule (even taras and 9
//    auspicious; the odd 1 Janma, 3 Vipat, 5 Pratyak, 7 Naidhana are not).
//  - Muhurta keeps Janma as mixed/tender rather than hostile, so only
//    3/5/7 disqualify a day outright.
const taraCount = (from: number, to: number) => (((to - from + 27) % 27) % 9) + 1;
const taraGood = (t: number) => t !== 3 && t !== 5 && t !== 7;
const taraKutaGood = (t: number) => t % 2 === 0 || t === 9;

// Yoni animals per nakshatra (0..26) — the classical fourteen.
export const YONI: number[] = [
  0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1,
];
export const YONI_ANIMALS = [
  "Horse", "Elephant", "Sheep", "Serpent", "Dog", "Cat", "Rat",
  "Cow", "Buffalo", "Tiger", "Deer", "Monkey", "Mongoose", "Lion",
];
// The full classical 14x14 yoni table (symmetric), reconciled across three
// published sources; the seven sworn-enemy pairs (Horse-Buffalo, Elephant-Lion,
// Sheep-Monkey, Serpent-Mongoose, Dog-Deer, Cat-Rat, Cow-Tiger) score 0.
const YONI_PTS: number[][] = [
  // Hor Ele She Ser Dog Cat Rat Cow Buf Tig Dee Mon Mng Lio
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 1, 3, 2, 1], // Horse
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0], // Elephant
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1], // Sheep
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2], // Serpent
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1], // Dog
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1], // Cat
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2], // Rat
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1], // Cow
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 2], // Buffalo
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1], // Tiger
  [1, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1], // Deer
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2], // Monkey
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2], // Mongoose
  [1, 0, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 4], // Lion
];
function yoniPoints(a: number, b: number): number {
  return YONI_PTS[a][b];
}

// Gana per nakshatra: 0 Deva, 1 Manushya, 2 Rakshasa.
export const GANA: number[] = [
  0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0,
];
// Points [groom][bride], the classical orientation (Saravali): a Deva groom
// with a Manushya bride scores full; the reverse yields 5. The accord's
// two-direction mean is unchanged by orientation; validated against the
// published AstroSage example on the Manushya-Rakshasa cell.
const GANA_PTS: number[][] = [
  [6, 6, 0], // Deva groom
  [5, 6, 0], // Manushya groom
  [1, 0, 6], // Rakshasa groom
];

// Nadi per nakshatra: the zigzag Adi(0)/Madhya(1)/Antya(2) pattern.
export const NADI: number[] = [
  0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2,
];

export interface KutaBreakdown {
  varna: number; vashya: number; tara: number; yoni: number;
  maitri: number; gana: number; bhakoot: number; nadi: number;
  total: number; // out of 36
}

// One direction of the classical match: a as "bride" side, b as "groom".
export function kutaDirectional(brideMoonLon: number, groomMoonLon: number): KutaBreakdown {
  const aMoonLon = brideMoonLon, bMoonLon = groomMoonLon;
  const aR = Math.floor(rev(aMoonLon) / 30), bR = Math.floor(rev(bMoonLon) / 30);
  const aN = nakshatraOf(aMoonLon).nakshatra, bN = nakshatraOf(bMoonLon).nakshatra;

  const varna = VARNA_RANK[bR] >= VARNA_RANK[aR] ? 1 : 0;
  const vashya = VASHYA_PTS[vashyaGroup(bMoonLon)][vashyaGroup(aMoonLon)];
  const t1 = taraKutaGood(taraCount(aN, bN)), t2 = taraKutaGood(taraCount(bN, aN));
  const tara = t1 && t2 ? 3 : t1 || t2 ? 1.5 : 0;
  const yoni = yoniPoints(YONI[aN], YONI[bN]);
  const fa = feelingOf(RASHI_LORDS[aR], RASHI_LORDS[bR]);
  const fb = feelingOf(RASHI_LORDS[bR], RASHI_LORDS[aR]);
  const maitri =
    fa === "friend" && fb === "friend" ? 5 :
    (fa === "friend" && fb === "neutral") || (fb === "friend" && fa === "neutral") ? 4 :
    fa === "neutral" && fb === "neutral" ? 3 :
    (fa === "friend" && fb === "enemy") || (fb === "friend" && fa === "enemy") ? 1 :
    (fa === "neutral" && fb === "enemy") || (fb === "neutral" && fa === "enemy") ? 0.5 : 0;
  const gana = GANA_PTS[GANA[bN]][GANA[aN]];
  const d = (bR - aR + 12) % 12; // counted positions minus one
  const bad = d === 1 || d === 11 || d === 4 || d === 8 || d === 5 || d === 7;
  const bhakoot = bad ? 0 : 7;
  const nadi = NADI[aN] === NADI[bN] ? 0 : 8;

  const total = varna + vashya + tara + yoni + maitri + gana + bhakoot + nadi;
  return { varna, vashya, tara, yoni, maitri, gana, bhakoot, nadi, total };
}

// The Council's symmetric accord: mean of both directions.
export function kutaAccord(aMoonLon: number, bMoonLon: number): KutaBreakdown {
  const ab = kutaDirectional(aMoonLon, bMoonLon);
  const ba = kutaDirectional(bMoonLon, aMoonLon);
  const avg = (x: number, y: number) => Math.round(((x + y) / 2) * 2) / 2;
  const out: KutaBreakdown = {
    varna: avg(ab.varna, ba.varna), vashya: avg(ab.vashya, ba.vashya),
    tara: avg(ab.tara, ba.tara), yoni: avg(ab.yoni, ba.yoni),
    maitri: avg(ab.maitri, ba.maitri), gana: avg(ab.gana, ba.gana),
    bhakoot: avg(ab.bhakoot, ba.bhakoot), nadi: avg(ab.nadi, ba.nadi),
    total: 0,
  };
  out.total = out.varna + out.vashya + out.tara + out.yoni + out.maitri + out.gana + out.bhakoot + out.nadi;
  return out;
}
export function kutaVerdict(total: number): string {
  if (total >= 30) return "a rare accord";
  if (total >= 24) return "strong";
  if (total >= 18) return "workable";
  return "effortful";
}

// ── muhurta: tara bala over the coming days ─────────────────────────────────
export interface MuhurtaDay { ms: number; label: string }
export interface Muhurta { favourable: MuhurtaDay[]; hostile: MuhurtaDay[] }

const DAY_LORDS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

// The Moon's sidereal nakshatra at local noon of a given day.
function moonNakshatraOn(ms: number): number {
  const d = new Date(ms);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const jd = julianDay(dateStr, "12:00");
  if (jd == null) return -1;
  return nakshatraOf(rev(moonLongitude(jd) - ayanamsaLahiri(jd))).nakshatra;
}

export function muhurtaDays(birthNakshatra: number, lagnaRashi: number, fromMs: number, days = 30): Muhurta {
  const lagnaLord = RASHI_LORDS[lagnaRashi];
  const favourable: MuhurtaDay[] = [];
  const hostile: MuhurtaDay[] = [];
  const dayMs = 86400000;
  for (let i = 1; i <= days; i++) {
    const ms = fromMs + i * dayMs;
    const nk = moonNakshatraOn(ms);
    if (nk < 0) continue;
    const tara = taraCount(birthNakshatra, nk);
    const good = taraGood(tara) && tara !== 1;
    const bad = !taraGood(tara);
    const lord = DAY_LORDS[new Date(ms).getDay()];
    const friendly = feelingOf(lagnaLord, lord) !== "enemy";
    const label = new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
    if (good && friendly && favourable.length < 3) favourable.push({ ms, label });
    else if (bad && hostile.length < 2) hostile.push({ ms, label });
    if (favourable.length >= 3 && hostile.length >= 2) break;
  }
  return { favourable, hostile };
}

// ── yogas ───────────────────────────────────────────────────────────────────
export interface Yoga { key: string; name: string }

export function detectYogas(chart: VedicChart): Yoga[] {
  const byKey: Record<string, { rashi: number } | undefined> = {};
  for (const p of chart.planets) byKey[p.key] = p;
  const moon = byKey.moon!, sun = byKey.sun!;
  const out: Yoga[] = [];

  // Gajakesari: Guru in a kendra (1st, 4th, 7th, 10th) counted from Chandra.
  if (byKey.jupiter && [0, 3, 6, 9].includes((byKey.jupiter.rashi - moon.rashi + 12) % 12)) {
    out.push({ key: "gajakesari", name: "Gajakesari" });
  }
  // Budhaditya: Surya and Budha in one rashi.
  if (byKey.mercury && byKey.mercury.rashi === sun.rashi) {
    out.push({ key: "budhaditya", name: "Budhaditya" });
  }
  // Chandra-Mangala: Chandra and Mangala in one rashi.
  if (byKey.mars && byKey.mars.rashi === moon.rashi) {
    out.push({ key: "chandramangala", name: "Chandra-Mangala" });
  }
  // Panch Mahapurusha: Mars/Mercury/Jupiter/Venus/Saturn in own or exaltation
  // sign AND in a kendra from the lagna.
  const MAHA: { key: string; name: string; planet: string; own: number[]; exalt: number }[] = [
    { key: "ruchaka", name: "Ruchaka", planet: "mars", own: [0, 7], exalt: 9 },
    { key: "bhadra", name: "Bhadra", planet: "mercury", own: [2, 5], exalt: 5 },
    { key: "hamsa", name: "Hamsa", planet: "jupiter", own: [8, 11], exalt: 3 },
    { key: "malavya", name: "Malavya", planet: "venus", own: [1, 6], exalt: 11 },
    { key: "sasa", name: "Sasa", planet: "saturn", own: [9, 10], exalt: 6 },
  ];
  for (const m of MAHA) {
    const p = byKey[m.planet];
    if (!p) continue;
    const dignified = m.own.includes(p.rashi) || p.rashi === m.exalt;
    const kendra = [0, 3, 6, 9].includes((p.rashi - chart.lagna.rashi + 12) % 12);
    if (dignified && kendra) out.push({ key: m.key, name: m.name });
  }
  // Kemadruma: no planet (the five true planets — never Sun or the nodes)
  // with the Moon nor in the 2nd or 12th rashi from it. A lonely Moon.
  const others = ["mercury", "venus", "mars", "jupiter", "saturn"]
    .map((k) => byKey[k]).filter(Boolean) as { rashi: number }[];
  const nearMoon = others.some((p) => {
    const d = (p.rashi - moon.rashi + 12) % 12;
    return d === 0 || d === 1 || d === 11;
  });
  if (!nearMoon) out.push({ key: "kemadruma", name: "Kemadruma" });
  return out;
}

// ── mangal dosha (for the marriage bond) ────────────────────────────────────
// Mars in the 1st, 2nd, 4th, 7th, 8th, or 12th house from the lagna.
export function mangalDosha(chart: VedicChart): boolean {
  const mars = chart.planets.find((p) => p.key === "mars");
  return !!mars && [1, 2, 4, 7, 8, 12].includes(mars.house);
}

// ── the pillars' raw facts ──────────────────────────────────────────────────
export interface Pillars {
  lagnaLord: DashaLord;
  lagnaLordHouse: number; // where the chart's keeper stands
  tenthRashi: number;
  tenthLord: DashaLord;
  seventhRashi: number;
  seventhLord: DashaLord;
  seventhLordHouse: number | null;
  venusHouse: number | null;
  pitfalls: string[]; // condition keys, strongest first (max 2 shown)
}

export function pillarsOf(chart: VedicChart): Pillars {
  const byKey: Record<string, { rashi: number; house: number } | undefined> = {};
  for (const p of chart.planets) byKey[p.key] = p;
  const lagnaLord = RASHI_LORDS[chart.lagna.rashi];
  const lordPos = chart.planets.find((p) => p.name === planetNameOf(lagnaLord) || keyOfLord(lagnaLord) === p.key);
  const tenthRashi = (chart.lagna.rashi + 9) % 12;
  const seventhRashi = (chart.lagna.rashi + 6) % 12;
  const seventhLord = RASHI_LORDS[seventhRashi];
  const seventhLordPos = chart.planets.find((p) => p.key === keyOfLord(seventhLord));

  const moon = byKey.moon!;
  const pitfalls: string[] = [];
  const near = (a?: { rashi: number }, b?: { rashi: number }) => !!a && !!b && a.rashi === b.rashi;
  if (near(byKey.moon, byKey.ketu)) pitfalls.push("moon-ketu");
  if (near(byKey.moon, byKey.rahu)) pitfalls.push("moon-rahu");
  if (near(byKey.moon, byKey.saturn)) pitfalls.push("moon-saturn");
  const moonHouse = ((moon.rashi - chart.lagna.rashi + 12) % 12) + 1;
  if ([6, 8, 12].includes(moonHouse)) pitfalls.push(`moon-h${moonHouse}`);
  if (byKey.rahu) pitfalls.push(`rahu-h${((byKey.rahu.rashi - chart.lagna.rashi + 12) % 12) + 1}`);
  if (byKey.saturn && [0, 3, 6, 9].includes((byKey.saturn.rashi - chart.lagna.rashi + 12) % 12)) pitfalls.push("saturn-kendra");

  return {
    lagnaLord,
    lagnaLordHouse: lordPos ? lordPos.house : 1,
    tenthRashi,
    tenthLord: RASHI_LORDS[tenthRashi],
    seventhRashi,
    seventhLord,
    seventhLordHouse: seventhLordPos ? seventhLordPos.house : null,
    venusHouse: byKey.venus ? ((byKey.venus.rashi - chart.lagna.rashi + 12) % 12) + 1 : null,
    pitfalls,
  };
}

export function keyOfLord(lord: DashaLord): string {
  return ({ Sun: "sun", Moon: "moon", Mars: "mars", Mercury: "mercury", Jupiter: "jupiter", Venus: "venus", Saturn: "saturn", Rahu: "rahu", Ketu: "ketu" } as Record<string, string>)[lord];
}
function planetNameOf(lord: DashaLord): string {
  return ({ Sun: "Surya", Moon: "Chandra", Mars: "Mangala", Mercury: "Budha", Jupiter: "Guru", Venus: "Shukra", Saturn: "Shani", Rahu: "Rahu", Ketu: "Ketu" } as Record<string, string>)[lord];
}

// The Sanskrit name of a dasha lord, for display.
export function sanskritLord(lord: DashaLord): string {
  return planetNameOf(lord);
}
export function rashiName(i: number): string {
  return RASHIS[((i % 12) + 12) % 12];
}
