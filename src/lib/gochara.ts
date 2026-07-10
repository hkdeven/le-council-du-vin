// The turning sky: everything time-based in the Vedic reckoning, computed
// live from the same engines as the charts. No astrology API is consulted;
// per doctrine, every value here is in-house arithmetic on exact positions.
//
// Conventions, per the audited spec:
//  - Panchang: tithi and karana from the Moon-Sun difference (the ayanamsa
//    cancels); the YOGA must sum SIDEREAL longitudes (it does not cancel).
//    Boundary times are not computed; the almanac names the instant only.
//  - Gochara: each graha's live sidereal sign counted from the natal Moon,
//    judged by the classical benefic-house lists (Brihat Samhita family).
//    Vedha (the classical obstruction rule) is deliberately omitted; per the
//    Keiser, the page copy does not name the omission.
//  - The iron passage: Sade Sati = Saturn in the 12th/1st/2nd from the natal
//    Moon; Ashtama Shani = the 8th. Entry/exit dates from a sidereal
//    sign-entry scan of Saturn's true motion (retrograde wobbles included).

import { fullChart } from "./natal";
import { julianDay, sunLongitude, moonLongitude } from "./astrology";
import { ayanamsaLahiri, meanRahu, nakshatraOf, RASHIS, NAKSHATRAS, type VedicChart, type DashaLord } from "./vedic";
import { feelingOf, RASHI_LORDS, sanskritLord } from "./kundli";

const rev = (x: number) => ((x % 360) + 360) % 360;
const DAY_MS = 86400000;

const dateStrOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── live sidereal positions ─────────────────────────────────────────────────
export function sidLonNow(key: string, ms: number): number | null {
  const jd = julianDay(dateStrOf(ms), "12:00");
  if (jd == null) return null;
  const aya = ayanamsaLahiri(jd);
  if (key === "sun") return rev(sunLongitude(jd) - aya);
  if (key === "moon") return rev(moonLongitude(jd) - aya);
  if (key === "rahu") return rev(meanRahu(jd) - aya);
  if (key === "ketu") return rev(meanRahu(jd) + 180 - aya);
  const c = fullChart(dateStrOf(ms), "12:00", undefined, 0, 0);
  const p = c?.planets.find((x) => x.key === key);
  return p ? rev(p.lon - aya) : null;
}

// ── the panchang ────────────────────────────────────────────────────────────
const TITHI_NAMES = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi"];
const YOGA_NAMES = ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarman", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"];
const KARANA_MOVABLE = ["Bava", "Balava", "Kaulava", "Taitila", "Garija", "Vanija", "Vishti"];
export const DAY_LORDS: DashaLord[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

export interface Panchang {
  tithi: string; // "Krishna Ekadashi"
  tithiNote: string | null; // a whisper for the marked days only
  dayLord: string; // "Shukra (Friday)"
  nakshatra: string;
  yoga: string;
  karana: string;
}

export function panchangOf(ms: number): Panchang | null {
  const jd = julianDay(dateStrOf(ms), "12:00");
  if (jd == null) return null;
  const aya = ayanamsaLahiri(jd);
  const sunSid = rev(sunLongitude(jd) - aya);
  const moonSid = rev(moonLongitude(jd) - aya);
  const elong = rev(moonSid - sunSid);

  const tithiNum = Math.floor(elong / 12) + 1; // 1..30
  const paksha = tithiNum <= 15 ? "Shukla" : "Krishna";
  const tithiName = tithiNum === 15 ? "Purnima" : tithiNum === 30 ? "Amavasya" : TITHI_NAMES[(tithiNum - 1) % 15];
  const tithi = tithiName === "Purnima" || tithiName === "Amavasya" ? tithiName : `${paksha} ${tithiName}`;
  const tithiNote =
    tithiName === "Ekadashi" ? "Ekadashi, the eleventh of the moon: the tradition's day of restraint. A fitting night to pour lightly." :
    tithiName === "Purnima" ? "Purnima, the full moon: the month's peak; what was begun now shows itself." :
    tithiName === "Amavasya" ? "Amavasya, the dark moon: the month's quiet root; rest, remember, begin nothing loud." :
    null;

  // The yoga sums SIDEREAL longitudes, per the audited classical rule.
  const yoga = YOGA_NAMES[Math.floor(rev(sunSid + moonSid) / (360 / 27)) % 27];

  const kIdx = Math.floor(elong / 6); // 0..59
  const karana = kIdx === 0 ? "Kimstughna" : kIdx >= 57 ? ["Shakuni", "Chatushpada", "Naga"][kIdx - 57] : KARANA_MOVABLE[(kIdx - 1) % 7];

  const lord = DAY_LORDS[new Date(ms).getDay()];
  const weekday = new Date(ms).toLocaleDateString("en-GB", { weekday: "long" });

  return {
    tithi, tithiNote,
    dayLord: `${sanskritLord(lord)} (${weekday})`,
    nakshatra: NAKSHATRAS[nakshatraOf(moonSid).nakshatra],
    yoga, karana,
  };
}

// ── the day's star: tara bala + Chandra bala ────────────────────────────────
export const TARA_NAMES = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyak", "Sadhana", "Naidhana", "Mitra", "Parama Mitra"];

const TARA_TEXT: ((v: { obj: string; pos: string; subj: string }) => string)[] = [
  (v) => `The Moon walks ${v.pos} own star's count returned to one. A Janma day is tender rather than hostile: good for rest, kin, and finishing, poor for launching. Begin nothing new; tend what already grows.`,
  (v) => `A Sampat day, the star of wealth: what ${v.subj} put ${v.pos} hand to tends to prosper. Ask, sign, and plant.`,
  (v) => `A Vipat day, the star of hazard: the ground is loose underfoot. Postpone what can wait, and double-knot what cannot.`,
  (v) => `A Kshema day, the star of wellbeing: a kind, steady sky. Good for mending, settling, and the quiet middle of things.`,
  (v) => `A Pratyak day, the star of obstacles: the current runs against ${v.obj}. Push nothing; what resists today will yield another day.`,
  (v) => `A Sadhana day, the star of accomplishment: effort lands. The day favours finishing what discipline started.`,
  (v) => `A Naidhana day, the sternest star: keep the stakes low and the words gentle. A day for routine, not risk.`,
  (v) => `A Mitra day, the friendly star: company is fortunate and doors open through others. Accept the invitation.`,
  (v) => `A Parama Mitra day, the best of friends: the sky is openly on ${v.pos} side. A fine day for the thing ${v.subj} have been waiting to begin.`,
];

const CHANDRA_BALA: ((v: { obj: string; pos: string; subj: string }) => string)[] = [
  (v) => `The Moon crosses ${v.pos} own sign: feeling runs strong and close to the skin; trust the instinct, watch the mood.`,
  (v) => `The Moon stands second from ${v.pos} own: a day for the stores and the table; comfort earns.`,
  (v) => `The Moon stands third from ${v.pos} own: courage comes easily; a good day to act with ${v.pos} hands.`,
  (v) => `The Moon stands fourth from ${v.pos} own: the tide sits low at home; keep the day soft.`,
  (v) => `The Moon stands fifth from ${v.pos} own: play, children, and making; the heart is inventive today.`,
  (v) => `The Moon stands sixth from ${v.pos} own: a clearing day; chores, debts, and small rivals fall easily.`,
  (v) => `The Moon stands seventh from ${v.pos} own: company over solitude; the other carries the day's luck.`,
  (v) => `The Moon stands eighth from ${v.pos} own: the undertow runs deep today; go carefully and say less.`,
  (v) => `The Moon stands ninth from ${v.pos} own: a day when belief carries further than effort, and far matters go better than near ones.`,
  (v) => `The Moon stands tenth from ${v.pos} own: the work shines; be seen doing it.`,
  (v) => `The Moon stands eleventh from ${v.pos} own: gains and friends; harvest what is ripe.`,
  (v) => `The Moon stands twelfth from ${v.pos} own: the inner rooms call; spend the day quietly and it repays ${v.obj}.`,
];

export interface DayStar {
  tara: string; // e.g. "Sampat tara"
  taraGoodDay: boolean | null; // null = mixed (Janma)
  passage: string;
  moonLine: string;
}

export function dayStarFor(natal: VedicChart, ms: number, v: { obj: string; pos: string; subj: string }): DayStar | null {
  const moonSid = sidLonNow("moon", ms);
  if (moonSid == null) return null;
  const dayNk = nakshatraOf(moonSid).nakshatra;
  const count = (((dayNk - natal.moonNakshatra + 27) % 27) % 9) + 1;
  const natalMoonRashi = natal.planets.find((p) => p.key === "moon")!.rashi;
  const house = ((Math.floor(moonSid / 30) - natalMoonRashi + 12) % 12); // 0..11
  return {
    tara: `${TARA_NAMES[count - 1]} tara`,
    taraGoodDay: count === 1 ? null : count !== 3 && count !== 5 && count !== 7,
    passage: TARA_TEXT[count - 1](v),
    moonLine: CHANDRA_BALA[house](v),
  };
}

// ── gochara: the wandering sky ──────────────────────────────────────────────
// Classical benefic houses from the natal Moon (Brihat Samhita family lists,
// audit-verified). Everything else reads unfavourable-or-neutral; we speak
// plainly per (graha, house) below.
const BENEFIC: Record<string, number[]> = {
  sun: [3, 6, 10, 11],
  moon: [1, 3, 6, 7, 10, 11],
  mars: [3, 6, 11],
  mercury: [2, 4, 6, 8, 10, 11],
  jupiter: [2, 5, 7, 9, 11],
  venus: [1, 2, 3, 4, 5, 8, 9, 11, 12],
  saturn: [3, 6, 11],
};

// One short ledger line per (graha, house-from-Moon), 1-indexed by house.
const GOCHARA_LINE: Record<string, string[]> = {
  sun: ["over your Moon · the light sits heavy", "2nd · guarded stores", "3rd · courage rewarded", "4th · unrest at the root", "5th · proud but prickly", "6th · rivals scatter", "7th · friction with the other", "8th · strain in the deep", "9th · belief tested", "10th · the work shines", "11th · gains and allies", "12th · spend of strength"],
  moon: ["over your Moon · feeling doubled", "2nd · a careful tongue", "3rd · light feet", "4th · low tide at home", "5th · tender heart", "6th · small worries cleared", "7th · warm company", "8th · the undertow", "9th · far thoughts", "10th · seen and steady", "11th · easy gains", "12th · the inner room"],
  mars: ["over your Moon · heat on the skin", "2nd · sharp words cost", "3rd · bold and lucky", "4th · sparks at the hearth", "5th · rash play", "6th · rivals routed", "7th · quarrels near the bond", "8th · hidden heat", "9th · zeal outruns wisdom", "10th · heavy hands at work", "11th · hard-won gains", "12th · leaks of energy"],
  mercury: ["over your Moon · a restless mind", "2nd · profitable words", "3rd · scattered errands", "4th · good counsel at home", "5th · clever play", "6th · accounts settled", "7th · talks that bind", "8th · secrets surface kindly", "9th · study rewarded", "10th · profitable work", "11th · profitable talk", "12th · a tired mind"],
  jupiter: ["over your Moon · the great blessing", "2nd · the stores grow", "3rd · dull fortune", "4th · uneasy comfort", "5th · fortune through the young", "6th · generosity taxed", "7th · a blessed bond", "8th · gifts with strings", "9th · fortune from above", "10th · honours delayed", "11th · the open harvest", "12th · generous spending"],
  venus: ["over your Moon · sweetens the month", "2nd · a rich table", "3rd · charmed errands", "4th · a soft home", "5th · romance and play", "6th · pleasures thin", "7th · love favoured", "8th · deep sweetness", "9th · beauty in far places", "10th · art meets work coldly", "11th · sweet gains", "12th · pleasure in private"],
  saturn: ["over your Moon · the peak of the trial", "2nd · the trial's long tail", "3rd · patient strength", "4th · weight on the hearth", "5th · joy postponed", "6th · duty defeats rivals", "7th · a tested bond", "8th · the eighth passage", "9th · faith ground slowly", "10th · heavy honours", "11th · slow sure gains", "12th · the trial begins"],
};

// What each wandering graha governs, for the ledger's tooltips.
export const GRAHA_TIP: Record<string, string> = {
  sun: "Surya, the Sun: vitality, standing, and authority. Its month colours how visible and how steady you feel.",
  moon: "Chandra, the Moon: feeling and the daily tide. It crosses a sign in about two and a quarter days.",
  mars: "Mangala, Mars: drive, heat, and contest. Its standing tells where effort flows or scrapes this month.",
  mercury: "Budha, Mercury: words, trade, and wit. Its standing colours talks, deals, and paperwork.",
  jupiter: "Guru, Jupiter: growth, fortune, and counsel. The slowest blessing; a sign a year, roughly.",
  venus: "Shukra, Venus: love, taste, comfort, and coin. The sweetener of whatever house it walks.",
  saturn: "Shani, Saturn: time, duty, and weight. Two and a half years a sign; the slow teacher.",
};

export interface GocharaRow {
  key: string;
  lord: string; // Sanskrit
  house: number; // from natal Moon, 1..12
  line: string;
  favourable: boolean;
}

export function gocharaFor(natal: VedicChart, ms: number): GocharaRow[] {
  const natalMoonRashi = natal.planets.find((p) => p.key === "moon")!.rashi;
  const KEYS: [string, DashaLord][] = [["venus", "Venus"], ["sun", "Sun"], ["mercury", "Mercury"], ["moon", "Moon"], ["mars", "Mars"], ["jupiter", "Jupiter"], ["saturn", "Saturn"]];
  const rows: GocharaRow[] = [];
  for (const [key, lord] of KEYS) {
    if (key === "moon") continue; // the Moon belongs to the day view
    const lon = sidLonNow(key, ms);
    if (lon == null) continue;
    const house = ((Math.floor(lon / 30) - natalMoonRashi + 12) % 12) + 1;
    rows.push({
      key,
      lord: sanskritLord(lord),
      house,
      line: GOCHARA_LINE[key][house - 1],
      favourable: BENEFIC[key].includes(house),
    });
  }
  // Favourable first, then by classical weight (slow planets last so Shani
  // lands beside the iron passage below).
  rows.sort((a, b) => Number(b.favourable) - Number(a.favourable));
  return rows;
}

// ── sign entries: the year's turnings and the iron passage ──────────────────
function rashiAt(key: string, ms: number): number {
  const lon = sidLonNow(key, ms);
  return lon == null ? -1 : Math.floor(lon / 30);
}

// Scan a body's sidereal sign entries between two instants (5-day steps,
// refined to the day by bisection).
export function signEntries(key: string, fromMs: number, toMs: number): { ms: number; from: number; to: number }[] {
  const out: { ms: number; from: number; to: number }[] = [];
  let prev = rashiAt(key, fromMs);
  for (let ms = fromMs + 5 * DAY_MS; ms <= toMs; ms += 5 * DAY_MS) {
    const cur = rashiAt(key, ms);
    if (cur !== prev && cur >= 0) {
      let lo = ms - 5 * DAY_MS, hi = ms;
      while (hi - lo > DAY_MS) {
        const mid = lo + Math.floor((hi - lo) / 2 / DAY_MS) * DAY_MS;
        if (rashiAt(key, mid) === prev) lo = mid; else hi = mid;
      }
      out.push({ ms: hi, from: prev, to: rashiAt(key, hi) });
      prev = rashiAt(key, hi);
    }
  }
  return out;
}

export interface Turning { ms: number; label: string; text: string }

const TURNING_TEXT: Record<string, (house: number, houseName: string) => string> = {
  jupiter: (h) =>
    h === 1 ? "Guru crosses onto your Moon: the great blessing settles over you. Growth, favour, and honest luck." :
    [2, 5, 7, 9, 11].includes(h) ? `Guru turns into your ${ord(h)} from the Moon: a fortunate stretch begins there; say yes more often.` :
    `Guru turns into your ${ord(h)} from the Moon: growth goes quiet for a season; tend what is already planted.`,
  saturn: (h) =>
    h === 12 ? "Shani steps into the twelfth from your Moon: the Sade Sati begins its rising phase. Slow down on purpose; the trial rewards the deliberate." :
    h === 1 ? "Shani crosses onto your Moon: the peak of the Sade Sati. The heaviest and the most clarifying years of the passage." :
    h === 2 ? "Shani steps into the second from your Moon: the Sade Sati's setting phase; the trial loosens as it teaches its last lessons." :
    h === 3 ? "Shani turns into your third from the Moon: iron in the spine; a strong, patient stretch." :
    h === 8 ? "Shani enters the eighth from your Moon: the Ashtama passage; old accounts surface to be settled." :
    `Shani turns into your ${ord(h)} from the Moon: the weight shifts its seat; adjust the load.`,
  rahu: (h) =>
    h === 6 ? "Rahu slides into your 6th: the hunger turns on rivals and habits. A good axis for winning; watch what you pick fights with." :
    h === 3 || h === 11 ? `Rahu slides into your ${ord(h)}: appetite finds a helpful channel; ride it, do not let it steer.` :
    `Rahu slides into your ${ord(h)}: the hunger changes rooms; notice what ${"you"} suddenly want more of.`,
};
function ord(n: number): string {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}

export function yearTurnings(natal: VedicChart, fromMs: number): Turning[] {
  const natalMoonRashi = natal.planets.find((p) => p.key === "moon")!.rashi;
  const out: Turning[] = [];
  for (const key of ["jupiter", "saturn", "rahu"]) {
    for (const e of signEntries(key, fromMs, fromMs + 366 * DAY_MS)) {
      const house = ((e.to - natalMoonRashi + 12) % 12) + 1;
      out.push({
        ms: e.ms,
        label: new Date(e.ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase(),
        text: TURNING_TEXT[key](house, RASHIS[e.to]),
      });
    }
  }
  out.sort((a, b) => a.ms - b.ms);
  // A retrograde wobble can re-announce the same crossing; keep first mentions.
  const seen = new Set<string>();
  return out.filter((t) => { if (seen.has(t.text)) return false; seen.add(t.text); return true; }).slice(0, 4);
}

// ── the iron passage ────────────────────────────────────────────────────────
export interface IronPassage {
  title: string; // "Sade Sati · the rising phase" | "Ashtama Shani" | "The iron rests"
  whisper: string;
  body: string;
  next: string | null;
  active: boolean;
}

// The FINAL departure from a set of houses (counted from the natal Moon):
// Saturn's retrograde wobbles re-enter a sign months after first leaving it,
// so an exit only counts when no re-entry follows within 400 days.
function finalExit(key: string, fromMs: number, natalMoonRashi: number, houses: number[]): number | null {
  const inSet = (rashi: number) => houses.includes(((rashi - natalMoonRashi + 12) % 12) + 1);
  const entries = signEntries(key, fromMs, fromMs + 11000 * DAY_MS);
  let candidate: number | null = null;
  for (const e of entries) {
    if (inSet(e.from) && !inSet(e.to)) candidate = e.ms;
    else if (!inSet(e.from) && inSet(e.to) && candidate != null && e.ms - candidate < 400 * DAY_MS) candidate = null;
    else if (inSet(e.to) && candidate != null && e.ms - candidate >= 400 * DAY_MS) break;
  }
  return candidate;
}
const fmtMonthYear = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export function ironPassageFor(natal: VedicChart, ms: number, v: { obj: string; pos: string; subj: string }): IronPassage | null {
  const natalMoonRashi = natal.planets.find((p) => p.key === "moon")!.rashi;
  const satRashi = rashiAt("saturn", ms);
  if (satRashi < 0) return null;
  const house = ((satRashi - natalMoonRashi + 12) % 12) + 1;

  if (house === 12 || house === 1 || house === 2) {
    // Inside the Sade Sati: it ends when Saturn leaves the 2nd from the Moon.
    const phase = house === 12 ? "the rising phase" : house === 1 ? "the peak" : "the setting phase";
    const end = finalExit("saturn", ms, natalMoonRashi, [12, 1, 2]);
    return {
      title: `Sade Sati · ${phase}`,
      whisper: `Shani astride ${v.pos} Moon${end ? ` · until ${fmtMonthYear(end)}` : ""}`,
      body: `Saturn walks the three signs around ${v.pos} Moon: the seven and a half years the old texts call the iron passage. What is false is quietly dismantled and what is true is load-tested; slow years, and the ones ${v.subj} will be proudest of.`,
      next: end ? `The passage releases ${v.obj} in ${fmtMonthYear(end)}.` : null,
      active: true,
    };
  }
  if (house === 8) {
    const end = finalExit("saturn", ms, natalMoonRashi, [8]);
    return {
      title: "Ashtama Shani",
      whisper: `Shani eighth from ${v.pos} Moon${end ? ` · until ${fmtMonthYear(end)}` : ""}`,
      body: `Saturn crosses the eighth from ${v.pos} Moon: the deep house. Old accounts surface to be settled, and what is hidden asks to be faced. Not a wound, a reckoning; travel light and keep ${v.pos} word extra carefully until it passes.`,
      next: nextSadeSatiLine(natal, ms, v),
      active: true,
    };
  }
  return {
    title: "The iron rests",
    whisper: `Shani stands ${ord(house)} from ${v.pos} Moon`,
    body: `Saturn walks no trial house of ${v.pos} Moon at present: neither the Sade Sati nor the eighth passage weighs on ${v.obj}.`,
    next: nextSadeSatiLine(natal, ms, v),
    active: false,
  };
}

function nextSadeSatiLine(natal: VedicChart, ms: number, v: { obj: string; pos: string; subj: string }): string | null {
  const natalMoonRashi = natal.planets.find((p) => p.key === "moon")!.rashi;
  const twelfth = (natalMoonRashi + 11) % 12;
  for (const e of signEntries("saturn", ms, ms + 11000 * DAY_MS)) {
    if (e.to === twelfth) {
      return `The Sade Sati itself, Saturn's seven and a half years astride ${v.pos} Moon, does not begin until ${fmtMonthYear(e.ms)}. ${v.subj === "you" ? "You" : "They"} will be warned here when it approaches.`;
    }
  }
  return null;
}

// ── the clock within: pratyantardashas of the current antar ─────────────────
export interface ClockRow { lord: string; lordKey: DashaLord; range: string; now: boolean }

const P_LORDS: DashaLord[] = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const P_YEARS: Record<DashaLord, number> = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

export function clockWithin(natal: VedicChart, nowMs: number): ClockRow[] {
  const cur = natal.current;
  if (!cur) return [];
  const span = cur.antar.toMs - cur.antar.fromMs;
  const startIdx = P_LORDS.indexOf(cur.antar.lord);
  const rows: ClockRow[] = [];
  let cursor = cur.antar.fromMs;
  const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  for (let i = 0; i < 9; i++) {
    const lord = P_LORDS[(startIdx + i) % 9];
    const len = (span * P_YEARS[lord]) / 120;
    const from = cursor, to = cursor + len;
    if (to > nowMs - 90 * DAY_MS && rows.length < 6) {
      rows.push({
        lord: sanskritLord(lord).toUpperCase(),
        lordKey: lord,
        range: nowMs >= from && nowMs < to ? `until ${fmt(to)}` : `${fmt(from)} to ${fmt(to)}`,
        now: nowMs >= from && nowMs < to,
      });
    }
    cursor = to;
  }
  return rows;
}

// ── the gochara month passage ───────────────────────────────────────────────
// One woven sentence from the loudest favourable and unfavourable standings.
export function gocharaPassage(rows: GocharaRow[], v: { obj: string; pos: string; subj: string }): string {
  const fav = rows.filter((r) => r.favourable);
  const unfav = rows.filter((r) => !r.favourable);
  const parts: string[] = [];
  if (fav.length) parts.push(`${fav.map((r) => r.lord).join(", ")} stand${fav.length === 1 ? "s" : ""} well from ${v.pos} Moon this month: lean on what they rule.`);
  else parts.push(`No graha stands brightly from ${v.pos} Moon this month: a quiet stretch; keep the sails trimmed.`);
  if (unfav.some((r) => r.key === "saturn")) parts.push(`Shani asks patience.`);
  if (unfav.some((r) => r.key === "jupiter")) parts.push(`Guru's generosity runs through the purse; let it open only for what feeds ${v.obj}.`);
  return parts.join(" ");
}

export { RASHI_LORDS, feelingOf };
