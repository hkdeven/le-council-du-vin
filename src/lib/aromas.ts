// A bank of 100 typical wine aromas. Each wine shows a small random handful as
// quick-pick prompts (deterministic per gathering+wine so they stay put); the
// taster can always add their own beyond these.

export const AROMAS: string[] = [
  // red / black fruit
  "red cherry", "black cherry", "raspberry", "strawberry", "red plum",
  "blackberry", "blackcurrant", "blueberry", "cranberry", "black plum",
  "mulberry", "boysenberry", "pomegranate", "fig", "prune", "dried cherry",
  // white / tropical / citrus fruit
  "green apple", "red apple", "pear", "quince", "white peach", "yellow peach",
  "apricot", "nectarine", "lemon", "lemon zest", "lime", "grapefruit",
  "orange", "orange peel", "tangerine", "pineapple", "mango", "passion fruit",
  "lychee", "melon", "gooseberry", "banana", "guava", "green fig",
  // dried fruit
  "raisin", "sultana", "dried apricot", "date",
  // floral
  "violet", "rose", "lavender", "jasmine", "orange blossom", "honeysuckle",
  "elderflower", "acacia", "dried flowers", "hibiscus",
  // spice
  "black pepper", "white pepper", "cinnamon", "clove", "nutmeg", "star anise",
  "licorice", "ginger", "cardamom", "allspice", "vanilla",
  // herbal / vegetal
  "mint", "eucalyptus", "thyme", "rosemary", "sage", "fennel", "dill",
  "green bell pepper", "tomato leaf", "fresh grass", "hay", "bay leaf",
  // earth / mineral
  "wet stone", "flint", "chalk", "slate", "graphite", "gravel", "forest floor",
  "mushroom", "truffle", "petrol",
  // oak / roast / nutty
  "cedar", "sandalwood", "coconut", "smoke", "toast", "coffee", "chocolate",
  "caramel", "hazelnut",
  // savory / other
  "leather", "cured meat", "black olive", "honey",
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic 3–4 aromas for a given seed (e.g. `${gatheringId}-${wine}`).
export function aromasFor(seed: string): string[] {
  let x = hash(seed);
  const k = 3 + (x % 2); // 3 or 4
  const picks: string[] = [];
  const used = new Set<number>();
  while (picks.length < k) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const idx = x % AROMAS.length;
    if (!used.has(idx)) {
      used.add(idx);
      picks.push(AROMAS[idx]);
    }
  }
  return picks;
}
