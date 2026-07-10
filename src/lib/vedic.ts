// The Kundli: Vedic (sidereal) astrology computed from first principles on
// top of the Council's verified tropical engine — no libraries, per doctrine.
//
// Conventions, chosen deliberately and stated for the record:
//  - Ayanamsa: LAHIRI (Chitrapaksha), the Indian national standard. Modelled
//    as 23.8532° at J2000 advancing with general precession
//    (50.29"/yr, with the secular term). Verified against published Lahiri
//    values for 1950 / 2000 / 2026 in scripts/verify-vedic.ts.
//  - Rahu/Ketu: the MEAN lunar node (classical convention; Meeus polynomial).
//  - Houses: whole-sign from the sidereal Lagna, as tradition prescribes.
//  - Vargas: the rasi (D1) and the Navamsa (D9); the D9 sign follows the
//    movable/fixed/dual counting rule, which collapses to (sign·9 + pada9) mod 12.
//  - Dasha: Vimshottari from the Moon's nakshatra, 120-year cycle,
//    365.25-day years (the common software convention).
//
// The tropical engine beneath (natal.ts) was verified to <1° against J2000
// reference positions. The Moon's error bounds matter most here: a nakshatra
// spans 13°20', so a Moon within 1° is safely inside the right nakshatra
// except within ~1° of a boundary — the methodology note says so honestly.

import { fullChart } from "./natal";
import { julianDay } from "./astrology";

const rev = (x: number) => ((x % 360) + 360) % 360;

// ── ayanamsa ────────────────────────────────────────────────────────────────
export function ayanamsaLahiri(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return 23.8532 + 1.396971 * T + 0.0003086 * T * T;
}

// ── the mean lunar node (Rahu) ──────────────────────────────────────────────
export function meanRahu(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const omega =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441 -
    (T * T * T * T) / 60616000;
  return rev(omega);
}

// ── the sky's furniture ─────────────────────────────────────────────────────
export const RASHIS = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena",
];
export const RASHI_WESTERN = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada",
  "Revati",
];
const NAK_SPAN = 360 / 27; // 13°20'

// Vimshottari lords repeat from Ashwini in this order, with these years.
export const DASHA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"] as const;
export type DashaLord = (typeof DASHA_LORDS)[number];
export const DASHA_YEARS: Record<DashaLord, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
const CYCLE_YEARS = 120;
const YEAR_DAYS = 365.25;

// ── shapes ──────────────────────────────────────────────────────────────────
export interface VedicPlanet {
  key: string; // sun..pluto's classical seven + rahu + ketu
  name: string;
  lon: number; // sidereal longitude
  rashi: number; // 0-11
  degInRashi: number;
  nakshatra: number; // 0-26
  pada: number; // 1-4
  house: number; // 1-12 whole-sign from lagna
  navamsaRashi: number; // 0-11 (D9)
}
export interface DashaPeriod {
  lord: DashaLord;
  fromMs: number;
  toMs: number;
}
export interface VedicChart {
  lagna: { lon: number; rashi: number; degInRashi: number; navamsaRashi: number };
  planets: VedicPlanet[];
  moonNakshatra: number;
  moonPada: number;
  mahadashas: DashaPeriod[]; // full 120-year cycle from birth
  current: { maha: DashaPeriod; antar: DashaPeriod & { of: DashaLord } } | null;
}

export function nakshatraOf(sidLon: number): { nakshatra: number; pada: number; fractionElapsed: number } {
  const l = rev(sidLon);
  const nakshatra = Math.floor(l / NAK_SPAN) % 27;
  const within = l - nakshatra * NAK_SPAN;
  return { nakshatra, pada: Math.floor(within / (NAK_SPAN / 4)) + 1, fractionElapsed: within / NAK_SPAN };
}

// D9: each rasi divides into 9 padas of 3°20'; the ninth-chart sign is
// (rasi·9 + pada9) mod 12 — equivalent to the movable/fixed/dual rule.
export function navamsaOf(sidLon: number): number {
  const l = rev(sidLon);
  const rashi = Math.floor(l / 30);
  const pada9 = Math.floor((l - rashi * 30) / (30 / 9));
  return (rashi * 9 + pada9) % 12;
}

// ── Vimshottari ─────────────────────────────────────────────────────────────
export function vimshottari(moonSidLon: number, birthMs: number, nowMs: number): {
  mahadashas: DashaPeriod[];
  current: VedicChart["current"];
} {
  const { nakshatra, fractionElapsed } = nakshatraOf(moonSidLon);
  const firstLordIdx = nakshatra % 9;
  const dayMs = 86400000;

  const mahadashas: DashaPeriod[] = [];
  let cursor = birthMs;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_LORDS[(firstLordIdx + i) % 9];
    const fullYears = DASHA_YEARS[lord];
    const years = i === 0 ? fullYears * (1 - fractionElapsed) : fullYears;
    const toMs = cursor + years * YEAR_DAYS * dayMs;
    mahadashas.push({ lord, fromMs: cursor, toMs });
    cursor = toMs;
  }
  // A second cycle so souls older than their first 120-fraction still resolve.
  for (let i = 0; i < 9 && cursor < nowMs + 50 * YEAR_DAYS * dayMs; i++) {
    const lord = DASHA_LORDS[(firstLordIdx + i) % 9];
    const toMs = cursor + DASHA_YEARS[lord] * YEAR_DAYS * dayMs;
    mahadashas.push({ lord, fromMs: cursor, toMs });
    cursor = toMs;
  }

  const maha = mahadashas.find((d) => nowMs >= d.fromMs && nowMs < d.toMs) || null;
  let current: VedicChart["current"] = null;
  if (maha) {
    // Antardashas: sub-periods inside the mahadasha, starting from its own
    // lord, each lasting fullMahaYears·subYears/120 of a year.
    const fullMahaYears = DASHA_YEARS[maha.lord];
    const startIdx = DASHA_LORDS.indexOf(maha.lord);
    // In a balance-shortened first mahadasha the antars that fit are the LAST
    // ones of the sequence; walk the full sequence from the lord and keep the
    // window that overlaps [fromMs, toMs] measured from the notional start.
    const notionalStart = maha.toMs - fullMahaYears * YEAR_DAYS * dayMs;
    let sub = notionalStart;
    for (let i = 0; i < 9; i++) {
      const subLord = DASHA_LORDS[(startIdx + i) % 9];
      const subMs = ((fullMahaYears * DASHA_YEARS[subLord]) / CYCLE_YEARS) * YEAR_DAYS * dayMs;
      const from = sub, to = sub + subMs;
      if (nowMs >= from && nowMs < to) {
        current = { maha, antar: { lord: subLord, fromMs: Math.max(from, maha.fromMs), toMs: to, of: maha.lord } };
        break;
      }
      sub = to;
    }
    if (!current) current = { maha, antar: { lord: maha.lord, fromMs: maha.fromMs, toMs: maha.toMs, of: maha.lord } };
  }
  return { mahadashas, current };
}

// ── the chart ───────────────────────────────────────────────────────────────
const VEDIC_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"] as const;
const KEY_NAME: Record<string, string> = {
  sun: "Surya", moon: "Chandra", mercury: "Budha", venus: "Shukra",
  mars: "Mangala", jupiter: "Guru", saturn: "Shani", rahu: "Rahu", ketu: "Ketu",
};

export function vedicChart(
  dateStr: string,
  timeStr?: string | null,
  tz?: string | null,
  lat?: number | null,
  lon?: number | null,
  nowMs: number = 0
): VedicChart | null {
  const trop = fullChart(dateStr, timeStr, tz, lat, lon);
  if (!trop || trop.asc == null) return null;
  const jd = julianDay(dateStr, timeStr || "12:00", tz || undefined);
  if (jd == null) return null;
  const aya = ayanamsaLahiri(jd);
  // Birth instant from the Julian day itself, so dasha dates respect the
  // birth timezone rather than the viewer's.
  const birthMs = (jd - 2440587.5) * 86400000;

  const lagnaLon = rev(trop.asc - aya);
  const lagnaRashi = Math.floor(lagnaLon / 30);

  const place = (key: string, tropLon: number): VedicPlanet => {
    const sLon = rev(tropLon - aya);
    const rashi = Math.floor(sLon / 30);
    const nk = nakshatraOf(sLon);
    return {
      key,
      name: KEY_NAME[key] || key,
      lon: sLon,
      rashi,
      degInRashi: sLon - rashi * 30,
      nakshatra: nk.nakshatra,
      pada: nk.pada,
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
      navamsaRashi: navamsaOf(sLon),
    };
  };

  const planets: VedicPlanet[] = [];
  for (const key of VEDIC_KEYS) {
    const p = trop.planets.find((x) => x.key === key);
    if (p) planets.push(place(key, p.lon));
  }
  // The nodes: meanRahu returns a tropical longitude, so place() siderealises
  // it like any planet; Ketu stands eternally opposite.
  planets.push(place("rahu", meanRahu(jd)));
  planets.push(place("ketu", meanRahu(jd) + 180));

  const moon = planets.find((p) => p.key === "moon")!;
  const { mahadashas, current } = vimshottari(moon.lon, birthMs, nowMs || Date.now());

  return {
    lagna: { lon: lagnaLon, rashi: lagnaRashi, degInRashi: lagnaLon - lagnaRashi * 30, navamsaRashi: navamsaOf(lagnaLon) },
    planets,
    moonNakshatra: moon.nakshatra,
    moonPada: moon.pada,
    mahadashas,
    current,
  };
}
