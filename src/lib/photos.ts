// Bottle-lineup photos for a gathering. Live (login enforced + Supabase): the
// file is uploaded to a public Storage bucket and its URL is stored on
// gatherings.reveal_photos. Demo: a transient object URL (session-only).

import { supabase } from "./supabase";
import { assertWrite } from "./writeLock";
import { gatheringsLive } from "./gatherings";

const BUCKET = "reveal-photos";

export async function uploadRevealPhoto(gatheringId: string, file: File): Promise<string> {
  // No assertWrite here: photographs of past nights are open to a sleeping
  // hand by decree. The client's bucket rule (OPEN_BUCKETS) and the vault's
  // storage policy both carve `reveal-photos` out of the seal.
  if (gatheringsLive()) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${gatheringId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase!.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    return supabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  return URL.createObjectURL(file);
}

// Take a photograph down: off the night's record, and out of the bucket, so
// no orphan file lingers. The Keiser's hand alone (the codex gates the button,
// and the gatherings update is Keiser-only at the vault).
export async function removeRevealPhoto(gatheringId: string, url: string, keep: string[]): Promise<void> {
  if (!gatheringsLive()) return;
  const { error } = await supabase!.from("gatherings").update({ reveal_photos: keep }).eq("id", gatheringId);
  if (error) throw new Error(error.message);
  // The record is what matters; a failed bucket delete must not undo it.
  const path = url.split(`/${BUCKET}/`)[1];
  if (path) await supabase!.storage.from(BUCKET).remove([decodeURIComponent(path)]).catch(() => {});
}

// Hang a photograph on a night. Goes through add_reveal_photo (SECURITY
// DEFINER, members only, appends one URL and nothing else) rather than a
// gatherings update, so a SLEEPING member may still do it without the seal
// having to open the whole row to them.
export async function attachRevealPhoto(gatheringId: string, url: string): Promise<void> {
  if (!gatheringsLive()) return;
  const { error } = await supabase!.rpc("add_reveal_photo", { gid: gatheringId, url });
  if (error) throw new Error(error.message);
}

// Portraits: the cropper produces a data URL; live mode uploads it to the
// public avatars bucket and returns a short cacheable URL, so member queries
// stop hauling base64 images. Demo keeps the data URL (localStorage flow).
export async function uploadAvatar(owner: string, dataUrl: string): Promise<string> {
  assertWrite();
  if (!gatheringsLive() || !dataUrl.startsWith("data:")) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const safe = owner.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) || "soul";
  const path = `${safe}/${Date.now()}.webp`;
  const { error } = await supabase!.storage.from("avatars").upload(path, blob, { upsert: false, contentType: "image/webp" });
  if (error) throw new Error(error.message);
  return supabase!.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
