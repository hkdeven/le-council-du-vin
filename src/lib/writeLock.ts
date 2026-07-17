// The sleeping seal. A member marked inactive keeps every reading right their
// rank grants, but may write nothing: no profile edits, no ballots, no
// offerings, no RSVPs, no counsel, no claims, no photos.
//
// TWO LOCKS, and the second is the real one:
//
//   1. THE INSTRUMENT (this file). AuthProvider arms the lock when the
//      signed-in member's row reads active = false. The Supabase client itself
//      is wrapped (src/lib/supabase.ts) so that EVERY insert/update/upsert/
//      delete, every writing RPC, and every records bucket throws before it
//      leaves the browser. That wrapping is deliberate: an audit found that
//      most live write paths go straight from a component to supabase and
//      never touch the data-lib functions, so sealing the libs alone sealed
//      almost nothing. Sealing the client seals them all, including any
//      surface built later.
//   2. THE VAULT (supabase/policies.sql). The client-side lock is a courtesy:
//      anyone with devtools can call Supabase directly. The restrictive
//      "sleeping" RLS policies are what actually enforce the decree.
//
// WHAT THE SEAL DOES NOT TOUCH, by decree ("they retain access rights
// according to whatever member level they are presently"):
//   - reading anything their rank allows;
//   - read-only RPCs (reveal_summary);
//   - the `charts` bucket: a chart PNG rendered for their own Heavens email is
//     a self-serving artifact, not a Council record. A sleeping soul may still
//     read their sky and post it to themselves;
//   - Supabase auth (password, sign-in): account security is not a record of
//     the Council, and sleep must never lock a soul out of their own door.

let locked = false;

export function setWriteLock(on: boolean) {
  locked = on;
}

/** Whether the hand is stayed. For UI: disable the control before it is used. */
export function isSealed(): boolean {
  return locked;
}

export const SLEEPING_MESSAGE =
  "Your seat sleeps. The Council remembers you, but a sleeping hand writes nothing.";

export function assertWrite() {
  if (locked) throw new Error(SLEEPING_MESSAGE);
}

// RPCs that only read. Everything else is treated as a write.
const READ_ONLY_RPCS = new Set(["reveal_summary"]);

export function assertRpc(fn: string) {
  if (locked && !READ_ONLY_RPCS.has(fn)) throw new Error(SLEEPING_MESSAGE);
}

// Buckets holding self-serving artifacts rather than the Council's records.
const OPEN_BUCKETS = new Set(["charts"]);

export function assertBucketWrite(bucket: string) {
  if (locked && !OPEN_BUCKETS.has(bucket)) throw new Error(SLEEPING_MESSAGE);
}
