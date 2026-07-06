import { seedMembers } from "./seed";
import type { Member } from "./types";

// The council roster. The seed roster is the base; the Keiser's edits are
// overlaid on top and persisted per-browser in demo (keyed by member id),
// mapping to the `members` table when live. Newly anointed members can also be
// appended here.

const OVERRIDES_KEY = "lcv_member_overrides"; // { [id]: Partial<Member> }
const ADDED_KEY = "lcv_members_added"; // Member[]
const REMOVED_KEY = "lcv_members_removed"; // string[] of member ids cast out

type Overrides = Record<string, Partial<Member>>;

function readOverrides(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}");
  } catch {
    return {};
  }
}

function readAdded(): Member[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ADDED_KEY) || "[]");
  } catch {
    return [];
  }
}

function readRemoved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(REMOVED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function loadMembers(): Member[] {
  const overrides = readOverrides();
  const removed = new Set(readRemoved());
  const base = [...seedMembers, ...readAdded()].filter((m) => !removed.has(m.id));
  return base.map((m) => (overrides[m.id] ? { ...m, ...overrides[m.id] } : m));
}

export function saveMember(id: string, patch: Partial<Member>) {
  if (typeof window === "undefined") return;
  const overrides = readOverrides();
  overrides[id] = { ...overrides[id], ...patch };
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    window.dispatchEvent(new Event("lcv-members"));
  } catch {}
}

// Anoint a petitioner into the roster (as an initiate by default). Idempotent
// on id — re-anointing the same soul won't duplicate them.
export function addMember(member: Member) {
  if (typeof window === "undefined") return;
  const added = readAdded();
  if (added.some((m) => m.id === member.id) || seedMembers.some((m) => m.id === member.id)) return;
  try {
    // Clear any prior removal so a re-anointed soul reappears.
    const removed = readRemoved().filter((id) => id !== member.id);
    localStorage.setItem(REMOVED_KEY, JSON.stringify(removed));
    localStorage.setItem(ADDED_KEY, JSON.stringify([...added, member]));
    window.dispatchEvent(new Event("lcv-members"));
  } catch {}
}

// Cast a member from the roster entirely. Works for both seeded and anointed
// members: added members are dropped from the added list; seeded ones are
// recorded in the removed set so loadMembers() filters them out.
export function removeMember(id: string) {
  if (typeof window === "undefined") return;
  try {
    const added = readAdded().filter((m) => m.id !== id);
    localStorage.setItem(ADDED_KEY, JSON.stringify(added));
    const removed = readRemoved();
    if (!removed.includes(id)) localStorage.setItem(REMOVED_KEY, JSON.stringify([...removed, id]));
    // Tidy up any stale overrides for the departed soul.
    const overrides = readOverrides();
    if (overrides[id]) {
      delete overrides[id];
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    }
    window.dispatchEvent(new Event("lcv-members"));
  } catch {}
}
