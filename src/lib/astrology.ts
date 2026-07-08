// The Council's natal engine. Everything is computed from real astronomy where
// astronomy applies: true solar longitude (sun sign + element), a perturbed
// lunar ephemeris (moon sign + birth phase), Schlyter orbital elements for
// Venus, and the exact sidereal-time ascendant from birth time + place.
// Birth times are entered as LOCAL time in a chosen IANA timezone (default
// South Africa) and converted to Universal Time via the platform tz database,
// historically correct offsets included.

export const DEFAULT_TZ = "Africa/Johannesburg";

// Every IANA zone the runtime knows (typed around an ES2022 API the compiler
// target predates). Fallback: at least the default.
export function allTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    const list = intl.supportedValuesOf?.("timeZone");
    if (list && list.length) return list;
  } catch {}
  return [DEFAULT_TZ];
}

export interface Sign {
  name: string;
  symbol: string;
  element: "Fire" | "Earth" | "Air" | "Water";
}

// In zodiac order: SIGNS[floor(eclipticLongitude / 30)] is the sign.
const SIGNS: Sign[] = [
  { name: "Aries", symbol: "♈", element: "Fire" },
  { name: "Taurus", symbol: "♉", element: "Earth" },
  { name: "Gemini", symbol: "♊", element: "Air" },
  { name: "Cancer", symbol: "♋", element: "Water" },
  { name: "Leo", symbol: "♌", element: "Fire" },
  { name: "Virgo", symbol: "♍", element: "Earth" },
  { name: "Libra", symbol: "♎", element: "Air" },
  { name: "Scorpio", symbol: "♏", element: "Water" },
  { name: "Sagittarius", symbol: "♐", element: "Fire" },
  { name: "Capricorn", symbol: "♑", element: "Earth" },
  { name: "Aquarius", symbol: "♒", element: "Air" },
  { name: "Pisces", symbol: "♓", element: "Water" },
];

// --- Time foundations ------------------------------------------------

// Minutes east of UTC for an IANA zone at a UTC instant (the tz database
// handles historical rules, so old birthdates get the offsets of their era).
function tzOffsetMin(tz: string, utcMs: number): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    const p: Record<string, number> = {};
    for (const { type, value } of dtf.formatToParts(new Date(utcMs))) {
      if (type !== "literal") p[type] = Number(value);
    }
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
    return (asUtc - utcMs) / 60000;
  } catch {
    return 120; // South Africa if the zone id is unknown
  }
}

// Julian Day of a local birth moment. No time given → local noon (the least
// biased instant of the civil day). Exported for the chart + transit engines.
export function julianDay(dateStr: string, timeStr?: string | null, tz: string = DEFAULT_TZ): number | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  let hh = 12, mm = 0;
  if (timeStr) {
    const t = timeStr.split(":").map(Number);
    if (!Number.isNaN(t[0])) { hh = t[0]; mm = t[1] || 0; }
  }
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall - tzOffsetMin(tz, wall) * 60000;
  utc = wall - tzOffsetMin(tz, utc) * 60000; // re-derive once across DST edges
  return utc / 86400000 + 2440587.5;
}

// The zodiac in longitude order, exported for the chart + transit engines.
export const ZODIAC = SIGNS;

// --- Sun (true ecliptic longitude, ~0.01° — exact for a 30° sign bin) --
export function sunLongitude(jd: number): number {
  const n = jd - 2451545.0;
  const L = rev(280.46 + 0.9856474 * n);
  const g = (357.528 + 0.9856003 * n) * RAD;
  return rev(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

export function sunSign(dateStr: string, timeStr?: string | null, tz?: string | null): Sign | null {
  const jd = julianDay(dateStr, timeStr, tz || DEFAULT_TZ);
  if (jd == null) return null;
  return SIGNS[Math.floor(sunLongitude(jd) / 30) % 12];
}

// --- Ascendant (exact: sidereal time + obliquity at birth place) ------
// Needs the birth time AND coordinates; returns null without them rather
// than guessing.
export function ascendantLongitude(
  dateStr: string,
  timeStr?: string | null,
  tz?: string | null,
  lat?: number | null,
  lon?: number | null
): number | null {
  if (!timeStr || lat == null || lon == null) return null;
  const jd = julianDay(dateStr, timeStr, tz || DEFAULT_TZ);
  if (jd == null) return null;
  const n = jd - 2451545.0;
  const gmst = rev(280.46061837 + 360.98564736629 * n); // Greenwich sidereal, degrees
  const ramc = rev(gmst + lon) * RAD; // local sidereal → right ascension of the MC
  const eps = (23.4393 - 3.563e-7 * n) * RAD; // mean obliquity
  const phi = lat * RAD;
  return rev(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / RAD);
}

export function ascendant(
  dateStr: string,
  timeStr?: string | null,
  tz?: string | null,
  lat?: number | null,
  lon?: number | null
): Sign | null {
  const asc = ascendantLongitude(dateStr, timeStr, tz, lat, lon);
  return asc == null ? null : SIGNS[Math.floor(asc / 30) % 12];
}

// --- Moon sign -------------------------------------------------------
// Geocentric ecliptic longitude of the Moon (Schlyter's low-precision method,
// with the main perturbations — good to ~0.1°, ample for a 30° sign bin).
const RAD = Math.PI / 180;
const rev = (x: number) => x - Math.floor(x / 360) * 360;

export function moonLongitude(jd: number): number {
  const day = jd - 2451543.5; // Schlyter's epoch, 2000-01-00.0 UT
  const N = rev(125.1228 - 0.0529538083 * day);
  const i = 5.1454;
  const w = rev(318.0634 + 0.1643573223 * day);
  const a = 60.2666;
  const e = 0.0549;
  const M = rev(115.3654 + 13.0649929509 * day);
  const Ms = rev(356.047 + 0.9856002585 * day);
  const ws = 282.9404 + 4.70935e-5 * day;
  const E = M + (180 / Math.PI) * e * Math.sin(M * RAD) * (1 + e * Math.cos(M * RAD));
  const xv = a * (Math.cos(E * RAD) - e);
  const yv = a * (Math.sqrt(1 - e * e) * Math.sin(E * RAD));
  const v = rev((Math.atan2(yv, xv) / RAD));
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (Math.cos(N * RAD) * Math.cos((v + w) * RAD) - Math.sin(N * RAD) * Math.sin((v + w) * RAD) * Math.cos(i * RAD));
  const yh = r * (Math.sin(N * RAD) * Math.cos((v + w) * RAD) + Math.cos(N * RAD) * Math.sin((v + w) * RAD) * Math.cos(i * RAD));
  let lon = rev(Math.atan2(yh, xh) / RAD);
  const Lm = rev(N + w + M);
  const Ls = rev(Ms + ws);
  const Dm = rev(Lm - Ls);
  const F = rev(Lm - N);
  lon += -1.274 * Math.sin((M - 2 * Dm) * RAD);
  lon += 0.658 * Math.sin(2 * Dm * RAD);
  lon += -0.186 * Math.sin(Ms * RAD);
  lon += -0.059 * Math.sin((2 * M - 2 * Dm) * RAD);
  lon += -0.057 * Math.sin((M - 2 * Dm + Ms) * RAD);
  lon += 0.053 * Math.sin((M + 2 * Dm) * RAD);
  lon += 0.046 * Math.sin((2 * Dm - Ms) * RAD);
  lon += 0.041 * Math.sin((M - Ms) * RAD);
  lon += -0.035 * Math.sin(Dm * RAD);
  lon += -0.031 * Math.sin((M + Ms) * RAD);
  lon += -0.015 * Math.sin((2 * F - 2 * Dm) * RAD);
  lon += 0.011 * Math.sin((M - 4 * Dm) * RAD);
  return rev(lon);
}

export function moonSign(dateStr: string, timeStr?: string | null, tz?: string | null): Sign | null {
  const jd = julianDay(dateStr, timeStr, tz || DEFAULT_TZ);
  if (jd == null) return null;
  return SIGNS[Math.floor(moonLongitude(jd) / 30) % 12];
}

// --- Moon phase at birth ----------------------------------------------
// The sun–moon elongation, binned into the eight traditional phases.
const PHASES = [
  "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
  "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
];

export function moonPhase(dateStr: string, timeStr?: string | null, tz?: string | null): string | null {
  const jd = julianDay(dateStr, timeStr, tz || DEFAULT_TZ);
  if (jd == null) return null;
  const elong = rev(moonLongitude(jd) - sunLongitude(jd));
  return PHASES[Math.floor(((elong + 22.5) % 360) / 45)];
}

// --- Venus, the palate's planet ----------------------------------------
// Heliocentric Venus (Schlyter elements) + the sun's geocentric position
// gives Venus's geocentric ecliptic longitude, then the sign.
function venusLongitude(jd: number): number {
  const d = jd - 2451543.5;
  const N = rev(76.6799 + 2.4659e-5 * d) * RAD;
  const i = (3.3946 + 2.75e-8 * d) * RAD;
  const w = rev(54.891 + 1.38374e-5 * d) * RAD;
  const a = 0.72333;
  const e = 0.006773 - 1.302e-9 * d;
  const M = rev(48.0052 + 1.6021302244 * d) * RAD;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 5; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  // Earth → Venus = Earth → Sun + Sun → Venus
  const n = jd - 2451545.0;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const rs = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const ls = sunLongitude(jd) * RAD;
  return rev(Math.atan2(yh + rs * Math.sin(ls), xh + rs * Math.cos(ls)) / RAD);
}

export const VENUS_IN: Record<string, string> = {
  Aries: "Bold first sips and impatient pleasure: they fall for a wine fast and hard.",
  Taurus: "The purest hedonist: slow, sensual, loyal to deep comfort and rich fruit.",
  Gemini: "A curious palate that flits: two glasses open, three opinions on each.",
  Cancer: "Nostalgic taste: they love the wine that remembers a place or a person.",
  Leo: "Grand pleasure: the showstopper bottle, poured generously, praised loudly.",
  Virgo: "Precision pleasure: notices the flaw, treasures the perfectly made.",
  Libra: "The aesthete: balance above all, charmed by elegance and fine company.",
  Scorpio: "All or nothing: obsessive, intense, drawn to dark and brooding depths.",
  Sagittarius: "The adventurer: strange grapes, far regions, the untried bottle first.",
  Capricorn: "Patient pleasure: age, pedigree, and the long game of the cellar.",
  Aquarius: "The contrarian palate: loves what the rest of the table overlooks.",
  Pisces: "The dream drinker: taste as reverie, moved more by mood than method.",
};

export function venusSign(dateStr: string, timeStr?: string | null, tz?: string | null): Sign | null {
  const jd = julianDay(dateStr, timeStr, tz || DEFAULT_TZ);
  if (jd == null) return null;
  return SIGNS[Math.floor(venusLongitude(jd) / 30) % 12];
}

// --- Chinese day-master (Bazi day stem) ---------------------------------
// The sexagenary day cycle runs unbroken through history; the stem of the
// civil birth date is the "day master", the element of the self.
export interface DayMaster { hanzi: string; element: string; polarity: "Yang" | "Yin"; meaning: string }
const STEMS: DayMaster[] = [
  { hanzi: "甲", element: "Wood", polarity: "Yang", meaning: "The tall tree: upright, principled, growing steadily toward the light." },
  { hanzi: "乙", element: "Wood", polarity: "Yin", meaning: "The vine: flexible, artful, thriving by winding around every obstacle." },
  { hanzi: "丙", element: "Fire", polarity: "Yang", meaning: "The sun: radiant, generous, impossible to ignore." },
  { hanzi: "丁", element: "Fire", polarity: "Yin", meaning: "The candle flame: subtle warmth, insight, quiet influence." },
  { hanzi: "戊", element: "Earth", polarity: "Yang", meaning: "The mountain: steadfast, protective, slow to move and hard to shake." },
  { hanzi: "己", element: "Earth", polarity: "Yin", meaning: "The garden soil: nurturing, modest, quietly making things grow." },
  { hanzi: "庚", element: "Metal", polarity: "Yang", meaning: "The sword: decisive, dutiful, tempered by hardship." },
  { hanzi: "辛", element: "Metal", polarity: "Yin", meaning: "The jewel: refined, exacting, polished under pressure." },
  { hanzi: "壬", element: "Water", polarity: "Yang", meaning: "The ocean: ambitious, far-ranging, deep beyond sounding." },
  { hanzi: "癸", element: "Water", polarity: "Yin", meaning: "The rain: gentle, perceptive, wearing away stone in time." },
];

export function dayMaster(dateStr: string): DayMaster | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  return STEMS[(jdn + 9) % 10]; // anchored: 2000-01-01 was a 戊 (Yang Earth) day
}

// --- Life path number (numerology) ---------------------------------------
// Year, month, and day each reduce, then their sum reduces, preserving the
// master numbers 11, 22, and 33.
export interface LifePath { number: number; meaning: string }
const LIFE_PATHS: Record<number, string> = {
  1: "The pioneer: independent, driven, first through every door.",
  2: "The diplomat: intuitive, patient, the quiet keeper of peace.",
  3: "The voice: expressive, playful, born to charm the table.",
  4: "The builder: disciplined, loyal, laying stone upon stone.",
  5: "The wanderer: restless, adaptable, hungry for the untasted.",
  6: "The guardian: devoted, harmonious, keeper of home and hearth.",
  7: "The seeker: analytical, solitary, drawn to hidden truths.",
  8: "The sovereign: ambitious, commanding, made for mastery.",
  9: "The elder soul: compassionate, wise, giving more than taking.",
  11: "A master number: the illuminator, visionary and highly strung.",
  22: "A master number: the master builder, grand designs made real.",
  33: "A master number: the master teacher, love raised to a discipline.",
};

export function lifePath(dateStr: string): LifePath | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const reduce = (x: number): number => {
    while (x > 9 && x !== 11 && x !== 22 && x !== 33) {
      x = String(x).split("").reduce((s, c) => s + Number(c), 0);
    }
    return x;
  };
  const n = reduce(reduce(y) + reduce(m) + reduce(d));
  return { number: n, meaning: LIFE_PATHS[n] };
}

// --- Birth arcana (tarot) -------------------------------------------------
// Every digit of the birth date summed, reduced until it lands on a Major
// Arcana number; 22 is the Fool.
export interface Arcana { num: number; name: string; meaning: string }
const MAJOR_ARCANA: Arcana[] = [
  { num: 0, name: "The Fool", meaning: "The innocent leap: endless beginnings, faith in the unknown." },
  { num: 1, name: "The Magician", meaning: "Will made manifest: talent, resourcefulness, sleight of destiny." },
  { num: 2, name: "The High Priestess", meaning: "Keeper of the veil: intuition, secrets, the inner voice." },
  { num: 3, name: "The Empress", meaning: "Abundance embodied: creation, nurture, the fertile world." },
  { num: 4, name: "The Emperor", meaning: "Order and dominion: structure, authority, the steady hand." },
  { num: 5, name: "The Hierophant", meaning: "Keeper of rites: tradition, teaching, sacred knowledge." },
  { num: 6, name: "The Lovers", meaning: "The great choice: union, values, hearts weighed openly." },
  { num: 7, name: "The Chariot", meaning: "Victory by will: discipline driving opposing forces as one." },
  { num: 8, name: "Strength", meaning: "The gentle hand that calms the lion: courage and patience." },
  { num: 9, name: "The Hermit", meaning: "The lantern in the dark: introspection, wisdom sought alone." },
  { num: 10, name: "Wheel of Fortune", meaning: "The turning of fate: cycles, luck, what goes and returns." },
  { num: 11, name: "Justice", meaning: "The blade and the scales: truth, consequence, exact measure." },
  { num: 12, name: "The Hanged Man", meaning: "Surrender and see: the sacrifice that turns the world over." },
  { num: 13, name: "Death", meaning: "The great transformer: endings that make way for life." },
  { num: 14, name: "Temperance", meaning: "The alchemist's blend: balance, healing, the middle way." },
  { num: 15, name: "The Devil", meaning: "The gilded chain: desire, shadow, bargains half-remembered." },
  { num: 16, name: "The Tower", meaning: "Lightning to the crown: sudden truth, needful ruin." },
  { num: 17, name: "The Star", meaning: "Hope after the storm: grace, renewal, quiet guidance." },
  { num: 18, name: "The Moon", meaning: "The uncertain road: dream, illusion, instinct in the dark." },
  { num: 19, name: "The Sun", meaning: "Unclouded joy: vitality, clarity, success in full light." },
  { num: 20, name: "Judgement", meaning: "The great awakening: reckoning, rebirth, the summons." },
  { num: 21, name: "The World", meaning: "Completion's dance: wholeness, mastery, the journey crowned." },
];

export function birthArcana(dateStr: string): Arcana | null {
  const digits = dateStr.replace(/\D/g, "");
  if (digits.length < 8) return null;
  let sum = digits.split("").reduce((s, c) => s + Number(c), 0);
  while (sum > 22) sum = String(sum).split("").reduce((s, c) => s + Number(c), 0);
  return MAJOR_ARCANA[sum === 22 ? 0 : sum];
}

// --- Chinese zodiac (Shengxiao) + five elements (Wu Xing) ------------
export interface Animal { name: string; symbol: string }
const ANIMALS: Animal[] = [
  { name: "Rat", symbol: "鼠" }, { name: "Ox", symbol: "牛" }, { name: "Tiger", symbol: "虎" },
  { name: "Rabbit", symbol: "兔" }, { name: "Dragon", symbol: "龙" }, { name: "Snake", symbol: "蛇" },
  { name: "Horse", symbol: "马" }, { name: "Goat", symbol: "羊" }, { name: "Monkey", symbol: "猴" },
  { name: "Rooster", symbol: "鸡" }, { name: "Dog", symbol: "狗" }, { name: "Pig", symbol: "猪" },
];

// Chinese New Year (Gregorian date, "MM-DD") per year. The zodiac animal and
// the five-element year begin on this date, NOT 1 January — a birth in January
// or early February, before that year's New Year, belongs to the previous
// year's sign. Accepted Gregorian dates of Chinese New Year.
const CHINESE_NEW_YEAR: Record<number, string> = {
  1940: "02-08", 1941: "01-27", 1942: "02-15", 1943: "02-05", 1944: "01-25",
  1945: "02-13", 1946: "02-02", 1947: "01-22", 1948: "02-10", 1949: "01-29",
  1950: "02-17", 1951: "02-06", 1952: "01-27", 1953: "02-14", 1954: "02-03",
  1955: "01-24", 1956: "02-12", 1957: "01-31", 1958: "02-18", 1959: "02-08",
  1960: "01-28", 1961: "02-15", 1962: "02-05", 1963: "01-25", 1964: "02-13",
  1965: "02-02", 1966: "01-21", 1967: "02-09", 1968: "01-30", 1969: "02-17",
  1970: "02-06", 1971: "01-27", 1972: "02-15", 1973: "02-03", 1974: "01-23",
  1975: "02-11", 1976: "01-31", 1977: "02-18", 1978: "02-07", 1979: "01-28",
  1980: "02-16", 1981: "02-05", 1982: "01-25", 1983: "02-13", 1984: "02-02",
  1985: "02-20", 1986: "02-09", 1987: "01-29", 1988: "02-17", 1989: "02-06",
  1990: "01-27", 1991: "02-15", 1992: "02-04", 1993: "01-23", 1994: "02-10",
  1995: "01-31", 1996: "02-19", 1997: "02-07", 1998: "01-28", 1999: "02-16",
  2000: "02-05", 2001: "01-24", 2002: "02-12", 2003: "02-01", 2004: "01-22",
  2005: "02-09", 2006: "01-29", 2007: "02-18", 2008: "02-07", 2009: "01-26",
  2010: "02-14", 2011: "02-03", 2012: "01-23", 2013: "02-10", 2014: "01-31",
  2015: "02-19", 2016: "02-08", 2017: "01-28", 2018: "02-16", 2019: "02-05",
  2020: "01-25", 2021: "02-12", 2022: "02-01", 2023: "01-22", 2024: "02-10",
  2025: "01-29", 2026: "02-17", 2027: "02-06", 2028: "01-26", 2029: "02-13",
  2030: "02-03",
};

// The effective Chinese astrological year for a Gregorian date, honouring the
// New Year boundary. Outside the table it falls back to a ~4 Feb approximation.
function chineseYear(dateStr: string): number | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const md = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cny = CHINESE_NEW_YEAR[y];
  if (cny) return md < cny ? y - 1 : y;
  return m === 1 || (m === 2 && d < 4) ? y - 1 : y;
}

export function shengxiao(dateStr: string): Animal | null {
  const y = chineseYear(dateStr);
  if (!y) return null;
  return ANIMALS[(((y - 4) % 12) + 12) % 12];
}

// The animal + element of a Gregorian year's Chinese year, with the date it
// begins — for the Foretelling's year reading.
export function yearAnimalInfo(y: number): { animal: Animal; element: string; fromLabel: string; index: number } {
  const idx = (((y - 4) % 12) + 12) % 12;
  const byDigit = ["Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth"];
  const cny = CHINESE_NEW_YEAR[y];
  const fromLabel = cny
    ? `from ${Number(cny.slice(3))} ${["Jan", "Feb"][Number(cny.slice(0, 2)) - 1] || "Feb"}`
    : "from early February";
  return { animal: ANIMALS[idx], element: byDigit[((y % 10) + 10) % 10], fromLabel, index: idx };
}

export interface WuXing { name: string; symbol: string; meaning: string }
export const WU_XING: Record<string, WuXing> = {
  Wood: { name: "Wood", symbol: "木", meaning: "Symbolizes growth, vitality, and flexibility. People with a Wood element are highly creative, compassionate, and generous, with a persistent drive for innovation." },
  Fire: { name: "Fire", symbol: "火", meaning: "Represents passion, energy, and dynamism. Those ruled by Fire are natural leaders, enthusiastic, decisive, and highly assertive." },
  Earth: { name: "Earth", symbol: "土", meaning: "Stands for stability, nourishment, and reliability. Earth signs are practical, patient, dependable, and highly focused on creating secure foundations." },
  Metal: { name: "Metal", symbol: "金", meaning: "Embodies structure, determination, and persistence. People with a Metal element are courageous, ambitious, and possess a strong inner strength to withstand challenges." },
  Water: { name: "Water", symbol: "水", meaning: "Symbolizes fluidity, intuition, and wisdom. Water signs are highly adaptable, communicative, sensitive, and tapped into their inner emotions." },
};

export function wuXing(dateStr: string): WuXing | null {
  const y = chineseYear(dateStr);
  if (!y) return null;
  const byDigit = ["Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth"];
  return WU_XING[byDigit[((y % 10) + 10) % 10]];
}
