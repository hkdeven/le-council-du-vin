import type { Gathering } from "./types";
import { supabase, isLive, enforceLogin } from "./supabase";

// Gatherings the Keiser has summoned. Live (login enforced + Supabase): the
// `gatherings` table, so every member sees the same meetings and they persist.
// Demo: this browser's localStorage.

const KEY = "lcv_gatherings";
export const gatheringsLive = () => isLive && enforceLogin && !!supabase;

const sortG = (list: Gathering[]) =>
  [...list].sort((a, b) => (a.gather_date || "").localeCompare(b.gather_date || ""));

function localAll(): Gathering[] {
  if (typeof window === "undefined") return [];
  try {
    return sortG(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return [];
  }
}
function localSave(list: Gathering[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sortG(list)));
  } catch {}
}

// Column names match Gathering fields (denormalised table). Only send provided
// keys so a partial update never blanks other columns.
function toRow(g: Partial<Gathering>) {
  const keys: (keyof Gathering)[] = [
    "number", "moon_label", "theme_title", "theme_description", "host_id", "host_name",
    "gather_date", "gather_time", "status", "wine_count", "reveal_photos", "rules_text",
    "threat_text", "venue_instructions", "attendees",
  ];
  const row: Record<string, unknown> = {};
  for (const k of keys) if (g[k] !== undefined) row[k] = g[k];
  return row;
}
function fromRow(r: Record<string, any>): Gathering {
  return {
    id: r.id,
    number: r.number,
    moon_label: r.moon_label || "A moon to come",
    theme_title: r.theme_title || "",
    theme_description: r.theme_description ?? null,
    host_id: r.host_id ?? null,
    host_name: r.host_name ?? null,
    gather_date: r.gather_date,
    gather_time: r.gather_time ?? "19:00",
    status: r.status || "upcoming",
    wine_count: r.wine_count ?? 11,
    reveal_photos: r.reveal_photos ?? null,
    rules_text: r.rules_text ?? null,
    threat_text: r.threat_text ?? null,
    venue_instructions: r.venue_instructions ?? null,
    attendees: r.attendees ?? [],
  };
}

export async function fetchGatherings(): Promise<Gathering[]> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("gatherings").select("*").order("gather_date");
    if (error) {
      console.error("Could not load gatherings:", error.message);
      return [];
    }
    return (data || []).map(fromRow);
  }
  return localAll();
}

export async function fetchCurrentGathering(): Promise<Gathering | null> {
  return (await fetchGatherings())[0] ?? null;
}

// Insert. In live the DB assigns the uuid id, so we return the stored row.
export async function createGathering(g: Gathering): Promise<Gathering> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("gatherings").insert(toRow(g)).select().single();
    if (error) throw new Error(error.message);
    return fromRow(data);
  }
  localSave([...localAll(), g]);
  return g;
}

export async function updateGathering(id: string, patch: Partial<Gathering>): Promise<void> {
  if (gatheringsLive()) {
    const { error } = await supabase!.from("gatherings").update(toRow(patch)).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  localSave(localAll().map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export async function deleteGathering(id: string): Promise<void> {
  if (gatheringsLive()) {
    const { error } = await supabase!.from("gatherings").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  localSave(localAll().filter((m) => m.id !== id));
}
