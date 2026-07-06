// Date polls for choosing the next gathering. Live (login enforced + Supabase):
// the `polls` table, with the date options + voters denormalised as jsonb so
// votes are shared and persist. Demo: localStorage.

import type { Poll } from "./types";
import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

const KEY = "lcv_polls";

function localList(): Poll[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as Poll[]; } catch { return []; }
}
function saveLocal(list: Poll[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}
function fromRow(r: Record<string, any>): Poll {
  return { id: r.id, title: r.title, status: r.status, created_at: r.created_at, options: r.options || [] };
}

export async function fetchPolls(): Promise<Poll[]> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("polls").select("*").order("created_at", { ascending: false });
    if (error) { console.error("Could not load polls:", error.message); return []; }
    return (data || []).map(fromRow);
  }
  return [...localList()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createPoll(title: string): Promise<Poll> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("polls").insert({ title, status: "open", options: [] }).select().single();
    if (error) throw new Error(error.message);
    return fromRow(data);
  }
  const poll: Poll = { id: `poll-${Date.now()}`, title, status: "open", created_at: new Date().toISOString(), options: [] };
  saveLocal([poll, ...localList()]);
  return poll;
}

export async function updatePoll(id: string, patch: Partial<Poll>): Promise<void> {
  if (gatheringsLive()) {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.options !== undefined) row.options = patch.options;
    if (patch.title !== undefined) row.title = patch.title;
    const { error } = await supabase!.from("polls").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  saveLocal(localList().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}
