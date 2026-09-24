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
  // The numbered cloth this offering turned out to be, claimed on the reveal
  // after the cloths lift. Never asked for before the night; null until then.
  cloth?: number | null;
}

const key = (gatheringId: string, memberId: string) => `lcv_bottle_${gatheringId}_${memberId}`;

// Demo entries were once plain title strings; read both shapes forever.
function parseLocal(raw: string | null): Offering | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && "title" in v) {
      return { title: String(v.title || ""), price: v.price ?? null, varietals: Array.isArray(v.varietals) ? v.varietals : [], cloth: typeof v.cloth === "number" ? v.cloth : null };
    }
  } catch {}
  return { title: raw, price: null, varietals: [] };
}

export async function fetchOffering(gatheringId: string, memberId: string): Promise<Offering | null> {
  if (gatheringsLive()) {
    const { data } = await supabase!
      .from("offerings")
      .select("title,price,varietals,cloth")
      .eq("gathering_id", gatheringId)
      .eq("member_id", memberId)
      .maybeSingle();
    if (!data?.title) return null;
    return { title: data.title as string, price: (data.price as number) ?? null, varietals: (data.varietals as string[]) || [], cloth: (data.cloth as number | null) ?? null };
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
    // The refusal must be thrown, not dropped. Convene wraps this call in a
    // .catch that shows "Could not seal your offering", and that catch was dead
    // code while the error sat unread in `error`: the member saw their offering
    // sealed, and the Prophecy went on refusing to speak because the row the
    // gate counts was never written.
    if (t) {
      const { error } = await supabase!.from("offerings").upsert(
        { gathering_id: gatheringId, member_id: memberId, title: t, price: offering!.price, varietals: offering!.varietals },
        { onConflict: "gathering_id,member_id" }
      );
      if (error) throw new Error(error.message);
    } else {
      // Erasing the wine blanks it rather than deleting the row: the row may
      // carry the member's claim on the night (cloth), and un-sealing a wine
      // must never quietly take a claim with it.
      const { error } = await supabase!.from("offerings")
        .update({ title: null, price: null, varietals: null })
        .eq("gathering_id", gatheringId).eq("member_id", memberId);
      if (error) throw new Error(error.message);
    }
    return;
  }
  if (typeof window === "undefined") return;
  try {
    const k = key(gatheringId, memberId);
    const held = parseLocal(localStorage.getItem(k))?.cloth ?? null;
    if (t) localStorage.setItem(k, JSON.stringify({ title: t, price: offering!.price, varietals: offering!.varietals, cloth: held }));
    else if (held != null) localStorage.setItem(k, JSON.stringify({ title: "", price: null, varietals: [], cloth: held }));
    else localStorage.removeItem(k);
  } catch {}
}

// Every offering for a gathering, keyed by member id (reveal, after the cloths
// lift). Only meaningful once the gathering is revealed.
//
// THROWS when the vault does not answer. It once returned {} on a failed read,
// which is indistinguishable from "nobody has claimed": the Keiser's commit
// re-reads the claims through this, and one dropped request at that tap would
// have written every bottle as unclaimed, silently, the old wound by a new
// road. A caller that can live without the answer catches; the commit must not.
export async function fetchAllOfferings(gatheringId: string): Promise<Record<string, Offering>> {
  if (gatheringsLive()) {
    const { data, error } = await supabase!
      .from("offerings")
      .select("member_id,title,price,varietals,cloth")
      .eq("gathering_id", gatheringId);
    if (error) throw new Error(`The offerings would not open: ${error.message}`);
    const out: Record<string, Offering> = {};
    for (const r of data || []) {
      // A row with no title is a claim by a soul who never logged their wine.
      // The claim still stands; the offering form's "unsealed" counts look at
      // the title alone, so such a row changes nothing there.
      if (r.title || r.cloth != null) out[r.member_id as string] = { title: (r.title as string) || "", price: (r.price as number) ?? null, varietals: (r.varietals as string[]) || [], cloth: (r.cloth as number | null) ?? null };
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
        if (v?.title || v?.cloth != null) out[k.slice(prefix.length)] = v;
      }
    }
  } catch {}
  return out;
}

// Claim a numbered cloth as yours on the night, or release it (cloth null).
// The claim lives on YOUR OWN offering row, which you may already write, so
// no door through the annals is needed and nothing waits on the Keiser: the
// Keiser's commit reads every claim off the offerings. The vault holds one
// hand per cloth per night (a unique index), so two souls tapping the same
// bottle in the same breath cannot both hold it.
export async function claimCloth(gatheringId: string, memberId: string, cloth: number | null): Promise<void> {
  assertWrite();
  if (gatheringsLive()) {
    // Upsert, not update: a soul who never logged their wine has no row yet,
    // and their claim must still land. The title stays whatever it was.
    const { error } = await supabase!.from("offerings").upsert(
      { gathering_id: gatheringId, member_id: memberId, cloth },
      { onConflict: "gathering_id,member_id" }
    );
    if (error) {
      if (error.code === "23505") throw new Error("That bottle is already claimed by another hand.");
      throw new Error(error.message);
    }
    return;
  }
  if (typeof window === "undefined") return;
  try {
    const k = key(gatheringId, memberId);
    const cur = parseLocal(localStorage.getItem(k)) || { title: "", price: null, varietals: [] };
    localStorage.setItem(k, JSON.stringify({ ...cur, cloth }));
  } catch {}
}
