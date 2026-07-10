// Every passage the Kundli can speak, written once, by hand, and chosen by
// the chart itself. Plain voice, per the Foretelling ruling. Each writer takes
// the voice V so the same passage reads "you/your" on your own chart and
// "they/their" on another's.

import type { DashaLord } from "./vedic";

export interface V {
  subj: string; // you | they
  Subj: string; // You | They
  obj: string; // you | them
  pos: string; // your | their
  Pos: string; // Your | Their
}
export const SELF: V = { subj: "you", Subj: "You", obj: "you", pos: "your", Pos: "Your" };
export const OTHER: V = { subj: "they", Subj: "They", obj: "them", pos: "their", Pos: "Their" };

// ── the age you are living: the nine mahadashas ─────────────────────────────
export const DASHA_TEXT: Record<DashaLord, (v: V) => string> = {
  Sun: (v) => `Sun years put ${v.obj} in the light: authority, recognition, and the question of what ${v.subj} stand for when people are watching. Fathers and leaders matter more than usual. The risk of the age is pride; its gift is a spine.`,
  Moon: (v) => `Moon years turn the tide inward: home, family, feeling, and the slow work of belonging. Life moves in swells rather than leaps, and ${v.pos} instincts run truer than ${v.pos} plans. Rest matters; so does being near water, kin, and the familiar table.`,
  Mars: (v) => `Mars years bring heat: ambition with its sleeves rolled, contests worth winning, and energy that must be spent or it turns on its keeper. ${v.Subj} build, compete, and cut away what is dead. The warning of the age is haste and the quarrel ${v.subj} did not need.`,
  Mercury: (v) => `Mercury years sharpen the tongue and the ledger: trade, study, writing, and the joy of a working mind. Networks widen and ideas earn. The age rewards curiosity and punishes scattered attention; finish what ${v.subj} start.`,
  Jupiter: (v) => `Jupiter years are the open hand: expansion, teachers, fortune that arrives through generosity and belief. What ${v.subj} give returns multiplied; children, learning, and far places are favoured. The only trap is excess dressed as optimism.`,
  Venus: (v) => `Venus years soften the road: love, beauty, comfort, and money that comes more easily than it should. Taste becomes a power. The age asks only that ${v.subj} enjoy without dissolving; pleasure is the reward of these years, not their purpose.`,
  Saturn: (v) => `Saturn years are the long apprenticeship: duty, patience, and results that arrive late but stay. What is false in ${v.pos} life is quietly dismantled; what is true is load-tested and kept. Slow years, and the ones ${v.subj} will be proudest of.`,
  Rahu: (v) => `Rahu years bring hunger: ambition beyond the map, unconventional roads, foreign influences and material growth, with a standing warning against shortcuts and overreach. ${v.Subj} are pulled toward what ${v.subj} have not yet been; some of it is destiny and some of it is glamour, and telling them apart is the work of the age.`,
  Ketu: (v) => `Ketu years loosen the grip: detachment, endings that free, and a pull toward the inner life. Worldly wins feel strangely light in the hand. The age rewards letting go on purpose before life does it for ${v.obj}.`,
};

// The antardasha tempering, one clause per sub-lord.
export const ANTAR_TEXT: Record<DashaLord, (v: V) => string> = {
  Sun: (v) => `Within it, the Sun's sub-period turns the light on ${v.obj}: visibility, judgement calls, and matters of standing come due.`,
  Moon: () => `Within it, the Moon's sub-period turns the tide inward: home, feeling, and belonging steer the bigger machinery.`,
  Mars: () => `Within it, Mars quickens the pace: action is favoured over deliberation, and tempers run a degree hotter than the matter deserves.`,
  Mercury: () => `Within it, Mercury sets the terms: contracts, conversations, and paperwork carry the period's real weight.`,
  Jupiter: () => `Within it, Jupiter opens doors: guidance appears, and generosity given now compounds unusually well.`,
  Venus: () => `Within it, Venus sweetens the ground: relationships, comfort, and matters of taste take the wheel for a while.`,
  Saturn: () => `Within it, Saturn slows the machinery: obligations surface, and patience becomes the only strategy that works.`,
  Rahu: (v) => `Within it, Rahu stirs the appetite: ${v.subj} want more than the period was going to give, and the wanting itself needs watching.`,
  Ketu: () => `Within it, Ketu loosens attachments: something that felt essential quietly stops mattering, and that is the point.`,
};

// The one-line promise of the age to come ("Next: the years of X, …").
export const NEXT_CLAUSE: Record<DashaLord, string> = {
  Sun: "an age of light, standing, and the question of what the name is for",
  Moon: "an age of home, feeling, and the slow work of belonging",
  Mars: "an age of heat, contest, and building with rolled sleeves",
  Mercury: "an age of trade, study, and the working mind",
  Jupiter: "an age of expansion, teachers, and fortune earned through generosity",
  Venus: "an age of love, comfort, and taste become a power",
  Saturn: "an age of duty, patience, and results that stay",
  Rahu: "an age of hunger, unconventional roads, and growth beyond the map",
  Ketu: "an age of letting go, and the freedom on the far side of it",
};

// Tooltips for the full-turning rows: what each lord's years carry.
export const DASHA_TIP: Record<DashaLord, string> = {
  Sun: "Six years of the Sun: authority, visibility, the father, and questions of standing.",
  Moon: "Ten years of the Moon: home, feeling, the mother, and the slow work of belonging.",
  Mars: "Seven years of Mars: drive, contest, property, and energy that must be spent well.",
  Mercury: "Seventeen years of Mercury: trade, study, writing, and the working mind.",
  Jupiter: "Sixteen years of Jupiter: expansion, teachers, children, fortune through generosity.",
  Venus: "Twenty years of Venus: love, beauty, comfort, and money that flows through taste.",
  Saturn: "Nineteen years of Saturn: duty, patience, and late results that stay for good.",
  Rahu: "Eighteen years of Rahu: hunger, unconventional roads, foreign influence, material growth, and the temptation of shortcuts.",
  Ketu: "Seven years of Ketu: detachment, endings that free, and the inner life.",
};

// ── the three header rows ───────────────────────────────────────────────────
export const LAGNA_TIP =
  "The Lagna is the sign rising in the east at the first breath, the Vedic ascendant. It sets the first house, and the whole chart hangs from it.";
export const NAKSHATRA_ROW_TIP =
  "The sky divides into 27 lunar mansions of 13°20' each, the nakshatras. The Moon's mansion at birth is the birth star: it colours the inner life and times the dashas. Each divides into four padas, quarter-steps.";
export const NAVAMSA_TIP =
  "The Navamsa (D9) divides every sign into nine. It is the chart behind the chart: the marriage, the later life, and the strength a planet really has.";

// A short character for each rising rashi (the Lagna row's value tooltip).
export const LAGNA_NATURE: string[] = [
  "Mesha rising: first through the door, quick to act, quicker to recover.",
  "Vrishabha rising: steady hands, fine appetites, and a long memory for comfort.",
  "Mithuna rising: two of everything, especially thoughts; charm that talks its way in.",
  "Karka rising: the shell and the softness inside it; home is the true country.",
  "Simha rising: warmth that expects an audience and usually earns one.",
  "Kanya rising: the discerning eye; nothing escapes it, least of all its keeper.",
  "Tula rising: balance as an instinct, beauty as a requirement, company as fuel.",
  "Vrischika rising: still water, great depth, and a sting kept honestly in reserve.",
  "Dhanu rising: the arrow already loosed; belief, distance, and the open road.",
  "Makara rising: the mountain goat; slow, sure, and always higher by nightfall.",
  "Kumbha rising: the water-bearer who serves the many and belongs to no one.",
  "Meena rising: the two fish; porous, dreaming, and wiser than they let on.",
];

// A short character for each birth star (the nakshatra row's value tooltip).
export const NAKSHATRA_TIP: string[] = [
  "Ashwini, the horse's head: the healer who arrives first; speed, beginnings, and restlessness.",
  "Bharani, the bearer: carries what others cannot; appetite, endurance, and fierce loyalty.",
  "Krittika, the blade: cuts to the truth of a thing; sharp tongue, warm fire beneath.",
  "Rohini, the red one: the Moon's favourite; beauty, growth, and a taste for the finest.",
  "Mrigashira, the deer's head: the searcher; curious, gentle, never quite done looking.",
  "Ardra, the storm's tear: feeling that breaks and renews; intensity worn honestly.",
  "Punarvasu, the return of light: recovers everything; optimism with deep roots.",
  "Pushya, the nourisher: the most auspicious star; quietly feeds everyone at the table.",
  "Ashlesha, the coiled serpent: sees beneath; magnetic, guarded, wise in the old way.",
  "Magha, the throne: ancestry and dignity; carries the family's name like a crown.",
  "Purva Phalguni, the first fruit: pleasure, art, and rest earned in good company.",
  "Uttara Phalguni, the later fruit: the patron's star; generosity with a spine, friendship that keeps its word.",
  "Hasta, the hand: skill in the fingers; makes, mends, and steals hearts by craft.",
  "Chitra, the jewel: the architect's star; builds beautiful things and knows it.",
  "Swati, the young shoot in wind: independence; bends, never breaks, roots alone.",
  "Vishakha, the forked branch: purpose with two paths; wins by refusing to stop.",
  "Anuradha, the following star: devotion and friendship; blooms in hard soil.",
  "Jyeshtha, the eldest: the protector's burden; authority worn young.",
  "Mula, the root: digs to the bottom of everything, even when the bottom bites.",
  "Purva Ashadha, the early victory: the invincible tide; conviction that carries others.",
  "Uttara Ashadha, the later victory: the lasting win; patience aimed at permanence.",
  "Shravana, the ear: the listener; learns everything, repeats only what serves.",
  "Dhanishta, the drum: rhythm and wealth; hears the music before the room does.",
  "Shatabhisha, the hundred healers: the veiled star; solitary, searching, hard to fool.",
  "Purva Bhadrapada, the first funeral fire: intensity with a philosopher's core.",
  "Uttara Bhadrapada, the later fire: the deep well; calm surface, bottomless patience.",
  "Revati, the wealthy road: the last star; kindness that guides travellers home.",
];

// ── the pillars and the pits ────────────────────────────────────────────────
// The strength: where the chart's keeper (the lagna lord) stands.
export const STRENGTH_BY_HOUSE: ((v: V, lord: string) => string)[] = [
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 1st, at the very door of the chart: self-possession is the estate, and life answers to ${v.pos} own hand.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 2nd: a mind that earns; words, judgement, and the stores ${v.subj} keep are the estate.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 3rd: courage and craft; ${v.subj} make ${v.pos} own luck with ${v.pos} own hands, and younger allies gather.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 4th: the root is home; property, peace, and the mother's line are where ${v.pos} strength collects.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 5th: creation is the estate; children, play, and work that bears ${v.pos} signature.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 6th: strength through opposition; ${v.subj} are built by what resists ${v.obj}, and rivals keep ${v.obj} sharp.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 7th: the estate is the other; partnership completes what ${v.subj} begin, in trade and in love.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 8th: depth is the estate; ${v.subj} are made for what others avoid, and transformation is ${v.pos} native ground.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 9th: fortune is the estate; belief, teachers, and far places bless the whole chart from above.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 10th: the estate is the work itself; standing grows in public, and the name outruns the person.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 11th: gains are the estate; friends, networks, and harvests that arrive through many hands.`,
  (v, l) => `${l}, lord of ${v.pos} lagna, stands in the 12th: the estate is the unseen; solitude, far shores, and the inner rooms where ${v.pos} real work happens.`,
];

// The dharma path: the 10th house and its lord's nature.
export const DHARMA_BY_LORD: Record<string, (v: V, sign: string) => string> = {
  Sun: (v, s) => `the 10th carries ${s}, ruled by Surya: work of light and leadership. The path asks ${v.obj} to stand where ${v.subj} can be seen, and to be worth seeing.`,
  Moon: (v, s) => `the 10th carries ${s}, ruled by Chandra: work of care and public feeling. The path rewards the one who reads the room and feeds it.`,
  Mars: (v, s) => `the 10th carries ${s}, ruled by Mangala: work of the campaign. The path rewards decisiveness; ${v.subj} are paid to act while others weigh.`,
  Mercury: (v, s) => `the 10th carries ${s}, ruled by Budha: work of language, trade, and connection. The path rewards the broker of understanding, not the lone hand.`,
  Jupiter: (v, s) => `the 10th carries ${s}, ruled by Guru: work of counsel and growth. The path rewards the teacher in ${v.obj}, whatever the trade is called.`,
  Venus: (v, s) => `the 10th carries ${s}, ruled by Shukra: work of taste and harmony. The path rewards the maker of pleasant things and peaceable rooms.`,
  Saturn: (v, s) => `the 10th carries ${s}, ruled by Shani: work of structure and time. The path rewards endurance; ${v.pos} monuments are built slowly and last accordingly.`,
};

// The pitfalls, by condition key; strongest first, at most two spoken.
export const PITFALL_TEXT: Record<string, (v: V) => string> = {
  "moon-ketu": (v) => `Chandra with Ketu: feeling retreats when it should speak, and solitude flatters ${v.obj} more than it feeds ${v.obj}.`,
  "moon-rahu": (v) => `Chandra with Rahu: the heart wants what the eye has only glimpsed; ${v.pos} moods can be talked into wanting the wrong thing.`,
  "moon-saturn": (v) => `Chandra with Shani: feeling arrives with a delay and a tax; ${v.subj} carry weather that others never see.`,
  "moon-h6": () => `The Moon in the 6th: worry makes work for itself; the mind treats peace as an unfinished task.`,
  "moon-h8": (v) => `The Moon in the 8th: feeling runs at depth; ${v.subj} know the undertow of a room before its surface.`,
  "moon-h12": (v) => `The Moon in the 12th: the inner rooms call more sweetly than the table; retreat restores ${v.obj}, but it can also hide ${v.obj}.`,
  "rahu-h1": (v) => `Rahu in the 1st: the mask is hungry; ${v.subj} can become what the room wants faster than what ${v.subj} are.`,
  "rahu-h2": () => `Rahu in the 2nd: appetite sits in the storehouse; enough is a word it has to be taught.`,
  "rahu-h3": () => `Rahu in the 3rd: boldness borrows beyond its means; the risk is the promise made for the thrill of making it.`,
  "rahu-h4": () => `Rahu in the 4th: home never quite feels finished; the hunger is for a peace that keeps moving.`,
  "rahu-h5": () => `Rahu in the 5th: the play turns compulsive if unwatched; creation wants applause more than it should.`,
  "rahu-h6": () => `Rahu in the 6th makes rivals of habits before people.`,
  "rahu-h7": (v) => `Rahu in the 7th: the other is exotic by requirement; ${v.subj} are drawn to partners from beyond ${v.pos} map.`,
  "rahu-h8": () => `Rahu in the 8th: the forbidden shelf is the first one read; depth becomes appetite.`,
  "rahu-h9": () => `Rahu in the 9th: belief chases novelty; the risk is a new philosophy every season.`,
  "rahu-h10": () => `Rahu in the 10th: ambition without a ceiling; the name can grow faster than its owner.`,
  "rahu-h11": () => `Rahu in the 11th: the harvest is never large enough; gains feed the wanting of more gains.`,
  "rahu-h12": () => `Rahu in the 12th: the hunger turns inward and abroad at once; spending, dreams, and distances all run long.`,
  "saturn-kendra": (v) => `Shani stands in a kendra: weight on a load-bearing corner of the chart. Things come late for ${v.obj}, and better for it, but only if ${v.subj} keep building while ${v.subj} wait.`,
};

// ── the marriage bond ───────────────────────────────────────────────────────
export const SEVENTH_LORD_HOUSE: ((v: V, sign: string, lord: string) => string)[] = [
  (v, s, l) => `The 7th carries ${s}, its lord ${l} standing at the chart's own door: the bond walks in early and shapes the life around it.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of stores: a partnership of building; the table and the ledger are set together.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of courage: a companion for the road; the bond is made in doing, not in sitting.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of home: the bond wants a hearth; it grows strongest under one roof.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of play: romance keeps its youth; the bond stays courtship long after the wedding.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of service: love proves itself in small daily acts, and asks the same proof back.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in its own house: partnership on its own ground; the bond is the strongest room in the chart.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of depths: the bond transforms its keepers; shallow water is not on offer.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} seated in the house of fortune: a partnership of belief and growth, likelier found through learning or far places than next door.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of work: the partner shares the ambition or shares nothing; the bond is a working alliance.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of gains: the bond multiplies through friends; love arrives introduced.`,
  (v, s, l) => `The 7th carries ${s}, its lord ${l} in the house of the unseen: a private bond, or a far one; it thrives away from the crowd.`,
];
export function venusLine(v: V, house: number | null): string {
  if (house === 1) return ` Shukra in the lagna gives charm that opens doors; the work is staying once inside.`;
  if (house === 7) return ` Shukra stands in the 7th itself: affection is native to the bond, and beauty matters more than ${v.subj} admit.`;
  if (house === 12) return ` Shukra in the 12th loves best in private; the sweetest hours of the bond are the unseen ones.`;
  return "";
}
export const NAVAMSA_BOND: string[] = [
  "the bond sharpens you into action.",
  "the bond settles you like good land.",
  "the bond keeps you talking, which keeps you together.",
  "the bond makes a home of you.",
  "the bond warms you into generosity.",
  "the bond teaches you the care of small things.",
  "the bond balances you.",
  "the bond deepens you.",
  "the bond widens your horizon.",
  "the bond steadies you for the long climb.",
  "the bond frees you into friendship.",
  "the bond softens you.",
];
export const NAVAMSA_BOND_OTHER: string[] = [
  "the bond sharpens them into action.",
  "the bond settles them like good land.",
  "the bond keeps them talking, which keeps them together.",
  "the bond makes a home of them.",
  "the bond warms them into generosity.",
  "the bond teaches them the care of small things.",
  "the bond balances them.",
  "the bond deepens them.",
  "the bond widens their horizon.",
  "the bond steadies them for the long climb.",
  "the bond frees them into friendship.",
  "the bond softens them.",
];
export const MANGAL_NOTE = (v: V) =>
  ` Mangala stands in one of the marriage houses, the old texts' mangal dosha: heat in the bond. It asks for a partner with fire of their own, and patience in the first years.`;

// ── the yogas ───────────────────────────────────────────────────────────────
export const YOGA_TEXT: Record<string, (v: V) => string> = {
  gajakesari: (v) => `Guru stands in a kendra from ${v.pos} Chandra: dignity that compounds, a name that outlives its bearer.`,
  budhaditya: () => `Surya and Budha share a sign: intellect lit from within, sharpest when speaking for something larger than itself.`,
  chandramangala: (v) => `Chandra and Mangala stand together: feeling and drive in one harness; ${v.subj} earn through initiative and spend through mood.`,
  kemadruma: (v) => `The Moon stands alone, the Kemadruma mark: ${v.pos} inner weather is ${v.pos} own to carry. It builds self-reliance the hard way, and company must be chosen on purpose.`,
  ruchaka: (v) => `Mangala dignified in a kendra, the Ruchaka mark of the five great persons: courage as a constitution; ${v.subj} are built for the campaign.`,
  bhadra: (v) => `Budha dignified in a kendra, the Bhadra mark of the five great persons: the complete mind; wit, memory, and speech in rare balance.`,
  hamsa: (v) => `Guru dignified in a kendra, the Hamsa mark of the five great persons: the swan among the reeds; wisdom that rooms defer to without being told.`,
  malavya: (v) => `Shukra dignified in a kendra, the Malavya mark of the five great persons: grace as an inheritance; beauty, comfort, and love attend the life.`,
  sasa: (v) => `Shani dignified in a kendra, the Sasa mark of the five great persons: command that comes with age; ${v.subj} are trusted with what others would drop.`,
};

// ── section tooltips ────────────────────────────────────────────────────────
export const KINDRED_TIP =
  "The classical ashta-koota accord, moon to moon, out of 36: eight harmonies from caste of temperament to pulse. Counted between full members only, and only when both charts are complete. The old use is betrothal; the Council's use is knowing who to sit beside.";
export const MUHURTA_TIP =
  "Muhurta is the art of choosing the hour. These days are computed from tara bala, the Moon's daily mansion counted from the birth star, on days whose ruling planet is a friend of the lagna lord. Favourable days suit signings, askings, and beginnings.";
export const YOGAS_TIP =
  "Classical planetary patterns, detected in the chart itself. Only the yogas truly present are named; most charts hold one or two.";

// ── methodology ─────────────────────────────────────────────────────────────
export const KUNDLI_METHOD_1 =
  "Positions come from the Council's verified natal engine, shifted by the Lahiri ayanamsa, the Indian national standard, to give the Vedic sky. Rahu and Ketu are the mean lunar node. Houses are whole-sign from the Lagna; the Navamsa follows the classical ninefold division; the Vimshottari dasha is timed from the Moon's nakshatra at birth with its true balance.";
export const KUNDLI_METHOD_2 =
  "Every passage is written once, by hand, and chosen by the chart itself. The arithmetic is guarded by a verification suite checked against published reference values. Where a birth time or place is missing, the chart shows nothing rather than an estimate.";
