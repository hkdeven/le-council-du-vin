import type { Gathering } from "./types";
import { assertWrite } from "./writeLock";
import { seedGatherings } from "./seed";
import { supabase, isLive, enforceLogin } from "./supabase";

// Gatherings the Keiser has summoned. Live (login enforced + Supabase): the
// `gatherings` table, so every member sees the same meetings and they persist.
// Demo: this browser's localStorage.

// The hour the Council pours, unless a night says otherwise. One constant,
// because the default was written out by hand in seven places and they could
// drift apart.
export const DEFAULT_GATHER_TIME = "18:30";

const KEY = "lcv_gatherings";
export const gatheringsLive = () => isLive && enforceLogin && !!supabase;

const sortG = (list: Gathering[]) =>
  [...list].sort((a, b) => (a.gather_date || "").localeCompare(b.gather_date || ""));

function localAll(): Gathering[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: Gathering[] = raw == null ? [] : JSON.parse(raw);
    // Demo furniture: the committed seed night rides alongside whatever the
    // browser holds (never duplicated, never persisted over the user's own).
    for (const g of seedGatherings) {
      if (!parsed.some((x) => x.id === g.id)) parsed.push(g);
    }
    return sortG(parsed);
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
    "threat_text", "venue_instructions", "attendees", "declined", "prophecy",
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
    prophecy: r.prophecy ?? null,
    gather_date: r.gather_date,
    gather_time: r.gather_time ?? DEFAULT_GATHER_TIME,
    status: r.status || "upcoming",
    wine_count: r.wine_count ?? 6,
    reveal_photos: r.reveal_photos ?? null,
    rules_text: r.rules_text ?? null,
    threat_text: r.threat_text ?? null,
    venue_instructions: r.venue_instructions ?? null,
    attendees: r.attendees ?? [],
    declined: r.declined ?? [],
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

// THE REVEAL'S OWN PICK. pickCurrent answers "which night are we working
// towards", which is right for the rite and wrong here: the moment a new
// gathering was convened, the reveal followed the new one and last week's
// Reckoning became unreachable, days inside the week it is promised for.
// So the reveal prefers the most recent night that has actually happened and
// whose window is still open, and only falls back to the current gathering
// when no such night remains. Tonight's gathering satisfies both, so nothing
// changes on the night itself.
export function pickReveal(all: Gathering[], nowMs = Date.now()): Gathering | null {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const held = all.filter((g) => (g.gather_date || "") <= today && !revealWindowClosed(g, nowMs));
  return held.length ? held[held.length - 1] : pickCurrent(all);
}

export async function fetchRevealGathering(): Promise<Gathering | null> {
  return pickReveal(await fetchGatherings());
}

// The convening page's stricter pick: only a night still ahead (or tonight)
// that has not been revealed. Unlike pickCurrent there is NO fallback to the
// most recent past night — concluded gatherings live in the codex, never on
// the convene page.
export function pickUpcoming(all: Gathering[]): Gathering | null {
  const today = new Date().toISOString().slice(0, 10);
  return all.find((g) => g.status !== "revealed" && (g.gather_date || "") >= today) ?? null;
}

// The reveal's visibility window (ticket #7): results stay reachable for
// exactly one week after the night ends (midnight after gather_date), then
// the reveal page and its results vanish from the UI entirely — no archive,
// direct links are turned away. The underlying data is untouched: tallies,
// the codex, and every history still read it; only this presentation goes.
export const REVEAL_WINDOW_DAYS = 7;
export function revealWindowClosed(g: Gathering | null, nowMs = Date.now()): boolean {
  if (!g?.gather_date) return false;
  const nightEnd = new Date(`${g.gather_date}T00:00:00`).getTime() + 86400000; // midnight after the night
  if (Number.isNaN(nightEnd)) return false;
  return nowMs >= nightEnd + REVEAL_WINDOW_DAYS * 86400000;
}

// The rite of judgement opens 30 minutes after the scheduled start — time for
// souls to gather and pour before scoring. Before then no one may enter.
const RITE_DELAY_MS = 30 * 60 * 1000;
export function riteOpensAt(g: Gathering): Date {
  return new Date(new Date(`${g.gather_date}T${g.gather_time || DEFAULT_GATHER_TIME}`).getTime() + RITE_DELAY_MS);
}
export function isRiteOpen(g: Gathering | null): boolean {
  if (!g) return false;
  const t = riteOpensAt(g).getTime();
  return !Number.isNaN(t) && Date.now() >= t;
}

// Insert. In live the DB assigns the uuid id, so we return the stored row.
export async function createGathering(g: Gathering): Promise<Gathering> {
  assertWrite();
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("gatherings").insert(toRow(g)).select().single();
    if (error) throw new Error(error.message);
    return fromRow(data);
  }
  localSave([...localAll(), g]);
  return g;
}

export async function updateGathering(id: string, patch: Partial<Gathering>): Promise<void> {
  assertWrite();
  if (gatheringsLive()) {
    const { error } = await supabase!.from("gatherings").update(toRow(patch)).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  localSave(localAll().map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

// One member's answer to a gathering: "yes" (attending), "no" (cannot attend)
// or null (no answer yet). A member sits in at most one of the two lists.
export type RsvpAnswer = "yes" | "no" | null;
export interface RsvpLists { attendees: string[]; declined: string[] }

export function rsvpOf(g: Pick<Gathering, "attendees" | "declined">, memberId: string): RsvpAnswer {
  if ((g.attendees || []).includes(memberId)) return "yes";
  if ((g.declined || []).includes(memberId)) return "no";
  return null;
}

function applyAnswer(cur: RsvpLists, memberId: string, answer: RsvpAnswer): RsvpLists {
  const attendees = cur.attendees.filter((x) => x !== memberId);
  const declined = cur.declined.filter((x) => x !== memberId);
  if (answer === "yes") attendees.push(memberId);
  if (answer === "no") declined.push(memberId);
  return { attendees, declined };
}

// Set one member's RSVP. Reads both lists fresh right before writing so two
// people answering at once don't overwrite each other's entry.
export async function setRsvp(gatheringId: string, memberId: string, answer: RsvpAnswer): Promise<RsvpLists> {
  assertWrite();
  if (gatheringsLive()) {
    // select("*") rather than naming `declined`: until the column is added in
    // Supabase, yes/withdraw must keep working exactly as before.
    const { data, error: readError } = await supabase!.from("gatherings").select("*").eq("id", gatheringId).maybeSingle();
    if (readError) throw new Error(readError.message);
    const hasDeclined = !!data && "declined" in data;
    if (answer === "no" && !hasDeclined) {
      throw new Error("Declining needs the `declined` column on gatherings. Run the line in supabase/schema.sql first.");
    }
    const cur: RsvpLists = {
      attendees: (data?.attendees as string[]) || [],
      declined: (data?.declined as string[]) || [],
    };
    const next = applyAnswer(cur, memberId, answer);
    const patch: Record<string, unknown> = { attendees: next.attendees };
    if (hasDeclined) patch.declined = next.declined;
    // .select() so a write RLS silently refuses (0 rows) surfaces as an error
    // instead of a tick that vanishes on the next refresh.
    const { data: updated, error } = await supabase!.from("gatherings").update(patch).eq("id", gatheringId).select("id");
    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("The record refused the change — likely a missing update permission on gatherings.");
    return next;
  }
  const list = localAll();
  const g = list.find((m) => m.id === gatheringId);
  const next = applyAnswer({ attendees: g?.attendees || [], declined: g?.declined || [] }, memberId, answer);
  localSave(list.map((m) => (m.id === gatheringId ? { ...m, ...next } : m)));
  return next;
}

export async function deleteGathering(id: string): Promise<void> {
  assertWrite();
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
