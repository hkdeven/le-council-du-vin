import type { Application } from "./types";
import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

// Petitions for initiation. Persisted per-browser in demo so a submitted rite
// shows up in the Keiser's tribunal; maps to the `applications` table when live.

const KEY = "lcv_applications";

export function loadApplications(): Application[] {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]") as Application[];
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return [];
  }
}

function writeAll(list: Application[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("lcv-applications"));
  } catch {}
}

export function addApplication(app: Application) {
  writeAll([app, ...loadApplications()]);
}

export function updateApplication(id: string, patch: Partial<Application>) {
  writeAll(loadApplications().map((a) => (a.id === id ? { ...a, ...patch } : a)));
}

// When a member is cast from the Council, drop their petition too so they no
// longer linger on the tribunal's decided list.
export async function deleteApplicationsByEmail(email: string): Promise<void> {
  if (gatheringsLive()) {
    await supabase!.from("applications").delete().eq("email", email);
    return;
  }
  writeAll(loadApplications().filter((a) => a.email !== email));
}

// Count of petitions still awaiting the Keiser's decree (for the nav badge).
export async function fetchPendingCount(): Promise<number> {
  if (gatheringsLive()) {
    const { count } = await supabase!.from("applications").select("*", { count: "exact", head: true }).eq("status", "pending");
    return count || 0;
  }
  return loadApplications().filter((a) => a.status === "pending").length;
}
