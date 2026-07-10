// Checks for the dossier's attendance arithmetic: standing a moon is proven
// by a sealed ballot OR by owning a bottle in the night's annal, future
// nights never break a run, and the codex "bottles judged" rule.
//
//   npx tsx scripts/verify-dossier.ts

import { computeDossier, type DossierInputs } from "../src/lib/dossier";
import type { AnnalEntry, AnnalRow } from "../src/lib/annals";
import type { Gathering } from "../src/lib/types";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const NOW = new Date("2026-07-10T12:00:00Z").getTime();
const g = (id: string, date: string): Gathering => ({ id, gather_date: date, status: "revealed" } as unknown as Gathering);
const row = (owner: string, opts: Partial<AnnalRow> = {}): AnnalRow => ({ cloth: 1, owner, title: owner ? "A wine" : "", score: 0, votes: 0, rank: null, dq: false, ...opts });
const annal = (gid: string, date: string, rows: AnnalRow[]): AnnalEntry => ({ gatheringId: gid, number: 1, theme: "t", date, rows, committed_at: date });

const KEISER = { id: "m1", cult_name: "The Keiser" };
const base = (over: Partial<DossierInputs>): DossierInputs => ({
  member: KEISER,
  members: [KEISER, { id: "m2", cult_name: "Seer Matthew" }],
  gatherings: [], annals: [], ballots: [], dq: {}, nowMs: NOW,
  ...over,
});

// 17 nights of which: 15 have his sealed ballot, 2 (imported/unscored) only
// carry his bottle in the annal. He stood all 17.
{
  const gatherings: Gathering[] = [];
  const annals: AnnalEntry[] = [];
  const ballots: DossierInputs["ballots"] = [];
  for (let i = 1; i <= 17; i++) {
    const gid = `g${i}`, date = `2025-${String(((i - 1) % 12) + 1).padStart(2, "0")}-15`;
    gatherings.push(g(gid, date));
    annals.push(annal(gid, date, [row("The Keiser", { score: 8, votes: i <= 15 ? 5 : 0, rank: i <= 15 ? 1 : null })]));
    if (i <= 15) ballots.push({ gatheringId: gid, memberId: "m1", sealed: true, scores: { 1: 8 } } as unknown as DossierInputs["ballots"][number]);
  }
  const d = computeDossier(base({ gatherings, annals, ballots }));
  check("owns wine in 17 nights, ballots in 15: moons stood = 17", d.moonsStood === 17, String(d.moonsStood));
}

// Ballot-only attendance still counts (he judged but brought nothing).
{
  const d = computeDossier(base({
    gatherings: [g("g1", "2025-01-15")],
    annals: [annal("g1", "2025-01-15", [row("Seer Matthew", { score: 8, votes: 5, rank: 1 })])],
    ballots: [{ gatheringId: "g1", memberId: "m1", sealed: true, scores: { 1: 8 } } as unknown as DossierInputs["ballots"][number]],
  }));
  check("ballot without a bottle still stands the moon", d.moonsStood === 1, String(d.moonsStood));
}

// A night he missed entirely counts for nobody's stood total.
{
  const d = computeDossier(base({
    gatherings: [g("g1", "2025-01-15")],
    annals: [annal("g1", "2025-01-15", [row("Seer Matthew")])],
  }));
  check("a missed night is not stood", d.moonsStood === 0, String(d.moonsStood));
}

// A summoned FUTURE gathering must not break the communion run.
{
  const gatherings = [g("g1", "2025-01-15"), g("g2", "2025-02-15"), g("gFuture", "2026-12-25"), g("g3", "2025-03-15")];
  const ballots = ["g1", "g2", "g3"].map((gid) => ({ gatheringId: gid, memberId: "m1", sealed: true, scores: { 1: 8 } } as unknown as DossierInputs["ballots"][number]));
  const d = computeDossier(base({ gatherings, ballots }));
  check("future gathering breaks no run: communion = 3", d.communion === 3, String(d.communion));
}

// The gap in real attendance DOES break the run.
{
  const gatherings = [g("g1", "2025-01-15"), g("g2", "2025-02-15"), g("g3", "2025-03-15"), g("g4", "2025-04-15")];
  const ballots = ["g1", "g3", "g4"].map((gid) => ({ gatheringId: gid, memberId: "m1", sealed: true, scores: { 1: 8 } } as unknown as DossierInputs["ballots"][number]));
  const d = computeDossier(base({ gatherings, ballots }));
  check("a true absence breaks the run: communion = 2", d.communion === 2, String(d.communion));
}

// An annal night whose gathering row is missing still counts (defensive).
{
  const d = computeDossier(base({
    annals: [annal("g-orphan", "2025-05-15", [row("The Keiser")])],
  }));
  check("annal-only night (no gathering row) still stands", d.moonsStood === 1, String(d.moonsStood));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
