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
    "number", "moon_label", "theme_title", "theme_description", "host_id", "host_name", "host2_id", "host2_name",
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
    host2_id: r.host2_id ?? null,
    host2_name: r.host2_name ?? null,
    gather_date: r.gather_date,
    gather_time: r.gather_time ?? "19:00",
    status: r.status || "upcoming",
    wine_count: r.wine_count ?? 6,
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

// The meeting the rite and reveal operate on: the soonest one that is today or
// still to come; if every meeting is in the past, the most recent one (so the
// last reveal/codex still resolves). Prevents a concluded meeting from staying
// "current" once a later one exists.
export function pickCurrent(all: Gathering[]): Gathering | null {
  if (all.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = all.find((g) => (g.gather_date || "") >= today);
  return upcoming ?? all[all.length - 1];
}

export async function fetchCurrentGathering(): Promise<Gathering | null> {
  return pickCurrent(await fetchGatherings());
}

// The rite of judgement opens 30 minutes after the scheduled start — time for
// souls to gather and pour before scoring. Before then no one may enter.
const RITE_DELAY_MS = 30 * 60 * 1000;
export function riteOpensAt(g: Gathering): Date {
  return new Date(new Date(`${g.gather_date}T${g.gather_time || "19:00"}`).getTime() + RITE_DELAY_MS);
}
export function isRiteOpen(g: Gathering | null): boolean {
  if (!g) return false;
  const t = riteOpensAt(g).getTime();
  return !Number.isNaN(t) && Date.now() >= t;
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

// Toggle one member's RSVP. Reads the current attendees fresh right before
// writing so two people RSVPing at once don't overwrite each other's entry.
// Returns the new attendee list.
export async function toggleAttendee(gatheringId: string, memberId: string): Promise<string[]> {
  if (gatheringsLive()) {
    const { data } = await supabase!.from("gatherings").select("attendees").eq("id", gatheringId).maybeSingle();
    const current: string[] = (data?.attendees as string[]) || [];
    const next = current.includes(memberId) ? current.filter((x) => x !== memberId) : [...current, memberId];
    const { error } = await supabase!.from("gatherings").update({ attendees: next }).eq("id", gatheringId);
    if (error) throw new Error(error.message);
    return next;
  }
  const list = localAll();
  const g = list.find((m) => m.id === gatheringId);
  const current = g?.attendees || [];
  const next = current.includes(memberId) ? current.filter((x) => x !== memberId) : [...current, memberId];
  localSave(list.map((m) => (m.id === gatheringId ? { ...m, attendees: next } : m)));
  return next;
}

export async function deleteGathering(id: string): Promise<void> {
  if (gatheringsLive()) {
    const { error } = await supabase!.from("gatherings").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  localSave(localAll().filter((m) => m.id !== id));
}

// A member's most recent hosting date, crediting BOTH hosts of a gathering
// (co-hosts share the wheel), with the profile's last_hosted as the floor.
export function effectiveLastHosted(
  member: { id: string; cult_name: string; last_hosted?: string | null },
  gatherings: Gathering[],
  nowMs = Date.now()
): string | null {
  let last = member.last_hosted || null;
  for (const g of gatherings) {
    if (!g.gather_date || new Date(g.gather_date).getTime() > nowMs) continue;
    const hosted = g.host_id === member.id || g.host_name === member.cult_name ||
      g.host2_id === member.id || g.host2_name === member.cult_name;
    if (hosted && (!last || g.gather_date > last)) last = g.gather_date;
  }
  return last;
}
