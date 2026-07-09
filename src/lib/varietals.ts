// The Council's grape ledger: the varietals a bottle may carry, and the
// detector that reads them straight out of a wine's name (typos included —
// the annals spell Sauvignon three ways).

export const GRAPES: string[] = [
  // white
  "Chenin Blanc", "Chardonnay", "Sauvignon Blanc", "Riesling", "Viognier",
  "Semillon", "Grenache Blanc", "Verdelho", "Colombar", "Muscat", "Hanepoot",
  "Pinot Grigio", "Roussanne", "Marsanne", "Palomino", "Clairette",
  // red
  "Pinotage", "Pinot Noir", "Cabernet Sauvignon", "Cabernet Franc", "Merlot",
  "Malbec", "Petit Verdot", "Syrah", "Grenache", "Cinsault", "Mourvèdre",
  "Carignan", "Tempranillo", "Sangiovese", "Nebbiolo", "Barbera", "Zinfandel",
  "Touriga Nacional", "Souzao", "Tannat", "Gamay",
];

// Words (lowercase) that betray a grape inside a wine's name. Longer phrases
// are checked first so "cabernet sauvignon" wins before bare "sauvignon".
const ALIASES: [string, string][] = [
  ["cabernet sauvignon", "Cabernet Sauvignon"],
  ["cab sav", "Cabernet Sauvignon"],
  ["cabernet franc", "Cabernet Franc"],
  ["grenache blanc", "Grenache Blanc"],
  ["grenache noir", "Grenache"],
  ["pinot noir", "Pinot Noir"],
  ["pinot grigio", "Pinot Grigio"],
  ["pinot gris", "Pinot Grigio"],
  ["chenin blanc", "Chenin Blanc"],
  ["sauvignon blanc", "Sauvignon Blanc"],
  ["savignon blanc", "Sauvignon Blanc"],
  ["petit verdot", "Petit Verdot"],
  ["touriga nacional", "Touriga Nacional"],
  ["touriga", "Touriga Nacional"],
  ["chenin", "Chenin Blanc"],
  ["chardonnay", "Chardonnay"],
  ["sauvignon", "Sauvignon Blanc"],
  ["savignon", "Sauvignon Blanc"],
  ["cabernet", "Cabernet Sauvignon"],
  ["riesling", "Riesling"],
  ["viognier", "Viognier"],
  ["semillon", "Semillon"],
  ["verdelho", "Verdelho"],
  ["colombar", "Colombar"],
  ["colombard", "Colombar"],
  ["muscat", "Muscat"],
  ["hanepoot", "Hanepoot"],
  ["roussanne", "Roussanne"],
  ["marsanne", "Marsanne"],
  ["palomino", "Palomino"],
  ["clairette", "Clairette"],
  ["pinotage", "Pinotage"],
  ["merlot", "Merlot"],
  ["malbec", "Malbec"],
  ["syrah", "Syrah"],
  ["shiraz", "Syrah"],
  ["grenache", "Grenache"],
  ["cinsault", "Cinsault"],
  ["cinsaut", "Cinsault"],
  ["mourvedre", "Mourvèdre"],
  ["mourvèdre", "Mourvèdre"],
  ["mouverde", "Mourvèdre"],
  ["carignan", "Carignan"],
  ["tempranillo", "Tempranillo"],
  ["sangiovese", "Sangiovese"],
  ["nebbiolo", "Nebbiolo"],
  ["barbera", "Barbera"],
  ["zinfandel", "Zinfandel"],
  ["souzao", "Souzao"],
  ["tannat", "Tannat"],
  ["gamay", "Gamay"],
];

// Read the grapes out of a wine's name. "David & Nadia Grenache" → [Grenache];
// "Madison Barboulot Cabernet Syrah" → [Cabernet Sauvignon, Syrah].
export function detectVarietals(title: string): string[] {
  let low = ` ${title.toLowerCase()} `;
  const found: string[] = [];
  for (const [alias, grape] of ALIASES) {
    if (low.includes(alias)) {
      if (!found.includes(grape)) found.push(grape);
      low = low.split(alias).join(" "); // consume, so "cabernet sauvignon" doesn't also yield bare matches
    }
  }
  return found;
}
