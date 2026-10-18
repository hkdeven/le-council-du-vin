import { NextResponse } from "next/server";
import { bearerOf } from "@/lib/offeringLink";
import { LABEL_PROMPT, parseLabelAnswer } from "@/lib/labelRead";

// Reading a wine off a photographed label, so a member need not type.
//
// The same token guards this as guards the offering itself: one soul, one
// night, and refused once the cloths have lifted. The photograph is sent to
// Anthropic and STORED NOWHERE, here or in the vault. What comes back fills
// the three fields; the member edits and seals them, so nothing the model
// says reaches the record unseen.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // a label read with a search behind it is not instant

const MODEL = "claude-sonnet-5-5";
// Netlify caps a function's request body at 6 MB, and base64 inflates by a
// third, so the decoded image must stay under about 4.5 MB for the request
// itself to arrive. 4 MB leaves room for the rest of the body. The page
// normally sends a quarter of a megabyte; this is the ceiling, not the aim.
const MAX_BYTES = 4 * 1024 * 1024;
const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, skipped: "not configured" });

  const body = (await req.json().catch(() => ({}))) as { t?: string; image?: string; mediaType?: string };
  // The same development-only fixture the offering route carries, so a label
  // can be read on a machine that has no service role key. Shut in any
  // production build, and whenever login enforcement is on.
  const fixture = body.t === "demo" && process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENFORCE_LOGIN === "false";
  const who = fixture ? null : await bearerOf(body.t || "");
  if (!fixture && !who) return bad("This link is no longer good.", 404);
  if (who?.closed) return bad("The cloths have already lifted on this night.", 409);

  // Accept a bare base64 payload or a whole data URL, since a browser gives
  // the latter and it is easy to forward by mistake.
  const raw = (body.image || "").trim();
  const dataUrl = raw.match(/^data:([^;,]+);base64,(.*)$/s);
  const b64 = (dataUrl ? dataUrl[2] : raw).replace(/\s+/g, "");
  const mediaType = (dataUrl ? dataUrl[1] : body.mediaType || "image/jpeg").toLowerCase();
  if (!b64) return bad("No photograph arrived.");
  if (!OK_TYPES.has(mediaType)) return bad("That is not a photograph the Council can read.");
  // base64 runs about a third larger than the bytes it carries.
  if (b64.length * 0.75 > MAX_BYTES) return bad("That photograph is too large. Try again and it will be shrunk first.");

  const callAnthropic = async (withSearch: boolean) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        // The search is what turns a label into a grape and a price. Without
        // it the label alone still gives the wine and the vintage.
        ...(withSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }] } : {}),
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
            { type: "text", text: withSearch ? LABEL_PROMPT : LABEL_PROMPT.replace("Then search the web to fill in anything the label does not say and to find what the wine typically sells for in South Africa today.", "Fill in what you can from the label and from what you already know.") },
          ],
        }],
      }),
    });
    return res;
  };

  let res = await callAnthropic(true);
  // If the search tool is not available to this key, the wine is still worth
  // reading: fall back to the label alone rather than failing the member.
  let searched = true;
  if (!res.ok && res.status === 400) {
    searched = false;
    res = await callAnthropic(false);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("label read failed", res.status, detail.slice(0, 500));
    return bad("The label could not be read just now. Type the wine in, or try again in a moment.", 502);
  }

  const answer = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const text = (answer?.content || []).filter((c) => c.type === "text").map((c) => c.text || "").join("\n");
  const reading = parseLabelAnswer(text);
  if (!reading) {
    return bad("The label could not be made out. Type the wine in, or try a clearer photograph.", 422);
  }

  return NextResponse.json({ ok: true, reading, searched });
}
