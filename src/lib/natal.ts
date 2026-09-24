// The full natal chart: all ten planets in signs and whole-sign houses, plus
// the aspects between them. Positions come from Schlyter's orbital elements
// (the same framework the moon and Venus already use), converted heliocentric →
// geocentric via the sun's position; Jupiter/Saturn/Uranus carry their main
// mutual perturbations. Accuracy is a few tenths of a degree — far inside a
// 30° sign bin and comfortable for aspect orbs of several degrees.

import {
  julianDay, sunLongitude, moonLongitude, moonLatitude, ascendantLongitude,
  ZODIAC, DEFAULT_TZ, type Sign,
} from "./astrology";

const RAD = Math.PI / 180;
const rev = (x: number) => x - Math.floor(x / 360) * 360;

export interface PlanetPos {
  key: string;
  name: string;
  glyph: string;
  lon: number; // geocentric ecliptic longitude, degrees
  sign: Sign;
  deg: number; // degrees into the sign, floored
  house: number | null; // whole-sign house, 1..12 (null without an ascendant)
}
export type AspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";
export interface ChartAspect { a: string; b: string; type: AspectType; hard: boolean; orb: number }
export interface Chart {
  jd: number;
  asc: number | null;
  ascSign: Sign | null;
  planets: PlanetPos[];
  aspects: ChartAspect[];
}

export const PLANETS = [
  { key: "sun", name: "Sun", glyph: "☉" },
  { key: "moon", name: "Moon", glyph: "☽" },
  { key: "mercury", name: "Mercury", glyph: "☿" },
  { key: "venus", name: "Venus", glyph: "♀" },
  { key: "mars", name: "Mars", glyph: "♂" },
  { key: "jupiter", name: "Jupiter", glyph: "♃" },
  { key: "saturn", name: "Saturn", glyph: "♄" },
  { key: "uranus", name: "Uranus", glyph: "♅" },
  { key: "neptune", name: "Neptune", glyph: "♆" },
  { key: "pluto", name: "Pluto", glyph: "♇" },
] as const;

// Schlyter orbital elements: value at epoch + rate per day (d = jd − 2451543.5).
type El = { N: [number, number]; i: [number, number]; w: [number, number]; a: [number, number]; e: [number, number]; M: [number, number] };
const ELEMENTS: Record<string, El> = {
  mercury: { N: [48.3313, 3.24587e-5], i: [7.0047, 5e-8], w: [29.1241, 1.01444e-5], a: [0.387098, 0], e: [0.205635, 5.59e-10], M: [168.6562, 4.0923344368] },
  venus: { N: [76.6799, 2.4659e-5], i: [3.3946, 2.75e-8], w: [54.891, 1.38374e-5], a: [0.72333, 0], e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244] },
  mars: { N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8], w: [286.5016, 2.92961e-5], a: [1.523688, 0], e: [0.093405, 2.516e-9], M: [18.6021, 0.5240207766] },
  jupiter: { N: [100.4542, 2.76854e-5], i: [1.303, -1.557e-7], w: [273.8777, 1.64505e-5], a: [5.20256, 0], e: [0.048498, 4.469e-9], M: [19.895, 0.0830853001] },
  saturn: { N: [113.6634, 2.3898e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: [9.55475, 0], e: [0.055546, -9.499e-9], M: [316.967, 0.0334442282] },
  uranus: { N: [74.0005, 1.3978e-5], i: [0.7733, 1.9e-8], w: [96.6612, 3.0565e-5], a: [19.18171, -1.55e-8], e: [0.047318, 7.45e-9], M: [142.5905, 0.011725806] },
  neptune: { N: [131.7806, 3.0173e-5], i: [1.77, -2.55e-7], w: [272.8461, -6.027e-6], a: [30.05826, 3.313e-8], e: [0.008606, 2.15e-9], M: [260.2471, 0.005995147] },
};

// Pluto: Meeus, Astronomical Algorithms ch. 37 (valid 1885 to 2099). Each
// row is [J, S, P multipliers, lon A, lon B, lat A, lat B, radius A, radius B];
// longitude and latitude in millionths of a degree, radius in 1e-7 AU.
// Heliocentric, ecliptic and equinox J2000; precessed to the date below.
const PLUTO_TERMS: number[][] = [
  [0, 0, 1, -19799805, 19850055, -5452852, -14974862, 66865439, 68951812],
  [0, 0, 2, 897144, -4954829, 3527812, 1672790, -11827535, -332538],
  [0, 0, 3, 611149, 1211027, -1050748, 327647, 1593179, -1438890],
  [0, 0, 4, -341243, -189585, 178690, -292153, -18444, 483220],
  [0, 0, 5, 129287, -34992, 18650, 100340, -65977, -85431],
  [0, 0, 6, -38164, 30893, -30697, -25823, 31174, -6032],
  [0, 1, -1, 20442, -9987, 4878, 11248, -5794, 22161],
  [0, 1, 0, -4063, -5071, 226, -64, 4601, 4032],
  [0, 1, 1, -6016, -3336, 2030, -836, -1729, 234],
  [0, 1, 2, -3956, 3039, 69, -604, -415, 702],
  [0, 1, 3, -667, 3572, -247, -567, 239, 723],
  [0, 2, -2, 1276, 501, -57, 1, 67, -67],
  [0, 2, -1, 1152, -917, -122, 175, 1034, -451],
  [0, 2, 0, 630, -1277, -49, -164, -129, 504],
  [1, -1, 0, 2571, -459, -197, 199, 480, -231],
  [1, -1, 1, 899, -1449, -25, 217, 2, -441],
  [1, 0, -3, -1016, 1043, 589, -248, -3359, 265],
  [1, 0, -2, -2343, -1012, -269, 711, 7856, -7832],
  [1, 0, -1, 7042, 788, 185, 193, 36, 45763],
  [1, 0, 0, 1199, -338, 315, 807, 8663, 8547],
  [1, 0, 1, 418, -67, -130, -43, -809, -769],
  [1, 0, 2, 120, -274, 5, 3, 263, -144],
  [1, 0, 3, -60, -159, 2, 17, -126, 32],
  [1, 0, 4, -82, -29, 2, 5, -35, -16],
  [1, 1, -3, -36, -29, 2, 3, -19, -4],
  [1, 1, -2, -40, 7, 3, 1, -15, 8],
  [1, 1, -1, -14, 22, 2, -1, -4, 12],
  [1, 1, 0, 4, 13, 1, -1, 5, 6],
  [1, 1, 1, 5, 2, 0, -1, 3, 1],
  [1, 1, 3, -1, 0, 0, 0, 6, -2],
  [2, 0, -6, 2, 0, 0, -2, 2, 2],
  [2, 0, -5, -4, 5, 2, 2, -2, -2],
  [2, 0, -4, 4, -7, -7, 0, 14, 13],
  [2, 0, -3, 14, 24, 10, -8, -63, 13],
  [2, 0, -2, -49, -34, -3, 20, 136, -236],
  [2, 0, -1, 163, -48, 6, 5, 273, 1065],
  [2, 0, 0, 9, -24, 14, 17, 251, 149],
  [2, 0, 1, -4, 1, -2, 0, -25, -9],
  [2, 0, 2, -3, 1, 0, 0, 9, -2],
  [2, 0, 3, 1, 3, 0, 0, -8, 7],
  [3, 0, -2, -3, -1, 0, 1, 2, -10],
  [3, 0, -1, 5, -3, 0, 0, 19, 35],
  [3, 0, 0, 0, 0, 1, 0, 10, 3],
];
function plutoHelioJ2000(jd: number): { l: number; b: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const J = 34.35 + 3034.9057 * T, S = 50.08 + 1222.1138 * T, P = 238.96 + 144.96 * T;
  let dl = 0, db = 0, dr = 0;
  for (const [j, s, p, la, lb, ba, bb, ra, rb] of PLUTO_TERMS) {
    const a = rev(j * J + s * S + p * P) * RAD;
    const sa = Math.sin(a), ca = Math.cos(a);
    dl += la * sa + lb * ca; db += ba * sa + bb * ca; dr += ra * sa + rb * ca;
  }
  return { l: rev(238.958116 + 144.96 * T + dl / 1e6), b: -3.908239 + db / 1e6, r: 40.7241346 + dr / 1e7 };
}
// Geocentric ecliptic (of date) longitude and latitude of Pluto.
function plutoGeo(jd: number): { lon: number; lat: number } {
  const T = (jd - 2451545.0) / 36525;
  const h = plutoHelioJ2000(jd);
  const l = (h.l + 1.3969713 * T + 0.0003086 * T * T) * RAD; // precession in longitude, J2000 to date
  const b = h.b * RAD;
  const x = h.r * Math.cos(b) * Math.cos(l), y = h.r * Math.cos(b) * Math.sin(l), z = h.r * Math.sin(b);
  const s = sunVec(jd);
  const xg = x + s.x, yg = y + s.y;
  return { lon: rev(Math.atan2(yg, xg) / RAD), lat: Math.atan2(z, Math.sqrt(xg * xg + yg * yg)) / RAD };
}

function helio(el: El, d: number): { x: number; y: number; z: number } {
  const N = rev(el.N[0] + el.N[1] * d) * RAD;
  const i = (el.i[0] + el.i[1] * d) * RAD;
  const w = rev(el.w[0] + el.w[1] * d) * RAD;
  const a = el.a[0] + el.a[1] * d;
  const e = el.e[0] + el.e[1] * d;
  const M = rev(el.M[0] + el.M[1] * d) * RAD;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 6; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  return {
    x: r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i)),
    y: r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i)),
    z: r * Math.sin(v + w) * Math.sin(i),
  };
}

function sunVec(jd: number): { x: number; y: number } {
  const n = jd - 2451545.0;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const rs = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const ls = sunLongitude(jd) * RAD;
  return { x: rs * Math.cos(ls), y: rs * Math.sin(ls) };
}

// Geocentric ecliptic longitude of any body at a Julian Day.
export function planetLongitude(key: string, jd: number): number {
  const d = jd - 2451543.5;
  if (key === "sun") return sunLongitude(jd);
  if (key === "moon") return moonLongitude(jd);
  if (key === "pluto") return plutoGeo(jd).lon;
  const h = helio(ELEMENTS[key], d);
  const s = sunVec(jd);
  let lon = rev(Math.atan2(h.y + s.y, h.x + s.x) / RAD);
  // Main mutual perturbations (applied to the longitude; at these magnitudes
  // the helio/geo distinction is far below our precision needs).
  const Mj = rev(19.895 + 0.0830853001 * d) * RAD;
  const Ms = rev(316.967 + 0.0334442282 * d) * RAD;
  const Mu = rev(142.5905 + 0.011725806 * d) * RAD;
  const D = RAD;
  if (key === "jupiter") {
    lon += -0.332 * Math.sin(2 * Mj - 5 * Ms - 67.6 * D) - 0.056 * Math.sin(2 * Mj - 2 * Ms + 21 * D)
      + 0.042 * Math.sin(3 * Mj - 5 * Ms + 21 * D) - 0.036 * Math.sin(Mj - 2 * Ms)
      + 0.022 * Math.cos(Mj - Ms) + 0.023 * Math.sin(2 * Mj - 3 * Ms + 52 * D)
      - 0.016 * Math.sin(Mj - 5 * Ms - 69 * D);
  }
  if (key === "saturn") {
    lon += 0.812 * Math.sin(2 * Mj - 5 * Ms - 67.6 * D) - 0.229 * Math.cos(2 * Mj - 4 * Ms - 2 * D)
      + 0.119 * Math.sin(Mj - 2 * Ms - 3 * D) + 0.046 * Math.sin(2 * Mj - 6 * Ms - 69 * D)
      + 0.014 * Math.sin(Mj - 3 * Ms + 32 * D);
  }
  if (key === "uranus") {
    lon += 0.04 * Math.sin(Ms - 2 * Mu + 6 * D) + 0.035 * Math.sin(Ms - 3 * Mu + 33 * D)
      - 0.015 * Math.sin(Mj - Mu + 20 * D);
  }
  return rev(lon);
}

// Geocentric ecliptic LATITUDE of any body (degrees, north positive), from
// the same Schlyter elements as the longitude. The Wheel never needed it;
// the Atlas does, because a planet 5° off the ecliptic rises and sets along
// a different curve. Sun: 0 by definition. Pluto: Schlyter's latitude fit.
export function planetLatitude(key: string, jd: number): number {
  const d = jd - 2451543.5;
  if (key === "sun") return 0;
  if (key === "moon") return moonLatitude(jd);
  if (key === "pluto") return plutoGeo(jd).lat;
  const h = helio(ELEMENTS[key], d);
  const s = sunVec(jd);
  const xg = h.x + s.x, yg = h.y + s.y, zg = h.z;
  let lat = Math.atan2(zg, Math.sqrt(xg * xg + yg * yg)) / RAD;
  if (key === "saturn") {
    const Mj = rev(19.895 + 0.0830853001 * d) * RAD;
    const Ms = rev(316.967 + 0.0334442282 * d) * RAD;
    lat += -0.02 * Math.cos(2 * Mj - 4 * Ms - 2 * RAD) + 0.018 * Math.sin(2 * Mj - 6 * Ms - 49 * RAD);
  }
  return lat;
}

// Whole-sign house of a longitude: the ascendant's sign is the 1st house.
export function houseOf(lon: number, asc: number | null): number | null {
  if (asc == null) return null;
  return ((Math.floor(lon / 30) - Math.floor(asc / 30) + 12) % 12) + 1;
}

export function angDiff(a: number, b: number): number {
  const d = Math.abs(rev(a - b));
  return d > 180 ? 360 - d : d;
}

const ASPECT_DEFS: { type: AspectType; angle: number; orb: number; hard: boolean }[] = [
  { type: "conjunction", angle: 0, orb: 8, hard: false },
  { type: "sextile", angle: 60, orb: 4, hard: false },
  { type: "square", angle: 90, orb: 6, hard: true },
  { type: "trine", angle: 120, orb: 6, hard: false },
  { type: "opposition", angle: 180, orb: 8, hard: true },
];

function computeAspects(ps: PlanetPos[]): ChartAspect[] {
  const out: ChartAspect[] = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const d = angDiff(ps[i].lon, ps[j].lon);
      for (const A of ASPECT_DEFS) {
        const orb = Math.abs(d - A.angle);
        if (orb <= A.orb) {
          out.push({ a: ps[i].key, b: ps[j].key, type: A.type, hard: A.hard, orb });
          break;
        }
      }
    }
  }
  return out;
}

// The whole sky at a birth moment. Ascendant (and houses) require time + place;
// without them the chart still carries planets-in-signs.
export function fullChart(
  dateStr: string,
  timeStr?: string | null,
  tz?: string | null,
  lat?: number | null,
  lon?: number | null
): Chart | null {
  const jd = julianDay(dateStr, timeStr, tz || DEFAULT_TZ);
  if (jd == null) return null;
  const asc = ascendantLongitude(dateStr, timeStr, tz, lat, lon);
  const planets: PlanetPos[] = PLANETS.map((p) => {
    const L = planetLongitude(p.key, jd);
    return { key: p.key, name: p.name, glyph: p.glyph, lon: L, sign: ZODIAC[Math.floor(L / 30) % 12], deg: Math.floor(L % 30), house: houseOf(L, asc) };
  });
  return { jd, asc, ascSign: asc == null ? null : ZODIAC[Math.floor(asc / 30) % 12], planets, aspects: computeAspects(planets) };
}

// --- What each placement signifies (planet × sign × house fragments) ----
const PLANET_IS: Record<string, string> = {
  sun: "the self: vitality, purpose, the light they cannot help but cast",
  moon: "instinct, feeling, and need",
  mercury: "mind and tongue",
  venus: "taste, love, and pleasure",
  mars: "drive and appetite",
  jupiter: "fortune and growth",
  saturn: "discipline and limit",
  uranus: "upheaval and sudden genius",
  neptune: "dream and dissolution",
  pluto: "power and rebirth",
};
const SIGN_STYLE: Record<string, string> = {
  Aries: "acts first and burns hot",
  Taurus: "moves slowly and holds fast",
  Gemini: "flits, questions, and doubles back",
  Cancer: "feels in tides and protects its own",
  Leo: "performs, warms, and commands the room",
  Virgo: "measures twice and perfects",
  Libra: "weighs, balances, and charms",
  Scorpio: "goes all in or not at all",
  Sagittarius: "aims far and speaks plainly",
  Capricorn: "climbs patiently and endures",
  Aquarius: "sides with the strange and the future",
  Pisces: "dissolves borders and dreams",
};
export const HOUSE_DOMAIN: Record<number, string> = {
  1: "the self, and how they arrive",
  2: "worth, possessions, and appetite",
  3: "words, kin, and short roads",
  4: "home, hearth, and root",
  5: "pleasure, play, and creation",
  6: "craft, habit, and service",
  7: "partners, and open rivals",
  8: "the shared, the deep, and the hidden",
  9: "far places, belief, and learning",
  10: "name, standing, and work in the world",
  11: "friends, allies, and the many",
  12: "solitude, secrets, and the unseen",
};
const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const ordinal = (n: number) => ORDINAL[n] || `${n}th`;

export function placementText(p: PlanetPos): string {
  const base = `${p.name} is ${PLANET_IS[p.key]}. In ${p.sign.name} it ${SIGN_STYLE[p.sign.name]}`;
  return p.house
    ? `${base}; in the ${ordinal(p.house)} house, its ground is ${HOUSE_DOMAIN[p.house]}.`
    : `${base}.`;
}
