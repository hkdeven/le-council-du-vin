// Each member may privately log the wine they plan to bring to a gathering —
// with an optional price and grape, which feed the codex and the Reckoning.
// It is hidden from every other soul — including the Keiser — until the reveal.
// Live (login enforced + Supabase): the `offerings` table. Demo: localStorage
// (per-browser, so inherently private).

import { supabase } from "./supabase";
import { assertWrite } from "./writeLock";
import { gatheringsLive } from "./gatherings";

export interface Offering {
  title: string;
  price: number | null;
  varietals: string[];
}

const key = (gatheringId: string, memberId: string) => `lcv_bottle_${gatheringId}_${memberId}`;

// Demo entries were once plain title strings; read both shapes forever.
function parseLocal(raw: string | null): Offering | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && "title" in v) {
      return { title: String(v.title || ""), price: v.price ?? null, varietals: Array.isArray(v.varietals) ? v.varietals : [] };
    }
  } catch {}
  return { title: raw, price: null, varietals: [] };
}

export async function fetchOffering(gatheringId: string, memberId: string): Promise<Offering | null> {
  if (gatheringsLive()) {
    const { data } = await supabase!
      .from("offerings")
      .select("title,price,varietals")
      .eq("gathering_id", gatheringId)
      .eq("member_id", memberId)
      .maybeSingle();
    if (!data?.title) return null;
    return { title: data.title as string, price: (data.price as number) ?? null, varietals: (data.varietals as string[]) || [] };
  }
  if (typeof window === "undefined") return null;
  try {
    return parseLocal(localStorage.getItem(key(gatheringId, memberId)));
  } catch {
    return null;
  }
}

export async function saveOffering(gatheringId: string, memberId: string, offering: Offering | null): Promise<void> {
  assertWrite();
  const t = offering?.title.trim() || "";
  if (gatheringsLive()) {
    if (t) {
      await supabase!.from("offerings").upsert(
        { gathering_id: gatheringId, member_id: memberId, title: t, price: offering!.price, varietals: offering!.varietals },
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
    if (t) localStorage.setItem(k, JSON.stringify({ title: t, price: offering!.price, varietals: offering!.varietals }));
    else localStorage.removeItem(k);
  } catch {}
}

// Every offering for a gathering, keyed by member id (reveal, after the cloths
// lift). Only meaningful once the gathering is revealed.
export async function fetchAllOfferings(gatheringId: string): Promise<Record<string, Offering>> {
  if (gatheringsLive()) {
    const { data } = await supabase!
      .from("offerings")
      .select("member_id,title,price,varietals")
      .eq("gathering_id", gatheringId);
    const out: Record<string, Offering> = {};
    for (const r of data || []) {
      if (r.title) out[r.member_id as string] = { title: r.title as string, price: (r.price as number) ?? null, varietals: (r.varietals as string[]) || [] };
    }
    return out;
  }
  if (typeof window === "undefined") return {};
  const prefix = `lcv_bottle_${gatheringId}_`;
  const out: Record<string, Offering> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        const v = parseLocal(localStorage.getItem(k));
        if (v?.title) out[k.slice(prefix.length)] = v;
      }
    }
  } catch {}
  return out;
}
