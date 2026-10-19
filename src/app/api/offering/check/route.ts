import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerOf, serviceClient } from "@/lib/offeringLink";
import { sameWine, tastedBefore, tastedBeforeWords, alreadyTonightWords } from "@/lib/wineMatch";

// Two questions asked of a wine while a member is still typing it:
//
//   1. Is this bottle already logged for tonight? The answer is a BOOLEAN and
//      nothing else. No name, no count, no cloth: the page is told that a
//      twin exists and is told nothing about whose it is.
//   2. Has the Council tasted it before? The annals are the Council's public
//      record, so that answer may name the night, the bearer and the score.
//
// Neither stops anybody bringing anything.

export const dynamic = "force-dynamic";

async function signedInMemberId(req: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!url || !anon || !token) return null;
  try {
    const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await sb.auth.getUser();
    const email = u?.user?.email;
    if (!email) return null;
    const { data: m } = await sb.from("members").select("id,active").ilike("email", email).maybeSingle();
    return m && m.active !== false ? (m.id as string) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { t?: string; title?: string; gatheringId?: string };
  const title = (body.title || "").trim();
  // Too short to mean anything: a one-word name would match half the codex.
  if (title.length < 4) return NextResponse.json({ ok: true, tonight: false, before: null });

  // The development fixture, so both warnings can be looked at without a
  // real summons. Shut in any production build, as the offering route's is.
  if ((body.t === "demo" || body.t === "demo-sealed") && process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENFORCE_LOGIN === "false") {
    const past = tastedBefore(title, [
      { number: 14, date: "2026-09-12", rows: [{ title, owner: "The Keiser", score: 8.4, votes: 7, rank: 1 }] },
    ]);
    return NextResponse.json({
      ok: true, tonight: true, tonightWords: alreadyTonightWords(),
      before: past.length ? tastedBeforeWords(title, past) : null,
    });
  }

  const db = serviceClient();
  if (!db) return NextResponse.json({ ok: true, tonight: false, before: null, skipped: "not configured" });

  // Either door: the letter's token, or a signed-in member on Convene.
  let gatheringId: string | null = null;
  let memberId: string | null = null;
  if (body.t) {
    const who = await bearerOf(body.t);
    if (!who) return NextResponse.json({ ok: false, error: "This link is no longer good." }, { status: 404 });
    gatheringId = who.gatheringId;
    memberId = who.memberId;
  } else {
    memberId = await signedInMemberId(req);
    if (!memberId) return NextResponse.json({ ok: false, error: "Only a member may ask." }, { status: 403 });
    gatheringId = body.gatheringId || null;
  }

  // 1. Tonight. The member's own row is never counted against them, so
  //    editing your own wine never warns you about yourself.
  let tonight = false;
  if (gatheringId) {
    const { data: offs } = await db
      .from("offerings")
      .select("member_id,title")
      .eq("gathering_id", gatheringId);
    tonight = (offs || []).some((o) => o.member_id !== memberId && o.title && sameWine(title, o.title as string));
  }

  // 2. Every night already in the annals.
  const { data: annals } = await db.from("annals").select("number,date,rows");
  const past = tastedBefore(title, (annals || []) as { number: number; date: string; rows: { title?: string; owner?: string; score?: number; votes?: number; rank?: number | null }[] }[]);

  return NextResponse.json({
    ok: true,
    tonight,
    tonightWords: tonight ? alreadyTonightWords() : null,
    before: past.length ? tastedBeforeWords(title, past) : null,
  });
}
