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

// Portraits: the cropper produces a data URL; live mode uploads it to the
// public avatars bucket and returns a short cacheable URL, so member queries
// stop hauling base64 images. Demo keeps the data URL (localStorage flow).
export async function uploadAvatar(owner: string, dataUrl: string): Promise<string> {
  if (!gatheringsLive() || !dataUrl.startsWith("data:")) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const safe = owner.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) || "soul";
  const path = `${safe}/${Date.now()}.webp`;
  const { error } = await supabase!.storage.from("avatars").upload(path, blob, { upsert: false, contentType: "image/webp" });
  if (error) throw new Error(error.message);
  return supabase!.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
