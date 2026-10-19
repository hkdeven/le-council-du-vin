import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/offeringLink";
import { speakProphecy } from "@/lib/prophecy";
import type { AnnalEntry } from "@/lib/annals";
import type { HistoryBallot } from "@/lib/ballots";
import type { Offering } from "@/lib/bottles";

// THE VINE READS THE ROOM, ON THE SERVER.
//
// The Prophecy weighs every wine logged for the coming night: the grapes, the
// prices, the hands that carried them. It used to do that in the Keiser's own
// browser, which meant his browser had to be able to read every member's
// sealed offering, which meant the vault had to allow it, which meant ANY
// signed-in soul could read them too (see "The sealed offering, sealed in
// earnest" in supabase/policies.sql).
//
// Now the reading happens here, with the service role, and what comes back is
// the verdict alone: one name. Nobody's wine leaves this function. The vine
// may know what no soul at the table may know, which is rather the point of a
// vine.

export const dynamic = "force-dynamic";

async function callerIsKeiser(req: Request): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!url || !anon || !token) return false;
  try {
    const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await sb.auth.getUser();
    const email = u?.user?.email;
    if (!email) return false;
    const { data: m } = await sb.from("members").select("role,active").ilike("email", email).maybeSingle();
    return m?.role === "keiser" && m.active !== false;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const { gatheringId } = (await req.json().catch(() => ({}))) as { gatheringId?: string };
  if (!gatheringId) return NextResponse.json({ ok: false, error: "No gathering named." }, { status: 400 });
  // Only the Keiser consults the vine, exactly as the button has always been.
  if (!(await callerIsKeiser(req))) {
    return NextResponse.json({ ok: false, error: "Only the Keiser may consult the vine." }, { status: 403 });
  }
  const db = serviceClient();
  if (!db) return NextResponse.json({ ok: false, skipped: "not configured" });

  const [{ data: g }, { data: members }, { data: offRows }, { data: annalRows }, { data: ballotRows }] = await Promise.all([
    db.from("gatherings").select("attendees").eq("id", gatheringId).maybeSingle(),
    db.from("members").select("id,cult_name,active"),
    db.from("offerings").select("member_id,title,price,varietals,cloth").eq("gathering_id", gatheringId),
    db.from("annals").select("gathering_id,number,theme,date,rows,committed_at"),
    db.from("ballots").select("gathering_id,member_id,scores,sealed"),
  ]);
  if (!g) return NextResponse.json({ ok: false, error: "No such gathering." }, { status: 404 });

  // A sleeping seat is never waited on and never weighed, just as the
  // convening counts it.
  const asleep = new Set((members || []).filter((m) => m.active === false).map((m) => m.id as string));
  const attendees = ((g.attendees as string[]) || []).filter((id) => !asleep.has(id));

  const offerings: Record<string, Offering> = {};
  for (const r of offRows || []) {
    if (!r.title && r.cloth == null) continue;
    offerings[r.member_id as string] = {
      title: (r.title as string) || "",
      price: (r.price as number) ?? null,
      varietals: (r.varietals as string[]) || [],
      cloth: (r.cloth as number | null) ?? null,
    };
  }

  // The gate the button has always had: the vine speaks only with full
  // knowledge of the room. Enforced here as well as on the page, since the
  // page can no longer see the offerings to check for itself.
  const unsealed = attendees.filter((id) => !offerings[id]?.title).length;
  if (attendees.length === 0) {
    return NextResponse.json({ ok: false, refusal: "The vine speaks only once souls have answered the call, and none have yet." });
  }
  if (unsealed > 0) {
    return NextResponse.json({ ok: false, refusal: `The vine holds its tongue: ${unsealed} of ${attendees.length} offerings remain unsealed.` });
  }

  const verdict = speakProphecy({
    attendees,
    offerings,
    members: (members || []).map((m) => ({ id: m.id as string, cult_name: (m.cult_name as string) || "" })),
    annals: (annalRows || []).map((a) => ({
      gatheringId: a.gathering_id as string,
      number: a.number as number,
      theme: (a.theme as string) || "",
      date: (a.date as string) || "",
      rows: (a.rows as AnnalEntry["rows"]) || [],
      committed_at: (a.committed_at as string) || "",
    })),
    ballots: (ballotRows || []).map((b) => ({
      gatheringId: b.gathering_id as string,
      memberId: b.member_id as string,
      scores: (b.scores as Record<number, number>) || {},
      sealed: !!b.sealed,
    })) as HistoryBallot[],
    nowMs: Date.now(),
  });

  if (!verdict) return NextResponse.json({ ok: false, refusal: "The vine holds its tongue: it has too little history to speak from." });
  // The verdict alone. No wine, no price, no grape leaves this function.
  return NextResponse.json({ ok: true, verdict });
}
