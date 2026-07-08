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

// Filler words that must never reach the Nose cloud — articles, pronouns,
// auxiliaries, hedges — plus wine-context noise that says nothing about scent
// (every note mentions "wine", "nose", "smells"). Applied wherever free text
// becomes aroma words: the rite's custom-aroma field, whispered notes, and
// imported history's comments.
const STOP = new Set([
  // articles / conjunctions / prepositions / pronouns
  "a", "an", "the", "and", "or", "but", "nor", "of", "in", "on", "at", "to",
  "for", "with", "without", "from", "by", "as", "than", "then", "into", "over",
  "under", "out", "off", "up", "down", "after", "before", "between", "because",
  "though", "although", "if", "when", "while", "what", "which", "who", "how",
  "it", "its", "this", "that", "these", "those", "there", "here", "their",
  "they", "them", "he", "she", "his", "her", "hers", "we", "us", "our", "ours",
  "you", "your", "yours", "i", "me", "my", "mine",
  // being / doing / hedging
  "is", "was", "were", "are", "be", "been", "being", "am", "isnt", "wasnt",
  "have", "has", "had", "do", "does", "did", "done", "doesnt", "dont", "didnt",
  "get", "gets", "got", "can", "cant", "cannot", "could", "couldnt", "will",
  "wont", "would", "wouldnt", "should", "shouldnt", "must", "might", "may",
  "think", "thought", "need", "needs", "needed", "seems", "seemed", "maybe",
  "perhaps", "probably", "prob", "approx", "approximately", "about", "around",
  "like", "likes", "liked", "im", "ive", "id", "youre", "hes", "shes", "theyre",
  // quantity / degree filler
  "so", "too", "very", "quite", "just", "bit", "really", "rather", "some",
  "any", "no", "not", "none", "more", "most", "less", "least", "much", "many",
  "few", "lot", "lots", "also", "again", "still", "yet", "even", "ever",
  "never", "always", "all", "both", "each", "only", "own", "same", "other",
  "another", "slight", "slightly", "hint", "touch", "somewhat", "kind", "sort",
  // bare-opinion words that would drown the cloud
  "nice", "good", "bad", "fine", "ok", "okay", "well", "yes", "better", "best",
  "worse", "worst", "wow", "meh", "hmm",
  // wine-context noise
  "wine", "wines", "nose", "smell", "smells", "smelled", "smelling", "taste",
  "tastes", "tasted", "tasting", "glass", "drink", "drinking", "vintage",
]);

// Tokenise free text into cloud-worthy words: lowercase, letters only,
// no fillers, no numbers, nothing under 3 characters.
export function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zÀ-ɏ]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

// Clean a typed aroma ("a hint of black cherry" → "black cherry"). Multi-word
// aromas survive with their fillers removed; returns "" if nothing real is left.
export function cleanAromaText(text: string): string {
  return meaningfulWords(text).join(" ");
}

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
