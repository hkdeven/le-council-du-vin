// Date polls for choosing the next gathering. Live (login enforced + Supabase):
// the `polls` table, with the date options + voters denormalised as jsonb so
// votes are shared and persist. Demo: localStorage.

import type { Poll, DateOption } from "./types";
import { assertWrite } from "./writeLock";
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
  assertWrite();
  if (gatheringsLive()) {
    const { data, error } = await supabase!.from("polls").insert({ title, status: "open", options: [] }).select().single();
    if (error) throw new Error(error.message);
    return fromRow(data);
  }
  const poll: Poll = { id: `poll-${Date.now()}`, title, status: "open", created_at: new Date().toISOString(), options: [] };
  saveLocal([poll, ...localList()]);
  return poll;
}

// Toggle one member's vote on a date. Reads the poll's options fresh right
// before writing so simultaneous voters don't overwrite each other. Returns the
// new options array.
export async function toggleVote(pollId: string, optionId: string, memberId: string): Promise<DateOption[]> {
  assertWrite();
  const flip = (options: DateOption[]) =>
    options.map((o) =>
      o.id === optionId
        ? { ...o, voters: o.voters.includes(memberId) ? o.voters.filter((v) => v !== memberId) : [...o.voters, memberId] }
        : o
    );
  if (gatheringsLive()) {
    const { data } = await supabase!.from("polls").select("options").eq("id", pollId).maybeSingle();
    const next = flip((data?.options as DateOption[]) || []);
    const { error } = await supabase!.from("polls").update({ options: next }).eq("id", pollId);
    if (error) throw new Error(error.message);
    return next;
  }
  const list = localList();
  const p = list.find((x) => x.id === pollId);
  const next = flip(p?.options || []);
  saveLocal(list.map((x) => (x.id === pollId ? { ...x, options: next } : x)));
  return next;
}

export async function updatePoll(id: string, patch: Partial<Poll>): Promise<void> {
  assertWrite();
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
