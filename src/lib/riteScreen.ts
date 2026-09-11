// WHICH SCREEN THE RITE DRAWS, and nothing else.
//
// This lives apart from the component for one reason: the worst bug the Council
// has had was a mistake in exactly this decision, and inline JSX guards cannot
// be tested. On the first true gathering a sealed reckoning could be wiped by
// one tap. The August mend guarded the sealed ballot only once it had LOADED,
// and every guard was written `if (ready && ...)`, so while the page was still
// loading all of them were false and it fell through to `card`: a live,
// writable scoring card shown to a member whose rite might not be open, whose
// gathering might not exist, and whose reckoning might already be sealed.
//
// THE RULE, and the whole point of this file: `card` is the ONLY screen that
// can write to a ballot, so it must be the LAST thing reachable and must never
// be reachable while anything it depends on is still unknown. Any state that is
// not yet known resolves to a waiting screen, never to the card.
//
// Guarded by scripts/verify-rite-guard.ts.

export type RiteScreen =
  | "loading-gathering" // the gathering has not come back yet
  | "no-gathering" // there is genuinely no gathering to judge
  | "not-open" // the rite opens 30 minutes after the gathering convenes
  | "loading-ballot" // the member's own ballot has not come back yet
  | "sealed" // a sealed reckoning is final: read-only
  | "card"; // the writable scoring card

export interface RiteState {
  /** The fetch for the current gathering has settled (either way). */
  ready: boolean;
  /** Whether a gathering exists. Only meaningful once `ready`. */
  hasGathering: boolean;
  /** Whether the rite's clock has opened. Only meaningful once `ready`. */
  riteOpen: boolean;
  /** This member's ballot fetch has settled (either way). */
  ballotReady: boolean;
  /** Whether that ballot is sealed. Only meaningful once `ballotReady`. */
  sealed: boolean;
}

export function riteScreen(s: RiteState): RiteScreen {
  if (!s.ready) return "loading-gathering";
  if (!s.hasGathering) return "no-gathering";
  if (!s.riteOpen) return "not-open";
  if (!s.ballotReady) return "loading-ballot";
  if (s.sealed) return "sealed";
  return "card";
}

/** Whether a screen can write to the ballot. Only ever the card. */
export function screenCanWrite(screen: RiteScreen): boolean {
  return screen === "card";
}
