// The Major Arcana, with a short reading cast in the Council's voice. Drawn
// deterministically per (wine-event, member) so a member's card is fixed for a
// given gathering but is dealt anew each event.

export interface TarotCard {
  n: number;
  name: string;
  arcana: string;
  reading: string;
}

export const MAJOR_ARCANA: TarotCard[] = [
  { n: 0, name: "The Fool", arcana: "0", reading: "A reckless pour awaits: trust the bottle you cannot name." },
  { n: 1, name: "The Magician", arcana: "I", reading: "Your palate is sharp tonight; what you name, the table will believe." },
  { n: 2, name: "The High Priestess", arcana: "II", reading: "Say little. The wine that wins is the one you keep secret." },
  { n: 3, name: "The Empress", arcana: "III", reading: "Abundance at the table: a generous, opulent vintage favours you." },
  { n: 4, name: "The Emperor", arcana: "IV", reading: "Judge with an iron structure. Tannin and spine will reward you." },
  { n: 5, name: "The Hierophant", arcana: "V", reading: "Honour tradition: the classic region will not betray you this moon." },
  { n: 6, name: "The Lovers", arcana: "VI", reading: "A fated pairing; the bottle beside you holds your kindred vintage." },
  { n: 7, name: "The Chariot", arcana: "VII", reading: "Drive your score with conviction; waver, and you lose the podium." },
  { n: 8, name: "Strength", arcana: "VIII", reading: "Gentle patience unlocks a closed, brooding wine. Wait for it." },
  { n: 9, name: "The Hermit", arcana: "IX", reading: "Withdraw and taste alone; the crowd's favourite will mislead you." },
  { n: 10, name: "Wheel of Fortune", arcana: "X", reading: "Fate turns tonight: an unexpected bottle rises through the ranks." },
  { n: 11, name: "Justice", arcana: "XI", reading: "Score fairly and be scored fairly. Balance returns what you give." },
  { n: 12, name: "The Hanged Man", arcana: "XII", reading: "Reverse your instinct; the wine you dismiss is the one to watch." },
  { n: 13, name: "Death", arcana: "XIII", reading: "An old favourite falls. Make room for a vintage reborn." },
  { n: 14, name: "Temperance", arcana: "XIV", reading: "Blend restraint with pleasure: the balanced pour claims the crown." },
  { n: 15, name: "The Devil", arcana: "XV", reading: "Beware the seductive bottle; its charm hides a flabby finish." },
  { n: 16, name: "The Tower", arcana: "XVI", reading: "A shock at the reveal: a favourite crumbles when the cloth lifts." },
  { n: 17, name: "The Star", arcana: "XVII", reading: "Hope guides your glass; a luminous, mineral wine calls to you." },
  { n: 18, name: "The Moon", arcana: "XVIII", reading: "Illusion clouds the nose. Trust the palate, not the perfume." },
  { n: 19, name: "The Sun", arcana: "XIX", reading: "Radiance is yours: a golden, sun-drenched vintage lifts the table." },
  { n: 20, name: "Judgement", arcana: "XX", reading: "A reckoning of old scores; a past rival's bottle meets its verdict." },
  { n: 21, name: "The World", arcana: "XXI", reading: "The circle completes. Tonight, the finest wine finds its rightful crown." },
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic draw: same event + member => same card; new event => new card.
export function drawFor(eventSeed: string, memberId: string): TarotCard {
  return MAJOR_ARCANA[hash(`${eventSeed}::${memberId}`) % MAJOR_ARCANA.length];
}
