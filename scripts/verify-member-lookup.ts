// The door. Access is `hasAccess = !!member`, so this decision alone decides
// whether a soul is of the Council. Two failures matter, and the second is
// worse than the first:
//   1. refusing a member their own row (James, six weeks, one capital letter)
//   2. handing a member somebody else's row
// The query uses ilike, which is case-blind but treats _ and % as wildcards,
// so the net is loose ON PURPOSE and this function is what decides.

import { canonicalEmail, pickMemberRow } from "../src/lib/memberLookup";

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`PASS  ${label}${detail ? " : " + detail : ""}`); }
  else { failed++; console.log(`FAIL  ${label}${detail ? " : " + detail : ""}`); }
}
const row = (email: string | null, name = email) => ({ email, cult_name: name });

// ── canonicalEmail ─────────────────────────────────────────────────────────
check("canonical lowercases", canonicalEmail("James@Example.COM") === "james@example.com");
check("canonical trims", canonicalEmail("  a@b.com  ") === "a@b.com");
check("canonical trims AND lowercases", canonicalEmail("  A@B.com ") === "a@b.com");
check("canonical of null is empty", canonicalEmail(null) === "");
check("canonical of undefined is empty", canonicalEmail(undefined) === "");
check("canonical of empty is empty", canonicalEmail("") === "");
check("canonical leaves the address otherwise untouched",
  canonicalEmail("first.last+tag@sub.domain.co.za") === "first.last+tag@sub.domain.co.za");

// ── THE REAL CASE: James, shut out for six weeks ───────────────────────────
const JAMES_STORED = "Jamesmilne.badenhorst@gmail.com"; // as it sat in his row
const JAMES_JWT = "jamesmilne.badenhorst@gmail.com";    // as Supabase hands it over
check("REGRESSION (James): the stored capital letter still matches the JWT address",
  pickMemberRow([row(JAMES_STORED)], JAMES_JWT)?.email === JAMES_STORED);
check("REGRESSION (James): and the reverse, a canonical row against an odd JWT",
  pickMemberRow([row(JAMES_JWT)], JAMES_STORED)?.email === JAMES_JWT);
check("a trailing space in the stored address does not bar the door",
  pickMemberRow([row("lady.levine@gmail.com ")], "lady.levine@gmail.com") !== null);
check("a leading space in the stored address does not bar the door",
  pickMemberRow([row(" lady.levine@gmail.com")], "lady.levine@gmail.com") !== null);
check("SHOUTED storage still matches",
  pickMemberRow([row("KEISER@EXAMPLE.COM")], "keiser@example.com") !== null);

// ── THE WORSE FAILURE: never the wrong soul ────────────────────────────────
// ilike("a_b@x.com") matches aXb@x.com at the database. The net is loose, so
// these prove the decision is not.
check("WILDCARD: _ must not match another soul's row",
  pickMemberRow([row("aXb@x.com")], "a_b@x.com") === null);
check("WILDCARD: _ still matches the genuine row when both are present",
  pickMemberRow([row("aXb@x.com"), row("a_b@x.com")], "a_b@x.com")?.email === "a_b@x.com");
check("WILDCARD: % must not match another soul's row",
  pickMemberRow([row("weirdEXTRAname@x.com")], "weird%name@x.com") === null);
check("WILDCARD: % still matches the genuine row when both are present",
  pickMemberRow([row("weirdEXTRAname@x.com"), row("weird%name@x.com")], "weird%name@x.com")?.email === "weird%name@x.com");
check("a merely similar address is never accepted",
  pickMemberRow([row("james@gmail.com")], "jamesmilne@gmail.com") === null);
check("a different domain is never accepted",
  pickMemberRow([row("a@b.com")], "a@c.com") === null);
check("a substring is never accepted",
  pickMemberRow([row("longer.address@x.com")], "address@x.com") === null);

// ── EMPTY AND BROKEN INPUT: refuse, never guess ────────────────────────────
check("no rows gives null", pickMemberRow([], "a@b.com") === null);
check("null rows gives null", pickMemberRow(null, "a@b.com") === null);
check("undefined rows gives null", pickMemberRow(undefined, "a@b.com") === null);
check("an empty address matches nobody, even an empty stored one",
  pickMemberRow([row("")], "") === null);
check("a null address matches nobody", pickMemberRow([row("a@b.com")], null) === null);
check("a row with a null address is skipped, not crashed on",
  pickMemberRow([row(null), row("a@b.com")], "a@b.com")?.email === "a@b.com");
check("a row with a null address never matches an empty lookup",
  pickMemberRow([row(null)], "") === null);

// ── THE ROSTER CASE: a full member may read every row ──────────────────────
// `members roster read` lets a full member read the whole roll, so the query
// can return many rows. Exactly one must be chosen, and it must be theirs.
const roster = [row("keiser@x.com"), row("Larissa@X.com"), row("martin@x.com"), row("james@x.com")];
check("ROSTER: picks own row out of the whole roll",
  pickMemberRow(roster, "martin@x.com")?.email === "martin@x.com");
check("ROSTER: picks own row despite the roll's odd casing",
  pickMemberRow(roster, "larissa@x.com")?.email === "Larissa@X.com");
check("ROSTER: a stranger against a full roll gets nothing",
  pickMemberRow(roster, "nobody@x.com") === null);
check("ROSTER: never returns the first row as a consolation",
  pickMemberRow(roster, "nobody@x.com") !== roster[0]);

// ── DUPLICATES: deterministic, never random ────────────────────────────────
const dupes = [row("a@b.com", "first"), row("A@B.com", "second")];
check("duplicate canonical rows resolve to the FIRST, deterministically",
  pickMemberRow(dupes, "a@b.com")?.cult_name === "first");
check("and that choice is stable across calls",
  pickMemberRow(dupes, "a@b.com")?.cult_name === pickMemberRow(dupes, "a@b.com")?.cult_name);

// ── PURITY ─────────────────────────────────────────────────────────────────
const input = [row("a@b.com")];
const snapshot = JSON.stringify(input);
pickMemberRow(input, "a@b.com");
check("the rows handed in are never mutated", JSON.stringify(input) === snapshot);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
