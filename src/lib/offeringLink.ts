// The link that lets a soul name their bottle without signing in.
//
// Live input fields cannot live inside an email: Gmail, Outlook and Apple Mail
// all strip <form> out of a message body, so anything typed there goes
// nowhere. The summons carries a button instead, and the button opens a page
// of three questions. What makes it one tap rather than a login is this
// token.
//
// It is a bearer credential, so it is kept to the smallest possible power:
//   - it names ONE soul and ONE night, and is minted per pair,
//   - it can write nothing but that soul's own offering for that night,
//   - it lives in `offering_links`, a table with RLS on and no policies, so
//     no member key can read it (every member can read the OFFERINGS table,
//     which is exactly why the token must not sit there),
//   - it is refused once the night has been judged.
//
// SERVER ONLY. Everything here needs the service role key and must never be
// imported into a client component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lecouncilduvin.co.za";

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// 32 bytes of randomness, url-safe. Long enough that guessing is not a
// strategy, short enough to survive a mail client's line wrapping.
const mint = () => randomBytes(24).toString("base64url");

// The soul's own link for this night, made once and reused. Reusing it is the
// point: a second summons must not invalidate the first letter's button.
export async function offeringLinkFor(gatheringId: string, memberId: string): Promise<string | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data: existing } = await db
    .from("offering_links")
    .select("token")
    .eq("gathering_id", gatheringId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (existing?.token) return `${SITE}/offering?t=${existing.token}`;

  const token = mint();
  const { error } = await db.from("offering_links").insert({ token, gathering_id: gatheringId, member_id: memberId });
  if (error) {
    // Two letters sent at once can race for the same pair. The unique
    // constraint is the referee; read back whichever one won.
    const { data: won } = await db
      .from("offering_links").select("token")
      .eq("gathering_id", gatheringId).eq("member_id", memberId).maybeSingle();
    return won?.token ? `${SITE}/offering?t=${won.token}` : null;
  }
  return `${SITE}/offering?t=${token}`;
}

export interface LinkBearer {
  gatheringId: string;
  memberId: string;
  memberName: string;
  gatheringNumber: number;
  theme: string;
  date: string;
  closed: boolean; // the night has been judged; the wine can no longer be named
}

// Trade a token for the soul and the night it names. Returns null for
// anything unknown, which is the only thing a caller is ever told: a token
// that does not resolve is not told why.
export async function bearerOf(token: string): Promise<LinkBearer | null> {
  const db = serviceClient();
  if (!db || !token || token.length < 16 || token.length > 128) return null;
  const { data: link } = await db
    .from("offering_links")
    .select("gathering_id,member_id")
    .eq("token", token)
    .maybeSingle();
  if (!link) return null;

  const [{ data: m }, { data: g }, { data: annal }] = await Promise.all([
    db.from("members").select("cult_name,active").eq("id", link.member_id).maybeSingle(),
    db.from("gatherings").select("number,theme_title,gather_date,status").eq("id", link.gathering_id).maybeSingle(),
    db.from("annals").select("gathering_id").eq("gathering_id", link.gathering_id).maybeSingle(),
  ]);
  if (!m || !g) return null;
  // A sleeping seat writes nothing, by the same decree that governs the app
  // itself. The letter in their inbox must not be a way around the seal.
  if (m.active === false) return null;

  return {
    gatheringId: link.gathering_id,
    memberId: link.member_id,
    memberName: (m.cult_name as string) || "",
    gatheringNumber: (g.number as number) || 0,
    theme: (g.theme_title as string) || "",
    date: (g.gather_date as string) || "",
    closed: !!annal || g.status === "revealed",
  };
}
