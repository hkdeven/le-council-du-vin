// The Wheel's deeper readings, computed from the tropical chart the app
// already draws: the temperament (element and mode balance), the figures
// (classical aspect patterns), the chart bearer (the ascendant's ruler and
// its dignity), and the birth moon (the lunation phase). Nothing is guessed;
// a chart without a figure simply has no figures section.

import type { Chart, PlanetPos } from "./natal";

const rev = (x: number) => ((x % 360) + 360) % 360;
const sep = (a: number, b: number) => { const d = Math.abs(rev(a) - rev(b)); return d > 180 ? 360 - d : d; };
const near = (d: number, x: number, orb: number) => Math.abs(d - x) <= orb;

export interface Voice { subj: string; Subj: string; obj: string; pos: string; Pos: string }

// ── the temperament ─────────────────────────────────────────────────────────
export interface Balance { name: string; count: number; who: string[] }
export interface Temperament {
  elements: Balance[]; // Fire Earth Air Water, sorted desc
  modes: Balance[]; // Cardinal Fixed Mutable, sorted desc
  verdict: string;
}

const ELEMENTS = ["Fire", "Earth", "Air", "Water"];
const MODES = ["Cardinal", "Fixed", "Mutable"];

// The verdict: dominant element crossed with dominant mode, hand-written.
const TEMPER_VERDICT: Record<string, (v: Voice) => string> = {
  "Fire|Cardinal": (v) => `Fire leads under cardinal signs: ${v.subj} ignite things. The first move is ${v.pos} native gift; the follow-through is the practice.`,
  "Fire|Fixed": (v) => `Fire leads, held in fixed signs: a forge, not a wildfire. ${v.Pos} heat is steady and long, and it does not forgive being wasted.`,
  "Fire|Mutable": (v) => `Fire leads in mutable signs: flame that travels. Enthusiasm carries ${v.obj} far and often; the art is choosing which fires to feed.`,
  "Earth|Cardinal": (v) => `Earth leads under cardinal signs: ${v.subj} build first and philosophise later. Beginnings, in ${v.pos} hands, come with foundations.`,
  "Earth|Fixed": (v) => `Earth leads in fixed signs: bedrock. What ${v.subj} make is made to outlast its maker, and so are ${v.pos} loyalties.`,
  "Earth|Mutable": (v) => `Earth leads in mutable signs: soil that turns. Practical and adaptable at once; ${v.subj} improve whatever ground ${v.subj} stand on.`,
  "Air|Cardinal": (v) => `Air leads, and cardinal signs carry the sky: a mind that moves first and moves others, at home in words, judgement, and beginnings.`,
  "Air|Fixed": (v) => `Air leads in fixed signs: convictions arrived at slowly and abandoned never. The mind is the fortress and the library both.`,
  "Air|Mutable": (v) => `Air leads in mutable signs: quicksilver. Ideas breed ideas; the gift is connection, the discipline is finishing.`,
  "Water|Cardinal": (v) => `Water leads under cardinal signs: feeling that acts. ${v.Subj} read the room and then move it; care, in ${v.pos} hands, is a verb.`,
  "Water|Fixed": (v) => `Water leads in fixed signs: still, deep, and unforgetting. What enters ${v.pos} heart stays; choose the entrants carefully.`,
  "Water|Mutable": (v) => `Water leads in mutable signs: the tide itself. Porous, imaginative, and easily coloured by the company; solitude is how ${v.subj} return to ${v.pos} own hue.`,
};

export function temperamentOf(chart: Chart, v: Voice): Temperament {
  const elements: Balance[] = ELEMENTS.map((name) => ({ name, count: 0, who: [] }));
  const modes: Balance[] = MODES.map((name) => ({ name, count: 0, who: [] }));
  const tally = (name: string, lon: number) => {
    const s = Math.floor(rev(lon) / 30);
    elements[s % 4].count++; elements[s % 4].who.push(name);
    modes[s % 3].count++; modes[s % 3].who.push(name);
  };
  for (const p of chart.planets) tally(p.name, p.lon);
  if (chart.asc != null) tally("Ascendant", chart.asc);
  const els = [...elements].sort((a, b) => b.count - a.count);
  const mds = [...modes].sort((a, b) => b.count - a.count);
  const tail = ` What little is ${mds[2].name.toLowerCase()} in ${v.obj} runs deep rather than wide.`;
  return {
    elements: els,
    modes: mds,
    verdict: TEMPER_VERDICT[`${els[0].name}|${mds[0].name}`](v) + (mds[2].count <= 2 ? tail : ""),
  };
}

// ── the figures ─────────────────────────────────────────────────────────────
export interface Figure { key: string; name: string; text: string }

// What each planet brings to a fusion, for the exact-conjunction passages.
const FUSION: Record<string, string> = {
  Sun: "identity", Moon: "feeling", Mercury: "the mind", Venus: "affection",
  Mars: "drive", Jupiter: "fortune", Saturn: "the old order", Uranus: "the breaker of orders",
  Neptune: "the dream", Pluto: "power",
};
const CONJ_TEXT: Record<string, (v: Voice, a: PlanetPos, b: PlanetPos) => string> = {
  "Sun-Pluto": (v, a, b) => `a third of a degree apart in ${a.sign.name}. Identity and power share one seat; ${v.subj} do not want things mildly, and what ${v.subj} value, ${v.subj} guard like a vault.`,
  "Saturn-Uranus": (v, a) => `the old order and the breaker of orders, fused in ${a.sign.name}. ${v.Subj} build structures and then test them ${v.subj === "you" ? "yourself" : "themselves"}; the rare mark of one born at a changing of the guard.`,
};

export function figuresOf(chart: Chart, v: Voice): Figure[] {
  const P = chart.planets;
  const out: Figure[] = [];

  // Stellium: three or more planets in one sign.
  const bySign: Record<string, PlanetPos[]> = {};
  for (const p of P) (bySign[p.sign.name] ||= []).push(p);
  for (const [sign, ps] of Object.entries(bySign)) {
    if (ps.length >= 3) out.push({
      key: `stellium-${sign}`, name: `Stellium in ${sign}`,
      text: `${ps.map((p) => p.name).join(", ")} gathered in one sign: a concentration of the chart's weight. Whatever ${sign} rules in ${v.pos} life is not a theme but the theme.`,
    });
  }

  // Exact conjunctions (within 1°) among distinct planets.
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const d = sep(P[i].lon, P[j].lon);
    if (d <= 1) {
      const key = `${P[i].name}-${P[j].name}`;
      const special = CONJ_TEXT[key];
      out.push({
        key: `conj-${key}`, name: `${P[i].name} conjunct ${P[j].name}, exact`,
        text: special ? special(v, P[i], P[j]) : `${FUSION[P[i].name]} and ${FUSION[P[j].name]} fused within a degree in ${P[i].sign.name}: the two act as one organ in ${v.pos} chart, for better and for worse.`,
      });
    }
  }

  // Grand trine, T-square, grand cross, yod.
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) for (let k = j + 1; k < P.length; k++) {
    const names = [P[i].name, P[j].name, P[k].name].join(", ");
    const d1 = sep(P[i].lon, P[j].lon), d2 = sep(P[j].lon, P[k].lon), d3 = sep(P[i].lon, P[k].lon);
    if (near(d1, 120, 6) && near(d2, 120, 6) && near(d3, 120, 6)) {
      out.push({ key: `trine-${names}`, name: "Grand trine", text: `${names} in an unbroken triangle of ease: a talent that flows without effort, and therefore risks being taken for granted. Spend it on purpose.` });
    }
    const trio: [number, number, number][] = [[d1, d2, d3], [d2, d3, d1], [d3, d1, d2]];
    for (const [a, b, opp] of trio) {
      if (near(a, 90, 6) && near(b, 90, 6) && near(opp, 180, 7)) {
        out.push({ key: `tsq-${names}`, name: "T-square", text: `${names} locked in a T-square: a standing tension that will not resolve itself. It is also the chart's engine; the friction is where ${v.pos} work gets done.` });
        break;
      }
      if (near(a, 60, 4) && near(b, 150, 3.5) && near(opp, 150, 3.5)) {
        out.push({ key: `yod-${names}`, name: "Yod", text: `${names} in the finger of fate: two talents pointing at one strange obligation. The chart keeps returning ${v.obj} to it until it is answered.` });
        break;
      }
    }
  }
  // Grand cross: two oppositions crossing at squares.
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    if (!near(sep(P[i].lon, P[j].lon), 180, 7)) continue;
    for (let k = 0; k < P.length; k++) for (let l = k + 1; l < P.length; l++) {
      if (k === i || k === j || l === i || l === j) continue;
      if (near(sep(P[k].lon, P[l].lon), 180, 7) && near(sep(P[i].lon, P[k].lon), 90, 6)) {
        const names = [P[i].name, P[j].name, P[k].name, P[l].name].join(", ");
        if (!out.some((f) => f.key.startsWith("cross-"))) {
          out.push({ key: `cross-${names}`, name: "Grand cross", text: `${names} squared into a full cross: pressure from every quarter, and the rare constitution that grows strong under it.` });
        }
      }
    }
  }

  // Dedupe overlapping trios sharing the same name+first planet, keep the tightest few.
  const seen = new Set<string>();
  return out.filter((f) => { if (seen.has(f.name)) return false; seen.add(f.name); return true; }).slice(0, 4);
}

// ── the chart bearer ────────────────────────────────────────────────────────
export interface Bearer { title: string; whisper: string; text: string }

const RULER: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon", Leo: "Sun", Virgo: "Mercury",
  Libra: "Venus", Scorpio: "Mars", Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};
const OWN: Record<string, string[]> = {
  Sun: ["Leo"], Moon: ["Cancer"], Mercury: ["Gemini", "Virgo"], Venus: ["Taurus", "Libra"],
  Mars: ["Aries", "Scorpio"], Jupiter: ["Sagittarius", "Pisces"], Saturn: ["Capricorn", "Aquarius"],
};
const EXALT: Record<string, string> = {
  Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces", Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra",
};
const FALL: Record<string, string> = {
  Sun: "Libra", Moon: "Scorpio", Mercury: "Pisces", Venus: "Virgo", Mars: "Cancer", Jupiter: "Capricorn", Saturn: "Aries",
};

const BEARER_TEXT: Record<string, (v: Voice) => string> = {
  Sun: (v) => `The Sun keeps ${v.pos} chart: the self is the instrument, and warmth is the method. The chart brightens or dims with ${v.pos} own standing.`,
  Moon: (v) => `The Moon keeps ${v.pos} chart: feeling steers everything downstream. ${v.Pos} tides are the chart's weather; learn their calendar.`,
  Mercury: (v) => `Mercury keeps ${v.pos} chart: the mind is the keel. Everything in ${v.pos} life goes better said aloud, written down, or thought twice.`,
  Venus: (v) => `Venus keeps ${v.pos} chart: charm is not something ${v.subj} do; it is the material the whole chart is built from, and it strengthens every placement it touches.`,
  Mars: (v) => `Mars keeps ${v.pos} chart: the will is the spine. The chart rewards ${v.pos} courage and punishes ${v.pos} idleness, in that order.`,
  Jupiter: (v) => `Jupiter keeps ${v.pos} chart: belief is the engine. ${v.Pos} luck scales with ${v.pos} generosity, which is the oldest trade there is.`,
  Saturn: (v) => `Saturn keeps ${v.pos} chart: time is on ${v.pos} side, provided ${v.subj} keep working while it passes. The chart pays late and pays well.`,
};

export function bearerOf(chart: Chart, v: Voice): Bearer | null {
  if (!chart.ascSign) return null;
  const rulerName = RULER[chart.ascSign.name];
  const p = chart.planets.find((x) => x.name === rulerName);
  if (!p) return null;
  const dignity =
    OWN[rulerName]?.includes(p.sign.name) ? "in her own sign" :
    EXALT[rulerName] === p.sign.name ? "exalted" :
    FALL[rulerName] === p.sign.name ? "in fall" : null;
  const dignityWord = rulerName === "Venus" || rulerName === "Moon" ? dignity : dignity?.replace("her", "its");
  const houseWord = p.house ? ` · the ${ord(p.house)} house` : "";
  const dignityClause =
    dignity === null ? "" :
    dignity.includes("own") ? ` Standing ${dignityWord} at that, the keeper works from home ground: dignified, unhurried, and visible.` :
    dignity === "exalted" ? " Exalted at that: the keeper works at full strength." :
    " In fall at that: the keeper works uphill, which builds an uncommon resourcefulness.";
  return {
    title: `${rulerName}${dignity && dignity !== "in fall" ? `, ${dignityWord}` : ""}`,
    whisper: `ruler of ${v.pos} ${chart.ascSign.name} ascendant · ${p.sign.name} ${p.deg}°${houseWord}`,
    text: BEARER_TEXT[rulerName](v) + dignityClause,
  };
}
function ord(n: number): string {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}

// ── the birth moon ──────────────────────────────────────────────────────────
export interface BirthMoon { title: string; whisper: string; text: string }

const PHASES: { name: string; text: (v: Voice) => string }[] = [
  { name: "The new moon", text: (v) => `Born in the dark of the moon: the instinctive beginner. ${v.Subj} act on seeds ${v.subj} cannot yet see grown, and the acting is the point.` },
  { name: "The crescent", text: (v) => `Born under the young crescent: the striver. Something in ${v.obj} is always pulling away from where ${v.subj} started, and it should be trusted.` },
  { name: "The first quarter", text: (v) => `Born at the first quarter: the builder in a crisis of action. Obstacles read to ${v.obj} as instructions.` },
  { name: "The gibbous moon", text: (v) => `Born under the swelling moon: the perfecter. ${v.Subj} refine what others rough out, and the last ten percent is ${v.pos} native country.` },
  { name: "The full moon", text: (v) => `Born under the full moon: life lived in relationship's floodlight. Meaning arrives through the other; so does the mirror.` },
  { name: "The disseminating moon", text: (v) => `Born as the light began returning outward: the teacher. What ${v.subj} learn refuses to stay private.` },
  { name: "The last quarter", text: (v) => `Born as the moon turned away from fullness: the crisis of conscience. Last-quarter souls harvest and prune; they take what a cycle has taught, keep the essential, and clear ground for what others cannot yet see coming.` },
  { name: "The balsamic moon", text: (v) => `Born in the moon's last sliver: the closer of cycles. Old business finds ${v.obj} to be finished, and endings, in ${v.pos} hands, are humane.` },
];

export function birthMoonOf(chart: Chart, v: Voice): BirthMoon | null {
  const sun = chart.planets.find((p) => p.key === "sun");
  const moon = chart.planets.find((p) => p.key === "moon");
  if (!sun || !moon) return null;
  const phase = rev(moon.lon - sun.lon);
  const idx = Math.floor(phase / 45) % 8;
  return {
    title: PHASES[idx].name,
    whisper: `the sun and moon ${Math.round(phase)}° apart`,
    text: PHASES[idx].text(v),
  };
}
