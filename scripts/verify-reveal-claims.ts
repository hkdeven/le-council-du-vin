// The reveal's claims, held to the rule that broke two gatherings running:
// a member's claim on the night must reach every other soul at the table,
// and above all the Keiser's commit. The claim is a number on the claimant's
// own offering row; this suite proves the laying-over of those numbers onto
// the tallied rows, which is the only place the record learns an owner.

import { applyClaims, claimantOf, claimedCloth, unnamedClaimants } from "../src/lib/revealClaims";
import type { Offering } from "../src/lib/bottles";

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`PASS  ${label}${detail ? " : " + detail : ""}`); }
  else { failed++; console.log(`FAIL  ${label}${detail ? " : " + detail : ""}`); }
}

const names = { keiser: "The Keiser", larissa: "Priestess Larissa", james: "James" };
const off = (title: string, cloth: number | null, price: number | null = null, varietals: string[] = []): Offering => ({ title, price, varietals, cloth });
type Row = { cloth: number; owner: string; title: string; score: number; votes: number; dq: boolean; varietals?: string[]; price?: number | null };
const bare = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ cloth: i + 1, owner: "", title: "", score: 7, votes: 3, dq: false }));

// ── THE NIGHT AS IT HAPPENED: three souls, three claims, none by the Keiser ─
{
  const offerings = { larissa: off("Meerlust Rubicon", 2, 350, ["Cabernet"]), james: off("Kanonkop", 3), keiser: off("Vergelegen", 1) };
  const out = applyClaims(bare(3), offerings, names);
  check("every claim reaches the rows, not only the Keiser's", out.map((r) => r.owner).join("|") === "The Keiser|Priestess Larissa|James", out.map((r) => r.owner).join("|"));
  check("the claimant's logged wine is carried onto the bottle", out[1].title === "Meerlust Rubicon" && out[2].title === "Kanonkop");
  check("price and grapes ride along with the claim", out[1].price === 350 && out[1].varietals?.[0] === "Cabernet");
  check("a claim with no price leaves the price unset, not null-as-zero", out[2].price === undefined);
  check("rows are not mutated in place", bare(3)[1].owner === "");
}

// ── NOTHING CLAIMED ────────────────────────────────────────────────────────
{
  const out = applyClaims(bare(3), { larissa: off("Meerlust Rubicon", null) }, names);
  check("an offering with no cloth claims nothing", out.every((r) => r.owner === ""));
  check("no claims: rows come back as they were", JSON.stringify(out) === JSON.stringify(bare(3)));
}

// ── THE KEISER'S HAND IS FINAL ─────────────────────────────────────────────
{
  const rows = bare(2); rows[0].owner = "James"; rows[0].title = "Keiser wrote this";
  const out = applyClaims(rows, { larissa: off("Meerlust Rubicon", 1) }, names);
  check("a name the Keiser wrote by hand is never overwritten by a claim", out[0].owner === "James" && out[0].title === "Keiser wrote this");
  const rows2 = bare(1); rows2[0].title = "Renamed by the Keiser";
  const out2 = applyClaims(rows2, { larissa: off("Meerlust Rubicon", 1, 100, ["Shiraz"]) }, names);
  check("the claim fills the owner but keeps the Keiser's title", out2[0].owner === "Priestess Larissa" && out2[0].title === "Renamed by the Keiser");
  check("grapes and price still fill in where the Keiser left them blank", out2[0].price === 100 && out2[0].varietals?.[0] === "Shiraz");
}

// ── A SOUL WHO NEVER LOGGED A WINE MAY STILL CLAIM ─────────────────────────
{
  const out = applyClaims(bare(1), { james: off("", 1) }, names);
  check("a claim with no logged wine still names the owner", out[0].owner === "James" && out[0].title === "");
}

// ── A NAME NOT YET READ ────────────────────────────────────────────────────
{
  const out = applyClaims(bare(1), { james: off("Kanonkop", 1) }, {});
  check("a claimant whose name has not loaded is still shown as claimed, unnamed", out[0].owner === "A soul yet unnamed");
}

// ── ONE HAND PER BOTTLE, EVEN WITHOUT THE VAULT (demo mode) ────────────────
{
  const offerings = { larissa: off("A", 1), james: off("B", 1) };
  check("two hands on one cloth: one deterministic winner", claimantOf(offerings, 1) === "james");
  const out = applyClaims(bare(1), offerings, names);
  check("and every viewer sees that same winner", out[0].owner === "James");
}

// ── WHAT IS MINE ───────────────────────────────────────────────────────────
{
  const offerings = { larissa: off("A", 2), james: off("B", null) };
  check("claimedCloth: the cloth I hold", claimedCloth(offerings, "larissa") === 2);
  check("claimedCloth: none when my offering has no cloth", claimedCloth(offerings, "james") === null);
  check("claimedCloth: none when I have no offering at all", claimedCloth(offerings, "keiser") === null);
  check("claimedCloth: none for no member", claimedCloth(offerings, null) === null);
  check("claimantOf: null for an unclaimed cloth", claimantOf(offerings, 5) === null);
}

// ── THE OLD BEHAVIOUR, AS A REGRESSION ─────────────────────────────────────
// Before the fix the Keiser's commit wrote their own local rows: with no
// claims laid over, every hand but their own was "". If that ever comes back,
// this fails.
{
  const offerings = { larissa: off("Meerlust Rubicon", 2), james: off("Kanonkop", 3) };
  const keiserLocal = bare(3); keiserLocal[0].owner = "The Keiser";
  const committed = applyClaims(keiserLocal, offerings, names);
  check("the commit carries every member's claim, not the Keiser's browser alone", committed.filter((r) => r.owner).length === 3, committed.map((r) => r.owner || "(unclaimed)").join("|"));
}

// ── THE COMMIT MUST REFUSE AN UNNAMED CLAIMANT ─────────────────────────────
{
  const offerings = { larissa: off("A", 1), james: off("B", 2), keiser: off("C", null) };
  check("unnamedClaimants: none when every claimant is on the roll", unnamedClaimants(offerings, names).length === 0);
  check("unnamedClaimants: the roll empty (a failed read) names every claimant", unnamedClaimants(offerings, {}).join(",") === "james,larissa");
  check("unnamedClaimants: a soul with no claim is never listed, named or not", !unnamedClaimants(offerings, { larissa: "L", james: "J" }).includes("keiser"));
  check("unnamedClaimants: an empty cult name counts as unnamed", unnamedClaimants(offerings, { larissa: "L", james: "" }).join(",") === "james");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
