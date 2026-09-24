// The Atlas: the natal sky laid upon the earth (astrocartography).
//
// At the minute of birth every planet was rising along one curve of the
// globe, setting along another, culminating on one meridian and
// anti-culminating on the opposite one. Those four lines per planet are
// what this module computes, from the SAME positions the Wheel uses
// (natal.ts): no new ephemeris, no outside service.
//
// Method, plainly:
//   - Greenwich sidereal time at birth (the formula the ascendant already uses).
//   - Each planet's ecliptic longitude AND latitude become right ascension
//     + declination (latitude matters: the Moon strays 5° from the ecliptic,
//     Pluto up to 17°, and a rising curve follows the declination).
//   - Overhead (MC) line: the meridian where local sidereal time equals the
//     planet's RA, i.e. longitude = RA - GMST. Underfoot (IC) is 180° away.
//   - Rising / setting curves: at longitude L the hour angle is
//     H = GMST + L - RA, and the planet is on the horizon at the latitude
//     φ = atan(-cos H / tan δ). H < 0 is rising, H > 0 setting.
// A line's pull is read as strongest on the line and gone by ~600 km.

import { julianDay } from "./astrology";
import { PLANETS, planetLongitude, planetLatitude } from "./natal";
import { ATLAS_CITIES, type AtlasCity } from "./atlas-cities";

const RAD = Math.PI / 180;
const rev = (x: number) => ((x % 360) + 360) % 360;
const wrap = (x: number) => { const r = rev(x); return r > 180 ? r - 360 : r; };

export type LineKind = "asc" | "mc" | "dsc" | "ic";
export const LINE_KINDS: LineKind[] = ["asc", "mc", "dsc", "ic"];
export const LINE_NAME: Record<LineKind, string> = { asc: "rising", mc: "overhead", dsc: "setting", ic: "underfoot" };
export const LINE_PLAIN: Record<LineKind, string> = {
  asc: "how you come across, your energy and mood",
  mc: "work, ambition, reputation",
  dsc: "relationships and the people you attract",
  ic: "home, family, private life",
};

export type Segment = [number, number][]; // [lon, lat] points, ascending longitude
export interface PlanetLines {
  key: string;
  name: string;
  glyph: string;
  ra: number;
  dec: number;
  mc: number; // longitude, -180..180
  ic: number;
  asc: Segment[];
  dsc: Segment[];
}
export interface AtlasChart {
  jd: number;
  gmst: number;
  planets: PlanetLines[];
}

export interface BirthInput {
  dateStr: string;
  timeStr?: string | null;
  tz?: string | null;
  lat?: number | null;
  lon?: number | null;
}

// Muted metal tones, one per planet, restrained enough to share a map.
export const PLANET_COLOUR: Record<string, string> = {
  sun: "#cbbd93", moon: "#b9bcc2", mercury: "#8fa39a", venus: "#c99aa4", mars: "#9a4048",
  jupiter: "#b39a5c", saturn: "#7d7a72", uranus: "#7f9aa8", neptune: "#6f8f8c", pluto: "#7a6580",
};
export const DEFAULT_SHOWN = ["sun", "moon", "venus", "jupiter", "saturn"];

// Plain English: what each planet brings, and what each of its lines says.
export const PLANET_PLAIN: Record<string, string> = {
  sun: "confidence, being seen, feeling like yourself",
  moon: "comfort, feelings, a sense of home",
  mercury: "talk, ideas, learning, busyness",
  venus: "love, friendship, beauty, pleasure",
  mars: "drive, energy, conflict, ambition",
  jupiter: "luck, growth, generosity, opportunity",
  saturn: "hard work, discipline, delays, lessons",
  uranus: "surprises, change, freedom, restlessness",
  neptune: "dreams, escape, inspiration, confusion",
  pluto: "deep change, power, intensity, endings",
};
export const LINE_SAY: Record<string, Record<LineKind, string>> = {
  sun: { asc: "You feel more yourself here and people notice you.", mc: "Good for career and being recognised for your work.", dsc: "You attract confident, strong partners and friends.", ic: "Could feel like home; good for family and putting down roots." },
  moon: { asc: "Feelings run closer to the surface; a soft, homely place for you.", mc: "People warm to you in public; caring or people-facing work suits you here.", dsc: "Nurturing relationships; you are looked after.", ic: "Deep comfort and belonging; the strongest home line there is." },
  mercury: { asc: "You are chattier, sharper and more curious here.", mc: "Good for writing, teaching, trade and anything built on words or ideas.", dsc: "You meet talkers and thinkers who keep you busy.", ic: "A good place to study or work from home; mentally restless." },
  venus: { asc: "You feel attractive and charming; people take to you easily.", mc: "Good for creative work and being well liked in your field.", dsc: "The classic love line: romance and warm friendships come easily.", ic: "A beautiful, comfortable place to live; good for family harmony." },
  mars: { asc: "More energy, more drive, shorter temper.", mc: "Ambition and competition; you push hard and can win, but expect friction.", dsc: "Passionate but argumentative relationships; sparks both ways.", ic: "Restless at home; good for physical projects, bad for peace and quiet." },
  jupiter: { asc: "Confidence, optimism and good fortune follow you here.", mc: "The luckiest career line: growth, promotion, generous opportunities.", dsc: "Generous, big-hearted partners and friends; people help you.", ic: "A prosperous, comfortable home base; a good place to settle and grow." },
  saturn: { asc: "You feel heavier, more serious and more alone; things take effort.", mc: "Slow but solid career progress; hard work and real responsibility, no shortcuts.", dsc: "Serious, dutiful or older partners; relationships test you.", ic: "Home feels like duty; good for discipline, not for ease." },
  uranus: { asc: "You feel freer and more unconventional; life is unpredictable here.", mc: "Sudden career changes, invention, or a complete reinvention.", dsc: "Unusual, exciting, unstable relationships.", ic: "Frequent moves and household upheaval; never settled for long." },
  neptune: { asc: "Dreamy and inspired, but hard to stay grounded.", mc: "Good for art, music, spiritual or charity work; bad for clear ambition.", dsc: "Romantic idealism; you may see partners as you wish them to be.", ic: "A peaceful retreat, or a fog you never quite leave." },
  pluto: { asc: "Intense personal change; you leave a different person.", mc: "Power, influence and big transformations in your work, for better or worse.", dsc: "All-consuming relationships that change you.", ic: "Old family patterns surface and get broken; deep private change." },
};

export const REACH_KM = 600;
export type Strength = "Strong" | "Noticeable" | "Faint";
export const strengthOf = (km: number): Strength => (km < 200 ? "Strong" : km < 400 ? "Noticeable" : "Faint");

// The questions the city lists answer, each owned by one planet's lines.
export interface AtlasQuestion { key: string; title: string; planet: string; kinds: LineKind[]; why: string; warn?: boolean }
export const QUESTIONS: AtlasQuestion[] = [
  { key: "love", title: "Love", planet: "venus", kinds: ["dsc", "asc"], why: "Romance and friendship come easily near these cities. Venus setting or rising." },
  { key: "fun", title: "Fun", planet: "sun", kinds: ["asc"], why: "Feeling alive, playful and at your best; good for holidays. Sun rising." },
  { key: "luck", title: "Luck and money", planet: "jupiter", kinds: ["mc", "asc"], why: "Opportunities, growth and generous people. Jupiter overhead or rising." },
  { key: "work", title: "Work and reputation", planet: "sun", kinds: ["mc"], why: "Being seen and recognised for what you do. Sun overhead." },
  { key: "home", title: "Home", planet: "moon", kinds: ["ic"], why: "Comfort, belonging, a place that feels like yours. Moon underfoot." },
  { key: "trial", title: "Hard lessons", planet: "saturn", kinds: ["asc", "mc"], why: "Effort, delays and responsibility. Good for discipline, not for holidays. Saturn rising or overhead.", warn: true },
];
// The council's map reads four of them, one theme at a time.
export const COUNCIL_THEMES: AtlasQuestion[] = [
  { key: "luck", title: "Luck", planet: "jupiter", kinds: ["mc", "asc"], why: "" },
  { key: "love", title: "Love", planet: "venus", kinds: ["dsc", "asc"], why: "" },
  { key: "fun", title: "Fun", planet: "sun", kinds: ["asc"], why: "" },
  { key: "home", title: "Home", planet: "moon", kinds: ["ic"], why: "" },
];

// ── Geometry ────────────────────────────────────────────────────────────────

function horizonLat(gmst: number, ra: number, dec: number, lon: number): { lat: number; rising: boolean } | null {
  const h = wrap(gmst + lon - ra);
  const tanDec = Math.tan(dec * RAD);
  if (Math.abs(tanDec) < 1e-9) return null;
  const lat = Math.atan(-Math.cos(h * RAD) / tanDec) / RAD;
  if (Math.abs(lat) > 84) return null;
  return { lat, rising: h < 0 };
}

function splitSegments(pts: [number, number][]): Segment[] {
  const segs: Segment[] = [];
  let cur: Segment = [];
  for (const q of pts) {
    if (cur.length && Math.abs(q[0] - cur[cur.length - 1][0]) > 2) { segs.push(cur); cur = []; }
    cur.push(q);
  }
  if (cur.length) segs.push(cur);
  return segs.filter((s) => s.length > 1);
}

export function planetLines(gmst: number, key: string, name: string, glyph: string, ra: number, dec: number): PlanetLines {
  const mc = wrap(ra - gmst);
  const ic = wrap(mc + 180);
  const asc: [number, number][] = [], dsc: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 1) {
    const h = horizonLat(gmst, ra, dec, lon);
    if (!h) continue;
    (h.rising ? asc : dsc).push([lon, h.lat]);
  }
  return { key, name, glyph, ra, dec, mc, ic, asc: splitSegments(asc), dsc: splitSegments(dsc) };
}

export function atlasChart(b: BirthInput): AtlasChart | null {
  if (!b.dateStr || !b.timeStr || b.lat == null || b.lon == null) return null;
  const jd = julianDay(b.dateStr, b.timeStr, b.tz || undefined);
  if (jd == null) return null;
  const n = jd - 2451545.0;
  const gmst = rev(280.46061837 + 360.98564736629 * n);
  const eps = (23.4393 - 3.563e-7 * n) * RAD;
  const planets = PLANETS.map((p) => {
    const lam = planetLongitude(p.key, jd) * RAD;
    const bet = planetLatitude(p.key, jd) * RAD;
    // Ecliptic (λ, β) to equatorial (α, δ), rotating about the x-axis by ε.
    const x = Math.cos(bet) * Math.cos(lam);
    const y = Math.cos(bet) * Math.sin(lam) * Math.cos(eps) - Math.sin(bet) * Math.sin(eps);
    const z = Math.cos(bet) * Math.sin(lam) * Math.sin(eps) + Math.sin(bet) * Math.cos(eps);
    const ra = rev(Math.atan2(y, x) / RAD);
    const dec = Math.asin(Math.max(-1, Math.min(1, z))) / RAD;
    return planetLines(gmst, p.key, p.name, p.glyph, ra, dec);
  });
  return { jd, gmst, planets };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dl = (lon2 - lon1) * RAD, dp = (lat2 - lat1) * RAD;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
}

// Distance from a place to one of a planet's lines, in km. The rising and
// setting curves are single-valued in longitude, so only the stretch of
// curve near the place's longitude needs sampling.
export function distanceToLine(chart: AtlasChart, p: PlanetLines, kind: LineKind, lat: number, lon: number): number {
  let best = Infinity;
  if (kind === "mc" || kind === "ic") {
    const L = p[kind];
    for (let dlat = -12; dlat <= 12; dlat += 2) {
      const la = Math.max(-84, Math.min(84, lat + dlat));
      best = Math.min(best, haversineKm(lat, lon, la, L));
    }
    return best;
  }
  const wantRising = kind === "asc";
  for (let dl = -8; dl <= 8; dl += 1) {
    const L = wrap(lon + dl);
    const h = horizonLat(chart.gmst, p.ra, p.dec, L);
    if (!h || h.rising !== wantRising) continue;
    best = Math.min(best, haversineKm(lat, lon, h.lat, L));
  }
  return best;
}

// ── Places and their metros ─────────────────────────────────────────────────
// The nearest place is named exactly (Benoni, not Johannesburg), with the
// nearest major city beside it in a quieter voice. Places that share a major
// city collapse into one row, so a list is never four suburbs of one metro.

export const MAJOR_POP = 1_000_000;
export const METRO_KM = 120;
const MAJORS = ATLAS_CITIES.filter((c) => c[4] >= MAJOR_POP);
const metroCache = new Map<AtlasCity, AtlasCity | null>();

// The major city a place belongs to: the LARGEST city of a million or more
// within reach, itself included (so Shubra al Khaymah folds into Cairo and
// Soweto into Johannesburg), or null when no major city is near.
export function metroOf(c: AtlasCity): AtlasCity | null {
  const hit = metroCache.get(c);
  if (hit !== undefined) return hit;
  let best: AtlasCity | null = c[4] >= MAJOR_POP ? c : null;
  for (const m of MAJORS) {
    if (best && m[4] <= best[4]) continue;
    if (Math.abs(m[2] - c[2]) > 1.5 || Math.abs(((m[3] - c[3] + 540) % 360) - 180) > 3) continue;
    if (haversineKm(c[2], c[3], m[2], m[3]) < METRO_KM) best = m;
  }
  metroCache.set(c, best);
  return best;
}
// "near Johannesburg", or nothing when the place is the major city itself.
export function nearLabel(c: AtlasCity): string | null {
  const m = metroOf(c);
  return m && m !== c ? m[0] : null;
}
// Country name from the ISO code, in English; the code itself if the
// runtime cannot name it.
let regionNames: Intl.DisplayNames | null | undefined;
export function countryName(cc: string): string {
  if (regionNames === undefined) {
    try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { regionNames = null; }
  }
  try { return regionNames?.of(cc) || cc; } catch { return cc; }
}
// "near Johannesburg, South Africa" or just "South Africa". On the card the
// home country is shortened to SA (the Keiser's decree); the email keeps it long.
export function placeContext(c: AtlasCity, short = false): string {
  const near = nearLabel(c);
  const country = short && c[1] === "ZA" ? "SA" : countryName(c[1]);
  return near ? `near ${near}, ${country}` : country;
}
const metroKey = (c: AtlasCity) => { const m = metroOf(c); return m ? `${m[0]}|${m[1]}` : `${c[0]}|${c[1]}|${c[2]}|${c[3]}`; };

// ── Readings ────────────────────────────────────────────────────────────────

export interface LineHit { planet: PlanetLines; kind: LineKind; km: number; strength: Strength }

// Every line within reach of a place, nearest first.
export function askOfPlace(chart: AtlasChart, lat: number, lon: number): LineHit[] {
  const hits: LineHit[] = [];
  for (const p of chart.planets) for (const kind of LINE_KINDS) {
    const km = distanceToLine(chart, p, kind, lat, lon);
    if (km < REACH_KM) hits.push({ planet: p, kind, km, strength: strengthOf(km) });
  }
  return hits.sort((a, b) => a.km - b.km);
}

export interface CityHit { city: AtlasCity; kind: LineKind; km: number; strength: Strength }

// The nearest cities to a question's lines.
export function citiesFor(chart: AtlasChart, q: AtlasQuestion, limit = 5, cities: AtlasCity[] = ATLAS_CITIES): CityHit[] {
  const p = chart.planets.find((x) => x.key === q.planet);
  if (!p) return [];
  const out: CityHit[] = [];
  for (const c of cities) {
    let bestKm = Infinity, bestKind: LineKind = q.kinds[0];
    for (const kind of q.kinds) {
      const km = distanceToLine(chart, p, kind, c[2], c[3]);
      if (km < bestKm) { bestKm = km; bestKind = kind; }
    }
    if (bestKm < REACH_KM) out.push({ city: c, kind: bestKind, km: bestKm, strength: strengthOf(bestKm) });
  }
  return collapseByMetro(out.sort((a, b) => a.km - b.km), (h) => h.city).slice(0, limit);
}

// Keep the first (nearest) entry per metro.
function collapseByMetro<T>(sorted: T[], cityOf: (t: T) => AtlasCity): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of sorted) {
    const k = metroKey(cityOf(t));
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}

// Cities near a planet's lines of any kind (the map's "nearest cities marked").
export function nearestCities(chart: AtlasChart, planetKey: string, limit = 6): AtlasCity[] {
  const p = chart.planets.find((x) => x.key === planetKey);
  if (!p) return [];
  const ranked = ATLAS_CITIES
    .map((c) => ({ c, km: Math.min(...LINE_KINDS.map((k) => distanceToLine(chart, p, k, c[2], c[3]))) }))
    .filter((x) => x.km < REACH_KM)
    .sort((a, b) => a.km - b.km);
  return collapseByMetro(ranked, (x) => x.c).slice(0, limit).map((x) => x.c);
}

// The council's map: which cities gather the most members for one theme.
export interface CouncilSoul { id: string; initials: string; name: string; chart: AtlasChart; self?: boolean }

// Who stands on the council's map: living full members and the Keiser whose
// record is complete. Initiates, sleeping seats and veiled charts never do.
export const COUNCIL_ROLES = new Set(["member", "keiser"]);
export interface RosterRow {
  id: string; cult_name: string; short_name?: string | null; role: string; active?: boolean | null;
  date_of_birth?: string | null; time_of_birth?: string | null; birth_lat?: number | null; birth_lon?: number | null; birth_tz?: string | null;
}
export const initialsOf = (m: { short_name?: string | null; cult_name: string }) =>
  (m.short_name || m.cult_name.split(" ").map((w) => w[0]).join("").slice(0, 2)).toUpperCase();
export function foldSouls(list: RosterRow[], meId?: string | null): CouncilSoul[] {
  const out: CouncilSoul[] = [];
  for (const m of list) {
    if (m.active === false || !COUNCIL_ROLES.has(m.role)) continue;
    const chart = atlasChart({ dateStr: m.date_of_birth || "", timeStr: m.time_of_birth, tz: m.birth_tz, lat: m.birth_lat, lon: m.birth_lon });
    if (!chart) continue;
    out.push({ id: m.id, initials: initialsOf(m), name: m.cult_name, chart, self: !!meId && m.id === meId });
  }
  return out;
}
export interface CouncilCity { city: AtlasCity; who: CouncilSoul[] }
export function councilCities(souls: CouncilSoul[], theme: AtlasQuestion, limit = 6, cities: AtlasCity[] = ATLAS_CITIES): CouncilCity[] {
  const out: CouncilCity[] = [];
  for (const c of cities) {
    const who = souls.filter((s) => {
      const p = s.chart.planets.find((x) => x.key === theme.planet);
      return !!p && theme.kinds.some((k) => distanceToLine(s.chart, p, k, c[2], c[3]) < REACH_KM);
    });
    if (who.length >= 2) out.push({ city: c, who });
  }
  out.sort((a, b) => b.who.length - a.who.length || b.city[4] - a.city[4]);
  return collapseByMetro(out, (r) => r.city).slice(0, limit);
}

// ── Kindred ground ──────────────────────────────────────────────────────────
// Where two members' favourable lines meet: a place within reach of a
// welcome line of each. Saturn is left out; nobody meets under a trial.
export const KINDRED_QUESTIONS = QUESTIONS.filter((q) => !q.warn);
export interface KindredSide { planet: PlanetLines; kind: LineKind; km: number; theme: AtlasQuestion }
export interface KindredHit { city: AtlasCity; mine: KindredSide; theirs: KindredSide; score: number }

function bestWelcomeLine(chart: AtlasChart, c: AtlasCity): KindredSide | null {
  let best: KindredSide | null = null;
  for (const q of KINDRED_QUESTIONS) {
    const p = chart.planets.find((x) => x.key === q.planet);
    if (!p) continue;
    for (const kind of q.kinds) {
      const km = distanceToLine(chart, p, kind, c[2], c[3]);
      if (km < REACH_KM && (!best || km < best.km)) best = { planet: p, kind, km, theme: q };
    }
  }
  return best;
}

export function kindredGround(mine: AtlasChart, theirs: AtlasChart, limit = 3, cities: AtlasCity[] = ATLAS_CITIES): KindredHit[] {
  const out: KindredHit[] = [];
  for (const c of cities) {
    const a = bestWelcomeLine(mine, c);
    if (!a) continue;
    const b = bestWelcomeLine(theirs, c);
    if (!b) continue;
    out.push({ city: c, mine: a, theirs: b, score: a.km + b.km });
  }
  out.sort((x, y) => x.score - y.score);
  return collapseByMetro(out, (h) => h.city).slice(0, limit);
}

export const roundKm = (km: number) => Math.max(10, Math.round(km / 10) * 10);
export const cityLabel = (c: AtlasCity) => c[0];
