// The Foretelling engine. Everything is computed: the current lunar cycle
// (new moon to new moon), where its new and full moons land in the member's
// houses, which slow planets make real aspects to their natal Sun, Moon, and
// Ascendant (with true dates), Mercury retrogrades, the year's house
// ingresses, the numerology personal year, and the Chinese year. The words
// are written once, by hand, below, chosen by the alignment, never at random.

import { sunLongitude, moonLongitude, julianDay, ZODIAC, shengxiao, yearAnimalInfo, DEFAULT_TZ } from "./astrology";
import { fullChart, planetLongitude, houseOf, angDiff, ordinal, HOUSE_DOMAIN, type Chart } from "./natal";

const rev = (x: number) => x - Math.floor(x / 360) * 360;
const jdOfMs = (ms: number) => ms / 86400000 + 2440587.5;
const msOfJd = (jd: number) => (jd - 2440587.5) * 86400000;
const fmtDay = (jd: number) => new Date(msOfJd(jd)).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

export interface Omen { glyphs: string; title: string; when: string; body: string; plain?: string }
export interface Foretelling {
  moonLabel: string; // "14 July to 11 August"
  entries: Omen[];
  dayLabel: string;
  day: Omen[];
  warning: string | null;
  warningPlain: string | null;
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
// The same omens in plain speech, for the translate toggle.
const TRANSIT_PLAIN: Record<string, Record<Tone, string>> = {
  jupiter: {
    conjunction: "Jupiter (luck and growth) sits right on a key point of your chart. Things tend to go your way this month: a good window for saying yes, hosting, and taking opportunities.",
    harmonious: "Jupiter (luck and growth) is at an easy angle to your chart: mild good fortune. Opportunities come with less effort than usual.",
    hard: "Jupiter (luck and growth) is at a tense angle: the risk this month is overdoing it, in spending, promising, or indulging. Enjoy yourself, but set the limit before you start.",
  },
  saturn: {
    conjunction: "Saturn (structure and discipline) sits on a key point of your chart. Careful work done now tends to last; shortcuts tend to get exposed.",
    harmonious: "Saturn (structure and discipline) is at an easy angle: steady, unglamorous progress. Past diligence quietly pays off.",
    hard: "Saturn (structure and discipline) is at a tense angle: things feel slower and heavier than usual. Be patient and do not rush decisions.",
  },
  uranus: {
    conjunction: "Uranus (surprise and change) sits on a key point of your chart: expect plans to change suddenly. Stay flexible.",
    harmonious: "Uranus (surprise and change) is at an easy angle: a good month to try something new or break a routine on purpose.",
    hard: "Uranus (surprise and change) is at a tense angle: surprises may be disruptive. Avoid locking in big commitments this month if you can.",
  },
  neptune: {
    conjunction: "Neptune (imagination and fog) sits on a key point of your chart: intuition is strong but facts get blurry. Great for creativity, risky for paperwork.",
    harmonious: "Neptune (imagination and fog) is at an easy angle: your gut readings are unusually reliable this month.",
    hard: "Neptune (imagination and fog) is at a tense angle: it is easy to be misled, or to fool yourself. Double-check details, offers, and promises.",
  },
  pluto: {
    conjunction: "Pluto (deep change) sits on a key point of your chart: something may end or transform this month. Letting it happen clears space for what is next.",
    harmonious: "Pluto (deep change) is at an easy angle: quiet influence and focus. One decisive move goes a long way.",
    hard: "Pluto (deep change) is at a tense angle: old issues or old faces may resurface. Deal with them once, briefly, and move on.",
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

// --- The day's passages ---------------------------------------------------
// The Moon crosses a house in about two and a half days; this line anchors
// every daily reading. Both tongues, hand-written.
const MOON_HOUSE: Record<number, { body: string; plain: string }> = {
  1: { body: "The moon crosses your rising: feelings wear no cloak today. Lead with them.",
       plain: "The Moon is in your 1st house today: emotions sit close to the surface and others can read them. A good day to be direct about what you want." },
  2: { body: "The moon counts your coins and your appetite. Want less, taste more.",
       plain: "The Moon is in your 2nd house today: money and comfort are on your mind. Small treats satisfy more than big purchases." },
  3: { body: "The moon walks the short roads: letters, kin, quick words. Send the message.",
       plain: "The Moon is in your 3rd house today: a chatty, busy day of messages and errands. Good for the conversation you have been postponing." },
  4: { body: "The moon comes home. Tend the hearth before the world.",
       plain: "The Moon is in your 4th house today: home and family pull at you. A night in serves you better than a night out." },
  5: { body: "The moon plays. Pour something you cannot justify.",
       plain: "The Moon is in your 5th house today: a day for fun, romance, and creativity. Do something purely because you enjoy it." },
  6: { body: "The moon takes up the small tools: habit, craft, service. Sharpen one thing.",
       plain: "The Moon is in your 6th house today: routines, chores, and health are favoured. Put one corner of your life in order." },
  7: { body: "The moon sits across the table: partners and rivals ask their share.",
       plain: "The Moon is in your 7th house today: relationships take centre stage, in cooperation or friction. Meet people halfway." },
  8: { body: "The moon descends to the shared and the hidden. Settle a debt, keep a secret.",
       plain: "The Moon is in your 8th house today: a more intense, private day of shared money, deep talks, and things unsaid. Handle one of them honestly." },
  9: { body: "The moon looks to far places. Study something, or book the road.",
       plain: "The Moon is in your 9th house today: restlessness and curiosity rise. A good day to learn something, plan travel, or look at the bigger picture." },
  10: { body: "The moon climbs to your name and standing. Be seen doing the work.",
        plain: "The Moon is in your 10th house today: career and reputation are lit. Effort shows today; so do mistakes." },
  11: { body: "The moon joins the many: friends, allies, the long table.",
        plain: "The Moon is in your 11th house today: a social day. Friends and groups bring more than solo effort; accept the invitation." },
  12: { body: "The moon withdraws behind the veil. Rest is not retreat.",
        plain: "The Moon is in your 12th house today: a low-battery, inward day. Rest without guilt and skip the crowds you do not need." },
};

// Fast planets making an exact aspect to the natal chart on the day itself.
const DAY_TEXT: Record<string, Record<Tone, { body: string; plain: string }>> = {
  mercury: {
    conjunction: { body: "The messenger stands upon you: the word finds you today. Write it down before it leaves.",
      plain: "Mercury (communication) sits exactly on a key point of your chart today: conversations and ideas flow. A good day for the important talk or email." },
    harmonious: { body: "The messenger leans kindly: quick words land well today.",
      plain: "Mercury (communication) is at an easy angle today: talking, asking, and negotiating all run smoothly." },
    hard: { body: "The messenger crosses you: words tangle today. Say less, twice.",
      plain: "Mercury (communication) is at a tense angle today: misunderstandings come easily. Keep messages short and reread before sending." },
  },
  venus: {
    conjunction: { body: "The lady stands upon you: charm without effort. Pour the good bottle.",
      plain: "Venus (affection and pleasure) sits exactly on a key point of your chart today: a warm day for love, friends, and beauty. Treat yourself, and someone else." },
    harmonious: { body: "The lady leans in: the table is friendly today.",
      plain: "Venus (affection and pleasure) is at an easy angle today: social things go well. A good day for a date, a gift, or making peace." },
    hard: { body: "The lady crosses you: desire argues with sense. Let the purse win.",
      plain: "Venus (affection and pleasure) is at a tense angle today: cravings and spending pull hard. Enjoy modestly; do not buy the whole cellar." },
  },
  mars: {
    conjunction: { body: "The red one stands upon you: the blood is up. Spend it on work, not war.",
      plain: "Mars (drive and temper) sits exactly on a key point of your chart today: energy runs high. Burn it on something physical or productive before it turns into irritation." },
    harmonious: { body: "The red one leans with you: strike while it is hot.",
      plain: "Mars (drive and temper) is at an easy angle today: energy and courage are up. A good day to start, push, or train." },
    hard: { body: "The red one crosses you: short fuse, sharp tongue. Count three before either.",
      plain: "Mars (drive and temper) is at a tense angle today: friction and impatience come quickly. Do not pick the fight; find a better outlet." },
  },
};

const PERSONAL_YEAR_PLAIN: Record<number, string> = {
  1: "In numerology this is a start year for you: the best time to launch the project or change you keep postponing.",
  2: "A partnership year: progress comes through cooperation and patience rather than pushing.",
  3: "An expression year: visibility, socialising, and speaking up work in your favour.",
  4: "A groundwork year: routines, finances, and unglamorous building. Invest now, benefit later.",
  5: "A change year: expect movement in travel, roles, or circumstances. Ride it rather than resist it.",
  6: "A home year: family, relationships, and duties close to home take priority and reward the attention.",
  7: "A quiet year: learning, reflection, and depth beat noise. A good year to study and to save.",
  8: "A results year: earlier efforts pay off. A good year to ask for what your work is worth.",
  9: "A closing year: finish things, let go, and clear the deck so the next cycle can start clean.",
};

// --- The reading ---------------------------------------------------------
const TRANSIT_PLANETS = ["jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
const PLANET_GLYPH: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇", asc: "ASC",
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
    plain: `A new moon is a monthly fresh start. This one lands in the part of your life about ${HOUSE_DOMAIN[nmHouse]}: a good moment to begin something in that area.`,
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
            plain: TRANSIT_PLAIN[tp][tone],
            orb: minOrb,
          });
        }
      }
    }
  }
  found.sort((a, b) => a.orb - b.orb);
  for (const f of found.slice(0, 3)) entries.push({ glyphs: f.glyphs, title: f.title, when: f.when, body: f.body, plain: f.plain });

  entries.push({
    glyphs: "🌕",
    title: `Full moon · ${fmSign.symbol} ${fmSign.name} · your ${ordinal(fmHouse)} house`,
    when: fmtDay(fullJd),
    body: `${FULL_MOON_VERB} ${HOUSE_DOMAIN[fmHouse]}: what was seeded there comes to light.`,
    plain: `A full moon is a monthly peak. This one lights up the part of your life about ${HOUSE_DOMAIN[fmHouse]}: something in that area comes to a head, or finally shows results.`,
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
  let warningPlain: string | null = null;
  if (touchesCycle && retroFirst != null && retroLast != null) {
    warning = `Mercury retrograde, ${fmtDay(retroFirst)} to ${fmtDay(retroLast)}: reread the label before you buy.`;
    warningPlain = `Mercury retrograde, ${fmtDay(retroFirst)} to ${fmtDay(retroLast)}: communication and logistics get glitchy. Double-check bookings, messages, and purchases, and expect small delays.`;
  }

  // --- The year, glimpsed -------------------------------------------------
  const now = new Date(nowMs);
  const yearNum = now.getFullYear();
  const year: Omen[] = [];

  // Personal year (numerology): birth month + birth day + current year.
  const [, bm, bd] = natal.dateStr.split("-").map(Number);
  const reduce = (x: number) => { while (x > 9) x = String(x).split("").reduce((s, c) => s + Number(c), 0); return x; };
  const py = reduce(reduce(bm) + reduce(bd) + reduce(yearNum));
  year.push({ glyphs: String(py), title: "Personal year", when: String(yearNum), body: PERSONAL_YEAR[py], plain: PERSONAL_YEAR_PLAIN[py] });

  // The Chinese year, read against their own animal.
  const yi = yearAnimalInfo(yearNum);
  const own = shengxiao(natal.dateStr);
  let cnBody: string;
  let cnPlain: string;
  if (own && own.name === yi.animal.name) {
    cnBody = `Your own year: guard the flame, do not gallop at every invitation. Keep something in reserve.`;
    cnPlain = `This is your own zodiac year, which Chinese tradition treats as an unstable one: keep reserves, avoid big gambles, and do not overcommit.`;
  } else if (own && (((yi.index - ANIMAL_INDEX[own.name]) % 12) + 12) % 12 === 6) {
    cnBody = `The ${yi.animal.name} clashes with your ${own.name}: a year for cunning, not confrontation. Move around, not through.`;
    cnPlain = `Your sign (${own.name}) sits opposite this year's sign (${yi.animal.name}), a traditional clash: expect more friction than usual, and go around obstacles rather than through them.`;
  } else {
    cnBody = `The ${yi.element} ${yi.animal.name} sets the pace${own ? ` for your ${own.name}` : ""}: match its stride where it serves you, and let it pass where it does not.`;
    cnPlain = `This is the year of the ${yi.element} ${yi.animal.name}. It has no special clash with your sign${own ? ` (${own.name})` : ""}: use its momentum where helpful, and do not force the rest.`;
  }
  year.push({ glyphs: yi.animal.symbol, title: `Year of the ${yi.element} ${yi.animal.name}`, when: yi.fromLabel, body: cnBody, plain: cnPlain });

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
          plain: `${cap(tp)}'s slow influence shifts into the part of your life about ${HOUSE_DOMAIN[h]}, and stays there for months or longer: expect a gradual change of focus in that area.`,
        });
        break; // one ingress per planet is plenty for a glimpse
      }
      if (h != null) prevHouse = h;
    }
  }

  // --- This day ------------------------------------------------------------
  const day: Omen[] = [];
  const dMoonLon = moonLongitude(nowJd);
  const dSign = ZODIAC[Math.floor(dMoonLon / 30) % 12];
  const dHouse = houseOf(dMoonLon, chart.asc)!;
  day.push({
    glyphs: "☽",
    title: `Moon in ${dSign.symbol} ${dSign.name} · your ${ordinal(dHouse)} house`,
    when: "today",
    body: MOON_HOUSE[dHouse].body,
    plain: MOON_HOUSE[dHouse].plain,
  });
  // Fast planets exactly aspecting the natal chart today (tight 2° orb).
  const dayHits: (Omen & { orb: number })[] = [];
  for (const fp of ["mercury", "venus", "mars"] as const) {
    const lon = planetLongitude(fp, nowJd);
    for (const target of targets) {
      for (const A of ANGLES) {
        const orb = Math.abs(angDiff(lon, target.lon) - A.angle);
        if (orb <= 2) {
          const tone: Tone = A.type === "conjunction" ? "conjunction" : A.type === "square" || A.type === "opposition" ? "hard" : "harmonious";
          dayHits.push({
            glyphs: `${PLANET_GLYPH[fp]} ${ASPECT_GLYPH[A.type]} ${PLANET_GLYPH[target.key]}`,
            title: `${cap(fp)} ${ASPECT_VERB[A.type]} your ${target.label}`,
            when: "exact today",
            body: DAY_TEXT[fp][tone].body,
            plain: DAY_TEXT[fp][tone].plain,
            orb,
          });
        }
      }
    }
  }
  dayHits.sort((a, b) => a.orb - b.orb);
  for (const h of dayHits.slice(0, 2)) day.push({ glyphs: h.glyphs, title: h.title, when: h.when, body: h.body, plain: h.plain });
  // Mercury walking backward today gets its own quiet line.
  const movingToday = rev(planetLongitude("mercury", nowJd + 0.5) - planetLongitude("mercury", nowJd - 0.5));
  if (movingToday > 180) {
    day.push({
      glyphs: "☿",
      title: "Mercury retrograde",
      when: "today",
      body: "The messenger walks backward: reread the label, resend nothing in anger.",
      plain: "Mercury is retrograde today: double-check plans, messages, and purchases, and allow for small delays.",
    });
  }

  return {
    moonLabel: `${fmtDay(cycleStart)} to ${fmtDay(cycleEnd)}`,
    entries,
    warning,
    warningPlain,
    yearLabel: String(yearNum),
    year,
    dayLabel: new Date(nowMs).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    day,
  };
}

const ANIMAL_INDEX: Record<string, number> = {
  Rat: 0, Ox: 1, Tiger: 2, Rabbit: 3, Dragon: 4, Snake: 5,
  Horse: 6, Goat: 7, Monkey: 8, Rooster: 9, Dog: 10, Pig: 11,
};
