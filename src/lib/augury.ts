// The Augury: what the sky says of a petitioner, computed against the
// Council's own charts. Three readings, all plain-spoken (no planet names on
// the page, per the Keiser): the accord with the table (the same ashta-koota
// the kindred stars use, petitioner's moon against every full member's), the
// palate omen (their taste, read from the sky's pleasure planet), and the
// shadow (one honest warning, from the same pitfall detection the Kundli
// runs). A petitioner without a complete birth record gets no Augury: the
// sky stays veiled, never guessed.

import { vedicChart } from "./vedic";
import { fullChart } from "./natal";
import { kutaAccord, kutaVerdict, pillarsOf } from "./kundli";
import { birthMoonOf } from "./natal-analysis";
import type { Application, Member } from "./types";

export interface Augury {
  accord: { total: number; verdict: string } | null; // vs the whole table
  easiest: { name: string; total: number } | null;
  hardest: { name: string; total: number } | null;
  palate: string;
  shadow: string;
}

// The palate omen, by the pleasure planet's sign: plain, wine-flavoured.
export const PALATE_OMEN: string[] = [
  "a palate that wants the first sip to announce itself; subtlety must earn its patience.",
  "a taste for texture and generosity; they will forgive a rustic wine long before a thin one.",
  "a curious tongue that orders two glasses to compare; variety pleases them more than perfection.",
  "a comfort palate: the wine that tastes of somewhere, poured by someone, wins every time.",
  "a taste for the grand gesture; label, story, and glassware all count as flavour.",
  "a precise palate that notices what the room misses, and cannot politely unnotice it.",
  "a balance-seeking palate: harmony over power, and the blend over the soloist.",
  "an all-or-nothing palate: they will love three wines a year and defend them unreasonably.",
  "an adventurer's palate, happiest with the bottle nobody can pronounce.",
  "a classicist's palate: structure, restraint, and wines that keep their word.",
  "a contrarian's palate that finds the cult wine dull and the overlooked one thrilling.",
  "a dreamer's palate, led by nose and memory; the wine is judged half by where it takes them.",
];

// The shadow: one honest warning, plain, from the pitfall keys the Kundli
// already detects. No planet is named.
const SHADOW_PLAIN: Record<string, string> = {
  "moon-ketu": "feeling retreats when it should speak; solitude will flatter them more than it feeds them.",
  "moon-rahu": "the heart wants what the eye has only glimpsed; their moods can be talked into the wrong bottle and the wrong hill to die on.",
  "moon-saturn": "feeling arrives with a delay and a tax; they carry weather the table never sees.",
  "moon-h6": "worry makes work for itself in this one; peace reads to them as an unfinished task.",
  "moon-h8": "the tide runs deep and unwitnessed; expect passionate verdicts, softly retracted the next morning.",
  "moon-h12": "the inner rooms call more sweetly than the table; they will vanish kindly and often.",
  "rahu-h1": "the mask is hungry; they can become what the room wants faster than what they are.",
  "rahu-h2": "appetite sits in their storehouse; enough is a word they will need taught.",
  "rahu-h3": "boldness borrows beyond its means; watch the promise made for the thrill of making it.",
  "rahu-h4": "home never quite feels finished to them; their peace keeps moving house.",
  "rahu-h5": "their play turns compulsive when unwatched; applause is a hunger here.",
  "rahu-h6": "they make rivals of habits before people; a useful trait, until it is aimed at the table.",
  "rahu-h7": "the exotic is a requirement in their partnerships; the familiar will have to work harder.",
  "rahu-h8": "the forbidden shelf is the first one they read; depth becomes appetite.",
  "rahu-h9": "belief chases novelty in this one; expect a new philosophy every season.",
  "rahu-h10": "ambition without a ceiling; the name can grow faster than its owner.",
  "rahu-h11": "the harvest is never large enough; gains feed the wanting of more gains.",
  "rahu-h12": "the hunger turns inward and abroad at once; spending, dreams, and distances all run long.",
  "saturn-kendra": "things come late for this one, and better for it, but only if they keep building while they wait.",
};

const chartComplete = (x: { date_of_birth?: string | null; time_of_birth?: string | null; birth_lat?: number | null; birth_lon?: number | null }) =>
  !!x.date_of_birth && !!x.time_of_birth && x.birth_lat != null && x.birth_lon != null;

export function computeAugury(app: Application, members: Member[], nowMs: number): Augury | null {
  if (!chartComplete(app)) return null;
  const chart = vedicChart(app.date_of_birth!, app.time_of_birth, app.birth_tz, app.birth_lat, app.birth_lon, nowMs);
  const trop = fullChart(app.date_of_birth!, app.time_of_birth, app.birth_tz, app.birth_lat, app.birth_lon);
  if (!chart || !trop) return null;
  const moonLon = chart.planets.find((p) => p.key === "moon")!.lon;

  // The accord: mean kuta against every living full member with a complete chart.
  const scores: { name: string; total: number }[] = [];
  for (const m of members) {
    if (m.role === "initiate" || m.active === false || !chartComplete(m)) continue;
    const mc = vedicChart(m.date_of_birth!, m.time_of_birth, m.birth_tz, m.birth_lat, m.birth_lon, nowMs);
    const mMoon = mc?.planets.find((p) => p.key === "moon")?.lon;
    if (mMoon == null) continue;
    scores.push({ name: m.cult_name, total: kutaAccord(moonLon, mMoon).total });
  }
  scores.sort((a, b) => b.total - a.total);
  const mean = scores.length ? scores.reduce((s, x) => s + x.total, 0) / scores.length : null;
  const rounded = mean == null ? null : Math.round(mean * 2) / 2;

  // The palate omen from the pleasure planet's sign (tropical, as the card reads it).
  const venus = trop.planets.find((p) => p.key === "venus")!;
  const palate = PALATE_OMEN[Math.floor(((venus.lon % 360) + 360) % 360 / 30)];

  // The shadow: the strongest detected pitfall, plainly; a clean chart gets
  // the honest lunation line instead (already plain).
  const pitfalls = pillarsOf(chart).pitfalls;
  const shadow =
    pitfalls.map((k) => SHADOW_PLAIN[k]).find(Boolean) ||
    birthMoonOf(trop, { subj: "they", Subj: "They", obj: "them", pos: "their", Pos: "Their" })?.text ||
    "the sky holds no marked shadow over this one; watch them anyway.";

  return {
    accord: rounded == null ? null : { total: rounded, verdict: kutaVerdict(rounded) },
    easiest: scores[0] || null,
    hardest: scores.length > 1 ? scores[scores.length - 1] : null,
    palate,
    shadow,
  };
}
