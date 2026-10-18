// Reading a wine from a photograph of its label.
//
// A member photographs the bottle; the label gives the producer, the wine and
// the vintage, a search gives the grape when the label is silent and a
// typical South African retail price, and all three fields come back FILLED
// BUT EDITABLE. Nothing is sealed without the member looking at it.
//
// The one honest caveat, carried into the page's own wording: the price is
// what the wine typically SELLS for, not what this member paid. The Council's
// coin and purse measure spending, so the figure is offered as a suggestion
// and the member's own number always wins.
//
// Everything in this file is pure: the prompt, and the reading of the answer.
// scripts/verify-label.ts holds it to account. The call itself lives in
// src/app/api/offering/label/route.ts.

import { detectVarietals } from "./varietals";

export interface LabelReading {
  title: string; // producer, wine and vintage, as one line
  grape: string; // one or more varietals, comma separated
  price: number | null; // rand, typical retail, never what they paid
  priceNote: string; // where the figure came from, in a few words
  confident: boolean; // false when the label could not really be read
}

export const LABEL_PROMPT = `You are reading a photograph of a wine bottle for a South African wine club.

Identify the wine from the label. Then search the web to fill in anything the label does not say and to find what the wine typically sells for in South Africa today.

Answer with ONE JSON object and nothing else, in this exact shape:

{"title":"Producer Wine Name Vintage","grape":"Cabernet Sauvignon, Merlot","price":780,"priceNote":"typical SA retail","confident":true}

Rules:
- "title" is the producer, the wine's name and the vintage year on one line, exactly as a person would write it. No quotes, no extra words.
- "grape" is the varietal or varietals. Read them off the label when they are there; otherwise find what this wine is made from. Comma separated. Empty string if genuinely unknown.
- "price" is a NUMBER of South African rand, the typical current retail price of this exact wine and vintage in South Africa. No currency symbol, no range: give one figure. Use null if you cannot find a real price. Never guess a round number to fill the field.
- "priceNote" is at most six words saying where the figure comes from, for example "typical SA retail" or "from two SA retailers".
- "confident" is false if the photograph is too blurred, too dark or too partial to actually read the label, or if you are naming a wine you are not sure of. Say false rather than inventing a bottle.

Return the JSON object alone.`;

// The model is asked for bare JSON and usually gives it, but a stray sentence
// or a fenced block must not cost the member their photograph.
export function parseLabelAnswer(raw: string): LabelReading | null {
  if (!raw) return null;
  const text = raw.trim();
  // Take the outermost braces: that survives a preamble, a fence, or both.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const title = clean(o.title, 200);
  const grapeRaw = clean(o.grape, 200);
  // A reading with no wine in it is no reading.
  if (!title) return null;

  return {
    title,
    grape: tidyGrapes(grapeRaw, title),
    price: readPrice(o.price),
    priceNote: clean(o.priceNote, 60),
    // Absent means "did not say", and a model that did not say is not a
    // model that said yes: the page should warn rather than assume.
    confident: o.confident !== false,
  };
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

// "R780", "780,00", "about 780" and 780 all mean the same thing. A range
// ("650-800") takes the lower figure: better to under-promise a price the
// member is about to correct anyway.
export function readPrice(v: unknown): number | null {
  if (typeof v === "number") return sanePrice(v);
  if (typeof v !== "string") return null;
  const first = v.replace(/,(?=\d{3}\b)/g, "").replace(/,/g, ".").match(/\d+(?:\.\d+)?/);
  return first ? sanePrice(Number(first[0])) : null;
}

const sanePrice = (n: number): number | null =>
  Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null;

// Grapes the Council already knows are spelled the Council's way, so the
// codex can count them; anything it does not know is kept as written rather
// than thrown away, exactly as the typed field does.
export function tidyGrapes(grape: string, title: string): string {
  const known = [...new Set([...detectVarietals(grape), ...detectVarietals(title)])];
  if (known.length) return known.join(", ");
  return grape
    .split(/[,/]| and /i)
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
}

// What the page says under a filled-in price. The wording is the whole point:
// this is what the wine sells for, not what the member paid.
export const priceCaveat = (note: string): string =>
  `${note || "typical retail"}, not what you paid. Change it if you paid something else.`;
