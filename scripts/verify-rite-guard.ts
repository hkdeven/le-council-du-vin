// The rite's screen decision, held to the rule that broke the first gathering:
// the writable scoring card is reachable ONLY when every state it depends on is
// genuinely known. Exhaustive over all 32 combinations, so no state can be
// forgotten rather than merely untested.

import { riteScreen, screenCanWrite, type RiteState, type RiteScreen } from "../src/lib/riteScreen";

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`PASS  ${label}${detail ? " : " + detail : ""}`); }
  else { failed++; console.log(`FAIL  ${label}${detail ? " : " + detail : ""}`); }
}

const BOOL = [false, true];
const all: RiteState[] = [];
for (const ready of BOOL)
  for (const hasGathering of BOOL)
    for (const riteOpen of BOOL)
      for (const ballotReady of BOOL)
        for (const sealed of BOOL)
          all.push({ ready, hasGathering, riteOpen, ballotReady, sealed });

check("all 32 state combinations enumerated", all.length === 32, String(all.length));

// ── THE RULE ───────────────────────────────────────────────────────────────
// Nothing unknown may ever reach the writable card.
const writable = all.filter((s) => screenCanWrite(riteScreen(s)));
check(
  "the card is NEVER drawn before the gathering has settled",
  writable.every((s) => s.ready),
  `${writable.filter((s) => !s.ready).length} violations`
);
check(
  "the card is NEVER drawn before the ballot has settled (the bug of the first gathering)",
  writable.every((s) => s.ballotReady),
  `${writable.filter((s) => !s.ballotReady).length} violations`
);
check(
  "the card is NEVER drawn for a sealed reckoning",
  writable.every((s) => !s.sealed),
  `${writable.filter((s) => s.sealed).length} violations`
);
check(
  "the card is NEVER drawn before the rite opens",
  writable.every((s) => s.riteOpen),
  `${writable.filter((s) => !s.riteOpen).length} violations`
);
check(
  "the card is NEVER drawn when there is no gathering",
  writable.every((s) => s.hasGathering),
  `${writable.filter((s) => !s.hasGathering).length} violations`
);
check(
  "exactly ONE state draws the writable card",
  writable.length === 1,
  `${writable.length} states`
);
check(
  "and it is the fully-known, open, unsealed one",
  writable.length === 1 && writable[0].ready && writable[0].hasGathering &&
    writable[0].riteOpen && writable[0].ballotReady && !writable[0].sealed
);

// ── THE EXACT REGRESSION, named ────────────────────────────────────────────
// Reproduced on 11 Sep 2026: sealed ballot of six verdicts reduced to {1:3} by
// one tap 700ms into the page load. Every guard read `if (ready && ...)`, so
// before the fetches resolved all were false and the page fell through.
check(
  "REGRESSION: loading the page with a sealed ballot in flight does not draw the card",
  riteScreen({ ready: true, hasGathering: true, riteOpen: true, ballotReady: false, sealed: true }) === "loading-ballot"
);
check(
  "REGRESSION: the same while the ballot is merely unknown, not yet sealed",
  riteScreen({ ready: true, hasGathering: true, riteOpen: true, ballotReady: false, sealed: false }) === "loading-ballot"
);
check(
  "REGRESSION: nothing known at all draws the waiting mark, never the card",
  riteScreen({ ready: false, hasGathering: false, riteOpen: false, ballotReady: false, sealed: false }) === "loading-gathering"
);
check(
  "REGRESSION: a gathering still loading cannot show 'no gathering' either",
  riteScreen({ ready: false, hasGathering: false, riteOpen: true, ballotReady: true, sealed: false }) !== "no-gathering"
);

// ── ORDER OF PRECEDENCE ────────────────────────────────────────────────────
check("an unsettled gathering outranks every other state",
  all.filter((s) => !s.ready).every((s) => riteScreen(s) === "loading-gathering"));
check("no gathering outranks the clock and the ballot",
  riteScreen({ ready: true, hasGathering: false, riteOpen: true, ballotReady: true, sealed: true }) === "no-gathering");
check("the closed clock outranks the ballot",
  riteScreen({ ready: true, hasGathering: true, riteOpen: false, ballotReady: true, sealed: false }) === "not-open");
check("the closed clock is shown even to a sealed member",
  riteScreen({ ready: true, hasGathering: true, riteOpen: false, ballotReady: true, sealed: true }) === "not-open");
check("a settled sealed ballot shows the read-only reckoning",
  riteScreen({ ready: true, hasGathering: true, riteOpen: true, ballotReady: true, sealed: true }) === "sealed");

// ── TOTALITY ───────────────────────────────────────────────────────────────
const KNOWN: RiteScreen[] = ["loading-gathering", "no-gathering", "not-open", "loading-ballot", "sealed", "card"];
check("every state resolves to a known screen, none to undefined",
  all.every((s) => KNOWN.includes(riteScreen(s))));
check("the decision is pure: the same state always gives the same screen",
  all.every((s) => riteScreen({ ...s }) === riteScreen({ ...s })));
const reached = new Set(all.map(riteScreen));
check("every screen is reachable (no dead branch)", KNOWN.every((k) => reached.has(k)),
  [...reached].join(", "));
check("only the card may write", KNOWN.filter(screenCanWrite).join(",") === "card");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
