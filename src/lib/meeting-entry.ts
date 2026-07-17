// Manual meeting entry (the Keiser recording or amending a night in the
// codex): validation and reckoning as PURE functions, so the verify suite
// (scripts/verify-meeting-entry.ts) exercises exactly what the entry path
// runs. validateMeetingDraft() gates every seal — blank required data is
// rejected loudly, never silently counted as 0 or skipped (ticket #4).

import type { AnnalRow } from "./annals";

// The editor's raw field values, as typed. Everything arrives as strings;
// null/undefined are tolerated (and treated as blank) so a malformed caller
// can never smuggle a phantom zero past the checks.
export interface DraftRowInput {
  cloth: string;
  title: string;
  owner: string;
  score: string;
  dq: boolean;
  votes: number;
  varietals: string[];
  price: string;
}

export interface MeetingDraftInput {
  number: number;
  theme: string;
  date: string;
  rows: DraftRowInput[];
}

const str = (v: unknown): string => (v == null ? "" : String(v)).trim();

// A row with nothing on it (no name, no owner, no score, no mark) is a
// leftover blank, not a wine; it is dropped, never an error.
export const isBlankRow = (r: DraftRowInput): boolean =>
  !str(r.title) && !str(r.owner) && !str(r.score) && !r.dq && !(r.varietals?.length) && !str(r.price);

export const keptRows = (rows: DraftRowInput[]): DraftRowInput[] => rows.filter((r) => !isBlankRow(r));

const rowName = (r: DraftRowInput, i: number) => str(r.title) || str(r.owner) || (str(r.cloth) ? `cloth ${str(r.cloth)}` : `wine ${i + 1}`);

// Every reason the record refuses the seal. Empty means it may pass.
export function validateMeetingDraft(d: MeetingDraftInput): string[] {
  const errors: string[] = [];
  if (!str(d.theme)) errors.push("The theme is required.");
  if (!str(d.date)) errors.push("The date is required.");
  else if (Number.isNaN(new Date(str(d.date)).getTime())) errors.push(`"${str(d.date)}" is not a date the codex can keep.`);
  if (!Number.isFinite(d.number) || d.number < 1) errors.push("The gathering number must be 1 or higher.");

  const kept = keptRows(d.rows || []);
  if (!kept.length) errors.push("At least one wine must be recorded.");

  // A night is "scored" the moment any wine carries a score; from then on a
  // non-DQ wine listed without one is a partial row, not an unscored night.
  const anyScored = kept.some((r) => str(r.score) !== "");

  const cloths = new Map<number, number>();
  const owners = new Map<string, number>();
  kept.forEach((r, i) => {
    const name = rowName(r, i);
    const score = str(r.score);
    if (score !== "") {
      const n = Number(score);
      if (!Number.isFinite(n)) errors.push(`${name}: "${score}" is not a score.`);
      else if (n < 0 || n > 10) errors.push(`${name}: the score must lie between 0 and 10.`);
    } else if (anyScored && !r.dq) {
      errors.push(`${name}: listed without a score. Score it, mark it off theme, or remove the row.`);
    }
    const cloth = str(r.cloth);
    if (cloth !== "") {
      const c = Number(cloth);
      if (!Number.isInteger(c) || c < 1) errors.push(`${name}: the cloth must be a whole number of 1 or higher.`);
      else {
        if (cloths.has(c)) errors.push(`Cloth ${c} is recorded twice: every pour carries its own number.`);
        cloths.set(c, (cloths.get(c) || 0) + 1);
      }
    }
    const owner = str(r.owner);
    if (owner) {
      if (owners.has(owner)) errors.push(`${owner} is credited twice: one bottle per soul per night.`);
      owners.set(owner, (owners.get(owner) || 0) + 1);
    }
    const price = str(r.price);
    if (price !== "" && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      errors.push(`${name}: "${price}" is not a price.`);
    }
  });
  return [...new Set(errors)];
}

// The seal itself: blanks dropped, ranks recomputed from the scores
// (competition style — ties share, DQs unranked) exactly as the reveal would
// have judged it. An empty or whitespace-only score means "never judged":
// votes drop to 0 so the codex shows "—" and averages skip the row — it is
// NEVER a real 0.0. A DQ'd wine keeps any score it was given (the record
// remembers) but takes no rank and can never be crowned.
export function reckonRows(rows: DraftRowInput[]): AnnalRow[] {
  const kept = keptRows(rows);
  const scored = kept.filter((r) => !r.dq && str(r.score) !== "").map((r) => Number(str(r.score)));
  return kept.map((r) => {
    const score = str(r.score);
    const cloth = str(r.cloth);
    const price = str(r.price);
    return {
      // A blank cloth means the pouring order was never known; record nothing.
      cloth: cloth !== "" && Number.isFinite(Number(cloth)) ? Number(cloth) : null,
      title: str(r.title),
      owner: str(r.owner),
      score: score === "" ? 0 : Number(score),
      votes: score === "" ? 0 : r.votes || 1,
      dq: r.dq,
      rank: r.dq || score === "" ? null : 1 + scored.filter((s) => s > Number(score)).length,
      varietals: r.varietals?.length ? r.varietals : undefined,
      price: price !== "" && Number.isFinite(Number(price)) ? Number(price) : undefined,
    };
  });
}
