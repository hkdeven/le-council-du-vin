// The theme idea-pool. Live (login enforced + Supabase): the `themes` table,
// with favours tracked in `theme_favours` (one row per member per theme). Demo:
// localStorage, seeded from the club's real pool.

import type { Theme } from "./types";
import { assertWrite } from "./writeLock";
import { seedThemes } from "./seed";
import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

export interface PoolTheme extends Theme {
  favouredByMe: boolean;
}

const THEMES_KEY = "lcv_themes";
const FAV_KEY = "lcv_theme_favs";

function localList(): Theme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(THEMES_KEY);
    if (raw) return JSON.parse(raw) as Theme[];
  } catch {}
  return seedThemes.filter((t) => t.status === "pool");
}
function saveLocal(list: Theme[]) {
  try { localStorage.setItem(THEMES_KEY, JSON.stringify(list)); } catch {}
}
function localFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]") as string[]; } catch { return []; }
}
function saveFavs(ids: string[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); } catch {}
}

export async function fetchThemes(myId: string | null): Promise<PoolTheme[]> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("themes").select("*, theme_favours(member_id)").eq("status", "pool");
    if (error) { console.error("Could not load themes:", error.message); return []; }
    return (data || [])
      .map((t: any): PoolTheme => ({
        id: t.id, title: t.title, description: t.description ?? null, status: t.status, created_at: t.created_at,
        favours: (t.theme_favours || []).length,
        favouredByMe: !!myId && (t.theme_favours || []).some((f: any) => f.member_id === myId),
      }))
      .sort((a, b) => b.favours - a.favours);
  }
  const favs = localFavs();
  return localList()
    .map((t) => ({ ...t, favouredByMe: favs.includes(t.id) }))
    .sort((a, b) => b.favours - a.favours);
}

export async function proposeTheme(title: string, description: string | null): Promise<void> {
  assertWrite();
  if (gatheringsLive()) {
    const { error } = await supabase!.from("themes").insert({ title, description, status: "pool" });
    if (error) throw new Error(error.message);
    return;
  }
  saveLocal([...localList(), { id: `t-${Date.now()}`, title, description, status: "pool", favours: 0, created_at: new Date().toISOString() }]);
}

export async function favourTheme(themeId: string, myId: string | null, on: boolean): Promise<void> {
  assertWrite();
  if (gatheringsLive()) {
    if (!myId) return;
    // A favour that was refused must say so: the almanac counts the rows, so a
    // dropped error leaves the member's mark showing on their screen and
    // nowhere else, and the tally they are voting with is a lie.
    const { error } = on
      ? await supabase!.from("theme_favours").upsert({ theme_id: themeId, member_id: myId }, { onConflict: "theme_id,member_id" })
      : await supabase!.from("theme_favours").delete().eq("theme_id", themeId).eq("member_id", myId);
    if (error) throw new Error(error.message);
    return;
  }
  const favs = new Set(localFavs());
  const list = localList();
  const t = list.find((x) => x.id === themeId);
  if (t) { t.favours = Math.max(0, t.favours + (on ? 1 : -1)); }
  if (on) favs.add(themeId); else favs.delete(themeId);
  saveLocal(list);
  saveFavs([...favs]);
}

export async function editTheme(id: string, patch: { title?: string; description?: string | null }): Promise<void> {
  assertWrite();
  if (gatheringsLive()) {
    const { error } = await supabase!.from("themes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  saveLocal(localList().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export async function removeTheme(id: string): Promise<void> {
  assertWrite();
  if (gatheringsLive()) {
    const { error } = await supabase!.from("themes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  saveLocal(localList().filter((t) => t.id !== id));
}
