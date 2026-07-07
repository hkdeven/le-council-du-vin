import { NextResponse } from "next/server";

// Emails the Keiser when a new petition is submitted. Sends via Resend when
// configured; otherwise it quietly no-ops (safe to ship before Resend is set up).
// Requires env: RESEND_API_KEY, NOTIFY_EMAIL (the Keiser's address). Optional:
// NOTIFY_FROM (a verified Resend sender; defaults to Resend's test sender).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.NOTIFY_FROM || "Le Council du Vin <onboarding@resend.dev>";
  if (!key || !to) return NextResponse.json({ ok: false, skipped: "not configured" });

  let body: { cult_name?: string; email?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const name = String(body.cult_name || "A new soul").slice(0, 200);
  const email = String(body.email || "").slice(0, 200);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `A new petition — ${name}`,
        html:
          `<p><strong>${name}</strong> petitions the Council${email ? ` &middot; ${email}` : ""}.</p>` +
          `<p>Judge them in the Tribunal: <a href="https://lecouncilduvin.co.za/tribunal">lecouncilduvin.co.za/tribunal</a></p>`,
      }),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: await res.text() }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
