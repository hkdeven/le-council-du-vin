import type { Application } from "./types";

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
