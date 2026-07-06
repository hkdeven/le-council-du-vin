// Bottle-lineup photos for a gathering. Live (login enforced + Supabase): the
// file is uploaded to a public Storage bucket and its URL is stored on
// gatherings.reveal_photos. Demo: a transient object URL (session-only).

import { supabase } from "./supabase";
import { gatheringsLive } from "./gatherings";

const BUCKET = "reveal-photos";

export async function uploadRevealPhoto(gatheringId: string, file: File): Promise<string> {
  if (gatheringsLive()) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${gatheringId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase!.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    return supabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  return URL.createObjectURL(file);
}
