import { supabase } from "./supabase";

// Client helper: asks the server to send one of the Council's branded emails.
// Attaches the Keiser's Supabase token so the server can verify the sender.
export async function sendEmail(
  type: "anoint" | "elevate" | "invite" | "expulsion",
  to: string | string[],
  params: Record<string, unknown> = {}
): Promise<{ ok: boolean; sent?: number; failed?: number; skipped?: string; error?: string }> {
  let token: string | undefined;
  try {
    token = (await supabase?.auth.getSession())?.data.session?.access_token;
  } catch {}
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ type, to, params }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
