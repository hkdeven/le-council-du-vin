import type { Application } from "./types";
import { assertWrite } from "./writeLock";
import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

// Petitions for initiation. Persisted per-browser in demo so a submitted rite
// shows up in the Keiser's tribunal; maps to the `applications` table when live.

const KEY = "lcv_applications";

// The demo tribunal is never bare: a pending petitioner (with a full sky, so
// the Augury reads) and one decided record seed the store on first visit,
// like the rest of the demo's furniture. Live mode never sees these.
const SEED_APPS: Application[] = [
  {
    id: "seed-app-pending", cult_name: "Neophyte Ashwood", email: "ashwood@example.test", oath: true,
    status: "pending", created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    date_of_birth: "1991-03-12", time_of_birth: "14:15", birth_place: "Cape Town, Western Cape, South Africa",
    birth_lat: -33.9249, birth_lon: 18.4241, birth_tz: "Africa/Johannesburg",
    wine_sin: "I once decanted a Jerepigo to impress a date. I am ready to atone.",
    if_wine: "A skin-contact Chenin: orange, divisive, better after an hour of air.",
    draw_reason: "A friend spoke of cloths and reckonings. I want wine with consequences.",
    votes: { "m-matthew": "anoint", "m-martin": "abstain" },
  },
  {
    id: "seed-app-decided", cult_name: "Priestess Larissa", email: "larissa@nightvine.com", oath: true,
    status: "anointed", created_at: "2026-02-01T18:00:00.000Z", anointed_at: "2026-02-03T18:00:00.000Z",
    date_of_birth: "1992-06-14", time_of_birth: "09:45", birth_place: "Pretoria, Gauteng, South Africa",
    birth_lat: -25.7479, birth_lon: 28.2293, birth_tz: "Africa/Johannesburg",
    wine_sin: "I chilled a Pinotage on purpose. Twice.",
    if_wine: "An old-vine Grenache: pale, deceptive, stronger than it looks.",
    draw_reason: "The cloths. Everything should be judged blind at least once.",
    votes: { "m-matthew": "anoint", "m-martin": "anoint", "m-wernardt": "abstain" },
  },
];

export function loadApplications(): Application[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw == null ? null : (JSON.parse(raw) as Application[]);
    if (parsed == null || parsed.length === 0) {
      localStorage.setItem(KEY, JSON.stringify(SEED_APPS));
      return [...SEED_APPS];
    }
    const list = parsed;
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
  assertWrite();
  writeAll([app, ...loadApplications()]);
}

export function updateApplication(id: string, patch: Partial<Application>) {
  assertWrite();
  writeAll(loadApplications().map((a) => (a.id === id ? { ...a, ...patch } : a)));
}

// When a member is cast from the Council, drop their petition too so they no
// longer linger on the tribunal's decided list.
export async function deleteApplicationsByEmail(email: string): Promise<void> {
  assertWrite();
  if (gatheringsLive()) {
    await supabase!.from("applications").delete().eq("email", email);
    return;
  }
  writeAll(loadApplications().filter((a) => a.email !== email));
}

// A member's counsel on a pending petition: one vote each, changeable until
// the decree falls, and kept forever after it. Live mode goes through the
// cast_counsel RPC (security definer) so members can write ONLY their own
// key in the votes column and nothing else on the row.
export async function castCounsel(appId: string, memberId: string, vote: "anoint" | "cast_out" | "abstain"): Promise<string | null> {
  assertWrite();
  if (gatheringsLive()) {
    const { error } = await supabase!.rpc("cast_counsel", { app_id: appId, vote });
    return error ? error.message : null;
  }
  const app = loadApplications().find((a) => a.id === appId);
  if (!app || app.status !== "pending") return "The petition is no longer pending.";
  updateApplication(appId, { votes: { ...(app.votes || {}), [memberId]: vote } });
  return null;
}

// Count of petitions still awaiting the Keiser's decree (for the nav badge).
export async function fetchPendingCount(): Promise<number> {
  if (gatheringsLive()) {
    const { count } = await supabase!.from("applications").select("*", { count: "exact", head: true }).eq("status", "pending");
    return count || 0;
  }
  return loadApplications().filter((a) => a.status === "pending").length;
}
