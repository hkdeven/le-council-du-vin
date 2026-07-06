import { seedMembers } from "./seed";
import type { Member } from "./types";

// The council roster. The seed roster is the base; the Keiser's edits are
// overlaid on top and persisted per-browser in demo (keyed by member id),
// mapping to the `members` table when live. Newly anointed members can also be
// appended here.

const OVERRIDES_KEY = "lcv_member_overrides"; // { [id]: Partial<Member> }
const ADDED_KEY = "lcv_members_added"; // Member[]

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

export function loadMembers(): Member[] {
  const overrides = readOverrides();
  const base = [...seedMembers, ...readAdded()];
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
    localStorage.setItem(ADDED_KEY, JSON.stringify([...added, member]));
    window.dispatchEvent(new Event("lcv-members"));
  } catch {}
}
