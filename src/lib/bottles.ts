// Each member may privately log the wine they plan to bring to a gathering.
// It is hidden from every other soul — including the Keiser — until the reveal.
// Live (login enforced + Supabase): the `offerings` table. Demo: localStorage
// (per-browser, so inherently private).

import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

const key = (gatheringId: string, memberId: string) => `lcv_bottle_${gatheringId}_${memberId}`;

export async function fetchOffering(gatheringId: string, memberId: string): Promise<string | null> {
  if (gatheringsLive()) {
    const { data } = await supabase!
      .from("offerings")
      .select("title")
      .eq("gathering_id", gatheringId)
      .eq("member_id", memberId)
      .maybeSingle();
    return (data?.title as string) || null;
  }
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key(gatheringId, memberId));
  } catch {
    return null;
  }
}

export async function saveOffering(gatheringId: string, memberId: string, title: string): Promise<void> {
  const t = title.trim();
  if (gatheringsLive()) {
    if (t) {
      await supabase!.from("offerings").upsert(
        { gathering_id: gatheringId, member_id: memberId, title: t },
        { onConflict: "gathering_id,member_id" }
      );
    } else {
      await supabase!.from("offerings").delete().eq("gathering_id", gatheringId).eq("member_id", memberId);
    }
    return;
  }
  if (typeof window === "undefined") return;
  try {
    const k = key(gatheringId, memberId);
    if (t) localStorage.setItem(k, t);
    else localStorage.removeItem(k);
  } catch {}
}

// Every offering for a gathering, keyed by member id (reveal, after the cloths
// lift). Only meaningful once the gathering is revealed.
export async function fetchAllOfferings(gatheringId: string): Promise<Record<string, string>> {
  if (gatheringsLive()) {
    const { data } = await supabase!
      .from("offerings")
      .select("member_id,title")
      .eq("gathering_id", gatheringId);
    const out: Record<string, string> = {};
    for (const r of data || []) if (r.title) out[r.member_id as string] = r.title as string;
    return out;
  }
  if (typeof window === "undefined") return {};
  const prefix = `lcv_bottle_${gatheringId}_`;
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        const v = localStorage.getItem(k);
        if (v) out[k.slice(prefix.length)] = v;
      }
    }
  } catch {}
  return out;
}
