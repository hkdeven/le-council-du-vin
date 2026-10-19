"use client";

// Getting a photograph of a bottle from a member's phone to the Council in a
// shape that can actually be read. Shared by the two places a wine is logged:
// the page a summons opens, and the offering form on Convene.

// A photograph taken on a phone is several megabytes of detail nobody needs
// to read a label, and an iPhone hands over HEIC, which neither Anthropic nor
// this route accepts. So the browser always re-encodes to JPEG and shrinks
// the long edge, which solves both at once:
//
//   - 1568px is the edge above which the model downsizes anyway, so sending
//     more is paid-for detail that is thrown away.
//   - A 12-megapixel iPhone photo of 3 to 5 MB comes out around 250 KB, well
//     under Netlify's 6 MB cap on a function's body (and base64 inflates by
//     a third, so the raw file could not have been sent safely in any case).
//   - HEIC decodes through either path below, because the phone itself has
//     the codec; what leaves the browser is JPEG regardless.
//
// Two decode paths, because neither works everywhere: createImageBitmap is
// the fast one, and an <img> is the one Safari has always had. If both fail
// the member is told plainly rather than being sent a file the route will
// refuse.
const MAX_EDGE = 1568;

async function decode(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource; done: () => void }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap, done: () => bitmap.close?.() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "sync";
      await new Promise<void>((ok, no) => {
        img.onload = () => ok();
        img.onerror = () => no(new Error("undecodable"));
        img.src = url;
      });
      return { width: img.naturalWidth, height: img.naturalHeight, draw: img, done: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
}

export async function shrink(file: File): Promise<{ data: string; mediaType: string }> {
  const { width, height, draw, done } = await decode(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")!.drawImage(draw, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let url = canvas.toDataURL("image/jpeg", quality);
    // A label photographed against a busy table can still be large. Step the
    // quality down rather than the size: text must stay readable.
    while (url.length > 2_800_000 && quality > 0.5) {
      quality -= 0.12;
      url = canvas.toDataURL("image/jpeg", quality);
    }
    return { data: url.slice(url.indexOf(",") + 1), mediaType: "image/jpeg" };
  } finally {
    done();
  }
}
