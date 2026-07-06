// Share a prepared message to WhatsApp as reliably as possible.
//
// The wa.me/?text= shortlink bounces through a redirect that drops long or
// multi-line texts on some clients (the reported symptom: WhatsApp opens with
// only the trailing URL). So:
//  - on mobile, prefer the native share sheet (WhatsApp receives the full text)
//  - otherwise hit api.whatsapp.com/send directly (no redirect hop)
//  - copy the text to the clipboard as a silent safety net either way
export async function shareToWhatsApp(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {}

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return; // user closed the sheet
      // otherwise fall through to the direct link
    }
  }

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}
