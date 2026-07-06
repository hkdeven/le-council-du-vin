// Sun sign + element from a date of birth, and an approximate rising sign from
// the time of birth. The rising calc is the common casual approximation: at
// sunrise (~6am) the ascendant equals the sun sign, advancing one sign per ~2
// hours. It ignores birth location, so it's a playful estimate, not an ephemeris.

export interface Sign {
  name: string;
  symbol: string;
  element: "Fire" | "Earth" | "Air" | "Water";
}

const SIGNS: (Sign & { from: [number, number]; to: [number, number] })[] = [
  { name: "Aries", symbol: "♈", element: "Fire", from: [3, 21], to: [4, 19] },
  { name: "Taurus", symbol: "♉", element: "Earth", from: [4, 20], to: [5, 20] },
  { name: "Gemini", symbol: "♊", element: "Air", from: [5, 21], to: [6, 20] },
  { name: "Cancer", symbol: "♋", element: "Water", from: [6, 21], to: [7, 22] },
  { name: "Leo", symbol: "♌", element: "Fire", from: [7, 23], to: [8, 22] },
  { name: "Virgo", symbol: "♍", element: "Earth", from: [8, 23], to: [9, 22] },
  { name: "Libra", symbol: "♎", element: "Air", from: [9, 23], to: [10, 22] },
  { name: "Scorpio", symbol: "♏", element: "Water", from: [10, 23], to: [11, 21] },
  { name: "Sagittarius", symbol: "♐", element: "Fire", from: [11, 22], to: [12, 21] },
  { name: "Capricorn", symbol: "♑", element: "Earth", from: [12, 22], to: [1, 19] },
  { name: "Aquarius", symbol: "♒", element: "Air", from: [1, 20], to: [2, 18] },
  { name: "Pisces", symbol: "♓", element: "Water", from: [2, 19], to: [3, 20] },
];

export function sunSign(dateStr: string): Sign | null {
  const parts = dateStr.split("-").map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return null;
  for (const s of SIGNS) {
    const [fm, fd] = s.from;
    const [tm, td] = s.to;
    if (fm <= tm) {
      if ((m === fm && d >= fd) || (m === tm && d <= td)) return s;
    } else {
      // Capricorn wraps the year end
      if ((m === fm && d >= fd) || (m === tm && d <= td)) return s;
    }
  }
  return null;
}

export function risingSign(dateStr: string, timeStr: string): Sign | null {
  const sun = sunSign(dateStr);
  if (!sun) return null;
  const [hh, mm] = timeStr.split(":").map(Number);
  if (Number.isNaN(hh)) return null;
  const hours = hh + (mm || 0) / 60;
  const steps = Math.floor(((((hours - 6) % 24) + 24) % 24) / 2);
  const sunIdx = SIGNS.findIndex((s) => s.name === sun.name);
  return SIGNS[(sunIdx + steps) % 12];
}

// --- Moon sign -------------------------------------------------------
// Geocentric ecliptic longitude of the Moon (Schlyter's low-precision method,
// with the main perturbations — good to ~0.1°, ample for a 30° sign bin).
const RAD = Math.PI / 180;
const rev = (x: number) => x - Math.floor(x / 360) * 360;

function moonLongitude(y: number, m: number, d: number, ut: number): number {
  const day = 367 * y - Math.floor((7 * (y + Math.floor((m + 9) / 12))) / 4) + Math.floor((275 * m) / 9) + d - 730530 + ut / 24;
  const N = rev(125.1228 - 0.0529538083 * day);
  const i = 5.1454;
  const w = rev(318.0634 + 0.1643573223 * day);
  const a = 60.2666;
  const e = 0.0549;
  const M = rev(115.3654 + 13.0649929509 * day);
  const Ms = rev(356.047 + 0.9856002585 * day);
  const ws = 282.9404 + 4.70935e-5 * day;
  const E = M + (180 / Math.PI) * e * Math.sin(M * RAD) * (1 + e * Math.cos(M * RAD));
  const xv = a * (Math.cos(E * RAD) - e);
  const yv = a * (Math.sqrt(1 - e * e) * Math.sin(E * RAD));
  const v = rev((Math.atan2(yv, xv) / RAD));
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (Math.cos(N * RAD) * Math.cos((v + w) * RAD) - Math.sin(N * RAD) * Math.sin((v + w) * RAD) * Math.cos(i * RAD));
  const yh = r * (Math.sin(N * RAD) * Math.cos((v + w) * RAD) + Math.cos(N * RAD) * Math.sin((v + w) * RAD) * Math.cos(i * RAD));
  let lon = rev(Math.atan2(yh, xh) / RAD);
  const Lm = rev(N + w + M);
  const Ls = rev(Ms + ws);
  const Dm = rev(Lm - Ls);
  const F = rev(Lm - N);
  lon += -1.274 * Math.sin((M - 2 * Dm) * RAD);
  lon += 0.658 * Math.sin(2 * Dm * RAD);
  lon += -0.186 * Math.sin(Ms * RAD);
  lon += -0.059 * Math.sin((2 * M - 2 * Dm) * RAD);
  lon += -0.057 * Math.sin((M - 2 * Dm + Ms) * RAD);
  lon += 0.053 * Math.sin((M + 2 * Dm) * RAD);
  lon += 0.046 * Math.sin((2 * Dm - Ms) * RAD);
  lon += 0.041 * Math.sin((M - Ms) * RAD);
  lon += -0.035 * Math.sin(Dm * RAD);
  lon += -0.031 * Math.sin((M + Ms) * RAD);
  lon += -0.015 * Math.sin((2 * F - 2 * Dm) * RAD);
  lon += 0.011 * Math.sin((M - 4 * Dm) * RAD);
  return rev(lon);
}

export function moonSign(dateStr: string, timeStr?: string): Sign | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  let ut = 12; // noon if no time given
  if (timeStr) {
    const [hh, mm] = timeStr.split(":").map(Number);
    if (!Number.isNaN(hh)) ut = hh + (mm || 0) / 60;
  }
  const lon = moonLongitude(y, m, d, ut);
  return SIGNS[Math.floor(lon / 30) % 12];
}

// --- Chinese zodiac (Shengxiao) + five elements (Wu Xing) ------------
export interface Animal { name: string; symbol: string }
const ANIMALS: Animal[] = [
  { name: "Rat", symbol: "鼠" }, { name: "Ox", symbol: "牛" }, { name: "Tiger", symbol: "虎" },
  { name: "Rabbit", symbol: "兔" }, { name: "Dragon", symbol: "龙" }, { name: "Snake", symbol: "蛇" },
  { name: "Horse", symbol: "马" }, { name: "Goat", symbol: "羊" }, { name: "Monkey", symbol: "猴" },
  { name: "Rooster", symbol: "鸡" }, { name: "Dog", symbol: "狗" }, { name: "Pig", symbol: "猪" },
];

export function shengxiao(dateStr: string): Animal | null {
  const y = Number(dateStr.split("-")[0]);
  if (!y) return null;
  return ANIMALS[(((y - 4) % 12) + 12) % 12];
}

export interface WuXing { name: string; symbol: string; meaning: string }
export const WU_XING: Record<string, WuXing> = {
  Wood: { name: "Wood", symbol: "木", meaning: "Symbolizes growth, vitality, and flexibility. People with a Wood element are highly creative, compassionate, and generous, with a persistent drive for innovation." },
  Fire: { name: "Fire", symbol: "火", meaning: "Represents passion, energy, and dynamism. Those ruled by Fire are natural leaders, enthusiastic, decisive, and highly assertive." },
  Earth: { name: "Earth", symbol: "土", meaning: "Stands for stability, nourishment, and reliability. Earth signs are practical, patient, dependable, and highly focused on creating secure foundations." },
  Metal: { name: "Metal", symbol: "金", meaning: "Embodies structure, determination, and persistence. People with a Metal element are courageous, ambitious, and possess a strong inner strength to withstand challenges." },
  Water: { name: "Water", symbol: "水", meaning: "Symbolizes fluidity, intuition, and wisdom. Water signs are highly adaptable, communicative, sensitive, and tapped into their inner emotions." },
};

export function wuXing(dateStr: string): WuXing | null {
  const y = Number(dateStr.split("-")[0]);
  if (!y) return null;
  const byDigit = ["Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth"];
  return WU_XING[byDigit[y % 10]];
}
