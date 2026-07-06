"use client";

import { useState } from "react";
import { uploadRevealPhoto } from "@/lib/photos";

// The bottle-lineup photos are real-world images that clash with the site's
// occult theme, so they stay hidden behind a deliberate click. Members can add
// more; clicking a photo opens it full-resolution in a new tab. Broken/missing
// images hide themselves so nothing ever shows as a broken thumbnail. In live
// mode uploads go to Supabase Storage and the URLs persist on the gathering.
export default function BottleReveal({ photos: initial, gatheringId, onPhotos }: {
  photos: string[]; gatheringId?: string; onPhotos?: (next: string[]) => void;
}) {
  const [shown, setShown] = useState(false);
  const [photos, setPhotos] = useState<string[]>(initial);
  const [broken, setBroken] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const onAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !gatheringId) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadRevealPhoto(gatheringId, f));
      const next = [...photos, ...urls];
      setPhotos(next);
      onPhotos?.(next);
    } catch (err) {
      alert(`Could not add the photo: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const visible = photos.filter((p) => !broken.includes(p));

  return (
    <div style={{ marginTop: 22 }}>
      {!shown ? (
        <button className="btn" style={{ fontSize: 14 }} onClick={() => setShown(true)}>
          <i className="ti ti-eye" style={{ marginRight: 6 }} /> Look upon the bottles
        </button>
      ) : (
        <div>
          {visible.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
              {visible.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src + i}
                  src={src}
                  alt={`Bottles of the gathering ${i + 1}`}
                  title="Open full size"
                  onClick={() => window.open(src, "_blank", "noopener")}
                  onError={() => setBroken((b) => [...b, src])}
                  style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line2)", cursor: "pointer", display: "block" }}
                />
              ))}
            </div>
          ) : (
            <p className="whisper" style={{ margin: "0 0 6px", fontSize: 15 }}>No bottles captured yet.</p>
          )}

          <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <label className="btn" style={{ width: "auto", padding: "10px 16px", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
              <i className="ti ti-camera-plus" style={{ marginRight: 6 }} /> {busy ? "Adding…" : "Add photos"}
              <input type="file" accept="image/*" multiple disabled={busy} onChange={onAdd} style={{ display: "none" }} />
            </label>
            <button
              onClick={() => setShown(false)}
              style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15 }}
            >
              <i className="ti ti-eye-off" style={{ marginRight: 5 }} /> Conceal once more
            </button>
          </div>
          {visible.length > 0 && (
            <p className="whisper" style={{ marginTop: 8, fontSize: 13 }}>Tap a photo to open it full size.</p>
          )}
        </div>
      )}
    </div>
  );
}
