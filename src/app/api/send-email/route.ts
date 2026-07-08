import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { anointEmail, elevateEmail, inviteEmail, expulsionEmail, natalChartEmail, foretellingEmail, Email, InviteParams, NatalEmailParams, ForetellingEmailParams } from "@/lib/emailTemplates";

// Sends the Council's branded emails via Resend. Keiser-triggered types are
// verified as the Keiser (via their Supabase token). Self-send types (natal,
// foretelling) may be sent by any signed-in member, but ONLY to their own
// address — never a relay. No-ops safely until RESEND_API_KEY is set.

export const dynamic = "force-dynamic";

async function callerIdentity(req: Request): Promise<{ email: string | null; keiser: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!url || !anon || !token) return { email: null, keiser: false };
  try {
    const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await sb.auth.getUser();
    const email = u?.user?.email || null;
    if (!email) return { email: null, keiser: false };
    const { data: m } = await sb.from("members").select("role").eq("email", email).maybeSingle();
    return { email, keiser: m?.role === "keiser" };
  } catch {
    return { email: null, keiser: false };
  }
}

const SELF_TYPES = new Set(["natal", "foretelling"]);

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM || "Le Council du Vin <onboarding@resend.dev>";
  if (!key) return NextResponse.json({ ok: false, skipped: "not configured" });

  const { type, to, params } = (await req.json().catch(() => ({}))) as {
    type?: string; to?: string | string[];
    params?: ({ name?: string; count?: number } & InviteParams & NatalEmailParams & ForetellingEmailParams);
  };
  const recipients = Array.from(new Set((Array.isArray(to) ? to : [to]).filter(Boolean) as string[])).slice(0, 200);
  if (!recipients.length) return NextResponse.json({ ok: false, error: "No recipients." }, { status: 400 });

  const caller = await callerIdentity(req);
  if (SELF_TYPES.has(type || "")) {
    // Self-send: any signed-in member, but strictly to their own address.
    const own = caller.email?.toLowerCase();
    if (!own || recipients.length !== 1 || recipients[0].toLowerCase() !== own) {
      return NextResponse.json({ ok: false, error: "This may only be sent to your own inbox." }, { status: 403 });
    }
  } else if (!caller.keiser) {
    return NextResponse.json({ ok: false, error: "Only the Keiser may send this." }, { status: 403 });
  }

  let email: Email;
  switch (type) {
    case "anoint": email = anointEmail(params?.name || ""); break;
    case "elevate": email = elevateEmail(params?.name || ""); break;
    case "invite": email = inviteEmail(params || {}); break;
    case "expulsion": email = expulsionEmail(params?.name || "", params?.count); break;
    case "natal": email = natalChartEmail(params || {}); break;
    case "foretelling": email = foretellingEmail(params || {}); break;
    default: return NextResponse.json({ ok: false, error: "Unknown email type." }, { status: 400 });
  }

  // Send one message per recipient so members never see each other's addresses.
  const results = await Promise.all(recipients.map(async (addr) => {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [addr], subject: email.subject, html: email.html }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }));
  const sent = results.filter(Boolean).length;
  return NextResponse.json({ ok: sent === recipients.length, sent, failed: recipients.length - sent });
}
