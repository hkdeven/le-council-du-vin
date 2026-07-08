// The Foretelling engine. Everything is computed: the current lunar cycle
// (new moon to new moon), where its new and full moons land in the member's
// houses, which slow planets make real aspects to their natal Sun, Moon, and
// Ascendant (with true dates), Mercury retrogrades, the year's house
// ingresses, the numerology personal year, and the Chinese year. The words
// are written once, by hand, below — chosen by the alignment, never at random.

import { sunLongitude, moonLongitude, julianDay, ZODIAC, shengxiao, yearAnimalInfo, DEFAULT_TZ } from "./astrology";
import { fullChart, planetLongitude, houseOf, angDiff, ordinal, HOUSE_DOMAIN, type Chart } from "./natal";

const rev = (x: number) => x - Math.floor(x / 360) * 360;
const jdOfMs = (ms: number) => ms / 86400000 + 2440587.5;
const msOfJd = (jd: number) => (jd - 2440587.5) * 86400000;
const fmtDay = (jd: number) => new Date(msOfJd(jd)).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

export interface Omen { glyphs: string; title: string; when: string; body: string }
export interface Foretelling {
  moonLabel: string; // "14 July to 11 August"
  entries: Omen[];
  warning: string | null;
  yearLabel: string;
  year: Omen[];
}

// --- Lunar cycle -------------------------------------------------------
const elong = (jd: number) => rev(moonLongitude(jd) - sunLongitude(jd));

// Refine a new moon between lo (elongation near 360) and hi (near 0).
function refineNew(lo: number, hi: number): number {
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (elong(mid) > 180) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function newMoonBefore(jd: number): number {
  let cur = jd;
  let e = elong(cur);
  for (let i = 0; i < 40; i++) {
    const prev = cur - 1;
    const pe = elong(prev);
    if (pe > e) return refineNew(prev, cur); // wrapped through 0 between prev and cur
    e = pe; cur = prev;
  }
  return jd - 29.53;
}

function newMoonAfter(jd: number): number {
  let cur = jd;
  let e = elong(cur);
  for (let i = 0; i < 40; i++) {
    const next = cur + 1;
    const ne = elong(next);
    if (ne < e) return refineNew(cur, next);
    e = ne; cur = next;
  }
  return jd + 29.53;
}

function fullMoonWithin(lo: number, hi: number): number {
  let cur = lo;
  for (let i = 0; i < 32 && cur < hi; i++) {
    const next = cur + 1;
    if (elong(cur) < 180 && elong(next) >= 180) {
      let a = cur, b = next;
      for (let k = 0; k < 30; k++) {
        const mid = (a + b) / 2;
        if (elong(mid) < 180) a = mid; else b = mid;
      }
      return (a + b) / 2;
    }
    cur = next;
  }
  return (lo + hi) / 2;
}

// --- The hand-written passages ------------------------------------------
type Tone = "conjunction" | "harmonious" | "hard";
const TRANSIT_TEXT: Record<string, Record<Tone, string>> = {
  jupiter: {
    conjunction: "The great benefic stands upon you. A season of increase: say yes more than no, and pour for the table.",
    harmonious: "Fortune leans toward you. Accept the second glass, and the second chance.",
    hard: "Abundance overreaches. Guard against the one bottle too many, in the cellar and in life.",
  },
  saturn: {
    conjunction: "The old taskmaster arrives. What is built now under his eye will hold for years.",
    harmonious: "Discipline pays its quiet dividend. The patience of past moons bears fruit.",
    hard: "The vine tests your patience. Pour slowly, speak late.",
  },
  uranus: {
    conjunction: "Lightning finds you. Expect the unexpected bottle, the unplanned road, the sudden truth.",
    harmonious: "The strange favours you. Try what the table would not.",
    hard: "The ground shifts underfoot. Do not sign, seal, or swear in a storm.",
  },
  neptune: {
    conjunction: "The mist settles on you. Trust the nose over the label, and the dream over the plan.",
    harmonious: "Intuition runs clear. Your blind guesses are not blind this moon.",
    hard: "The fog flatters and deceives. Reread everything twice, then once more.",
  },
  pluto: {
    conjunction: "The deep one stands at your door. What ends now ends for good, and makes room.",
    harmonious: "Quiet power gathers to you. Move once, decisively.",
    hard: "Old ghosts ask for an audience. Grant it once, briefly, then pour them out.",
  },
};
const ASPECT_VERB: Record<string, string> = {
  conjunction: "conjoins", sextile: "sextiles", square: "squares", trine: "trines", opposition: "opposes",
};
const ASPECT_GLYPH: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
};
const NEW_MOON_VERB = "A seed planted in"; // + house domain
const FULL_MOON_VERB = "It rises over"; // + house domain

const PERSONAL_YEAR: Record<number, string> = {
  1: "The pioneer's year: begin the thing you have circled for too long.",
  2: "The diplomat's year: partnerships ripen; let others pour first.",
  3: "The voice's year: speak, host, and be seen at the table.",
  4: "The builder's year: lay foundations, order the cellar, keep the ledger.",
  5: "The wanderer's year: change is the vintage; drink it while it moves.",
  6: "The guardian's year: home and hearth call in their debts, kindly.",
  7: "The seeker's year: study, cellar, deepen. Buy to keep, not to open.",
  8: "The sovereign's year: harvest. Claim what your labour has earned.",
  9: "The elder's year: finish, forgive, and empty the bottle before the new one.",
};

// --- The reading ---------------------------------------------------------
const TRANSIT_PLANETS = ["jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
const PLANET_GLYPH: Record<string, string> = {
  sun: "☉", moon: "☽", jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇", asc: "ASC",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function foretellingFor(
  natal: { dateStr: string; timeStr?: string | null; tz?: string | null; lat?: number | null; lon?: number | null },
  nowMs: number
): Foretelling | null {
  const chart = fullChart(natal.dateStr, natal.timeStr, natal.tz, natal.lat, natal.lon);
  if (!chart || chart.asc == null) return null;
  const nowJd = jdOfMs(nowMs);
  const cycleStart = newMoonBefore(nowJd);
  const cycleEnd = newMoonAfter(cycleStart + 1);
  const fullJd = fullMoonWithin(cycleStart, cycleEnd);

  const natSun = chart.planets.find((p) => p.key === "sun")!.lon;
  const natMoon = chart.planets.find((p) => p.key === "moon")!.lon;
  const targets: { key: string; label: string; lon: number }[] = [
    { key: "sun", label: "Sun", lon: natSun },
    { key: "moon", label: "Moon", lon: natMoon },
    { key: "asc", label: "Ascendant", lon: chart.asc },
  ];

  const entries: Omen[] = [];

  // New + full moon, landed in their houses.
  const nmLon = sunLongitude(cycleStart); // at new moon, moon = sun longitude
  const nmSign = ZODIAC[Math.floor(nmLon / 30) % 12];
  const nmHouse = houseOf(nmLon, chart.asc)!;
  entries.push({
    glyphs: "🌑",
    title: `New moon · ${nmSign.symbol} ${nmSign.name} · your ${ordinal(nmHouse)} house`,
    when: fmtDay(cycleStart),
    body: `${NEW_MOON_VERB} ${HOUSE_DOMAIN[nmHouse]}: set the intention there, and let it root in the dark.`,
  });
  const fmLon = moonLongitude(fullJd);
  const fmSign = ZODIAC[Math.floor(fmLon / 30) % 12];
  const fmHouse = houseOf(fmLon, chart.asc)!;

  // Slow-planet transits to Sun, Moon, ASC across the cycle (orb 3°).
  const ANGLES: { type: keyof typeof ASPECT_VERB; angle: number }[] = [
    { type: "conjunction", angle: 0 }, { type: "sextile", angle: 60 }, { type: "square", angle: 90 },
    { type: "trine", angle: 120 }, { type: "opposition", angle: 180 },
  ];
  const found: (Omen & { orb: number })[] = [];
  for (const tp of TRANSIT_PLANETS) {
    for (const target of targets) {
      for (const A of ANGLES) {
        let first: number | null = null, last: number | null = null, minOrb = 99;
        for (let jd = cycleStart; jd <= cycleEnd; jd += 1) {
          const orb = Math.abs(angDiff(planetLongitude(tp, jd), target.lon) - A.angle);
          if (orb <= 3) {
            if (first == null) first = jd;
            last = jd;
            minOrb = Math.min(minOrb, orb);
          }
        }
        if (first != null && last != null) {
          const whole = first <= cycleStart + 1 && last >= cycleEnd - 1;
          const tone: Tone = A.type === "conjunction" ? "conjunction" : A.type === "square" || A.type === "opposition" ? "hard" : "harmonious";
          found.push({
            glyphs: `${PLANET_GLYPH[tp]} ${ASPECT_GLYPH[A.type]} ${PLANET_GLYPH[target.key]}`,
            title: `${cap(tp)} ${ASPECT_VERB[A.type]} your ${target.label}`,
            when: whole ? "all this moon" : `${fmtDay(first)} to ${fmtDay(last)}`,
            body: TRANSIT_TEXT[tp][tone],
            orb: minOrb,
          });
        }
      }
    }
  }
  found.sort((a, b) => a.orb - b.orb);
  for (const f of found.slice(0, 3)) entries.push({ glyphs: f.glyphs, title: f.title, when: f.when, body: f.body });

  entries.push({
    glyphs: "🌕",
    title: `Full moon · ${fmSign.symbol} ${fmSign.name} · your ${ordinal(fmHouse)} house`,
    when: fmtDay(fullJd),
    body: `${FULL_MOON_VERB} ${HOUSE_DOMAIN[fmHouse]}: what was seeded there comes to light.`,
  });

  // Mercury retrograde overlapping the cycle. Scan a little past both ends so
  // the warning carries the retrograde's TRUE dates, not the cycle-clipped ones.
  let warning: string | null = null;
  let retroFirst: number | null = null, retroLast: number | null = null, touchesCycle = false;
  for (let jd = cycleStart - 12; jd <= cycleEnd + 25; jd += 1) {
    const moving = rev(planetLongitude("mercury", jd + 0.5) - planetLongitude("mercury", jd - 0.5));
    const retro = moving > 180; // longitude decreasing
    if (retro) {
      if (retroFirst == null || (retroLast != null && jd - retroLast > 3)) {
        // a new retrograde interval; keep only one that overlaps the cycle
        if (touchesCycle) break;
        retroFirst = jd;
      }
      retroLast = jd;
      if (jd >= cycleStart && jd <= cycleEnd) touchesCycle = true;
    }
  }
  if (touchesCycle && retroFirst != null && retroLast != null) {
    warning = `Mercury retrograde, ${fmtDay(retroFirst)} to ${fmtDay(retroLast)}: reread the label before you buy.`;
  }

  // --- The year, glimpsed -------------------------------------------------
  const now = new Date(nowMs);
  const yearNum = now.getFullYear();
  const year: Omen[] = [];

  // Personal year (numerology): birth month + birth day + current year.
  const [, bm, bd] = natal.dateStr.split("-").map(Number);
  const reduce = (x: number) => { while (x > 9) x = String(x).split("").reduce((s, c) => s + Number(c), 0); return x; };
  const py = reduce(reduce(bm) + reduce(bd) + reduce(yearNum));
  year.push({ glyphs: String(py), title: "Personal year", when: String(yearNum), body: PERSONAL_YEAR[py] });

  // The Chinese year, read against their own animal.
  const yi = yearAnimalInfo(yearNum);
  const own = shengxiao(natal.dateStr);
  let cnBody: string;
  if (own && own.name === yi.animal.name) {
    cnBody = `Your own year: guard the flame, do not gallop at every invitation. Keep something in reserve.`;
  } else if (own && (((yi.index - ANIMAL_INDEX[own.name]) % 12) + 12) % 12 === 6) {
    cnBody = `The ${yi.animal.name} clashes with your ${own.name}: a year for cunning, not confrontation. Move around, not through.`;
  } else {
    cnBody = `The ${yi.element} ${yi.animal.name} sets the pace${own ? ` for your ${own.name}` : ""}: match its stride where it serves you, and let it pass where it does not.`;
  }
  year.push({ glyphs: yi.animal.symbol, title: `Year of the ${yi.element} ${yi.animal.name}`, when: yi.fromLabel, body: cnBody });

  // Outer-planet house ingresses during the calendar year.
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  for (const tp of TRANSIT_PLANETS) {
    let prevHouse: number | null = null;
    for (let m = 0; m < 12; m++) {
      const jd = julianDay(`${yearNum}-${String(m + 1).padStart(2, "0")}-01`, "12:00", natal.tz || DEFAULT_TZ)!;
      const h = houseOf(planetLongitude(tp, jd), chart.asc);
      if (prevHouse != null && h != null && h !== prevHouse) {
        year.push({
          glyphs: `${PLANET_GLYPH[tp]} → ${ordinal(h)}`,
          title: `${cap(tp)} enters your ${ordinal(h)} house`,
          when: MONTHS[m],
          body: `Its weight moves onto ${HOUSE_DOMAIN[h]}. ${TRANSIT_TEXT[tp].conjunction.split(". ")[1] || ""}`.trim(),
        });
        break; // one ingress per planet is plenty for a glimpse
      }
      if (h != null) prevHouse = h;
    }
  }

  return {
    moonLabel: `${fmtDay(cycleStart)} to ${fmtDay(cycleEnd)}`,
    entries,
    warning,
    yearLabel: String(yearNum),
    year,
  };
}

const ANIMAL_INDEX: Record<string, number> = {
  Rat: 0, Ox: 1, Tiger: 2, Rabbit: 3, Dragon: 4, Snake: 5,
  Horse: 6, Goat: 7, Monkey: 8, Rooster: 9, Dog: 10, Pig: 11,
};
