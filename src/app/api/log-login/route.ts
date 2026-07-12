import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Records a login in the gate ledger (ticket #12). The browser calls this
// once per sign-in with its access token; the server verifies the token,
// reads the connection's IP from the proxy headers (the browser could never
// know it), and writes with the service role — login_events has no insert
// policy, so this route is the only door in. No-ops quietly when the service
// key isn't configured.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ ok: false, skipped: "not configured" });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ ok: false, error: "no token" }, { status: 401 });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (userErr || !email) return NextResponse.json({ ok: false, error: "unknown soul" }, { status: 401 });

  // Netlify sets x-nf-client-connection-ip; x-forwarded-for covers the rest.
  const ip =
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;

  const { data: member } = await db.from("members").select("id").eq("email", email).maybeSingle();

  const { error } = await db.from("login_events").insert({
    member_id: member?.id ?? null,
    email,
    user_agent: userAgent,
    ip,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
