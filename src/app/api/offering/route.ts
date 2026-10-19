import { NextResponse } from "next/server";
import { bearerOf, serviceClient } from "@/lib/offeringLink";
import { detectVarietals } from "@/lib/varietals";

// Naming the bottle from the summons: no login, no password, no magic link.
// The token in the letter names one soul and one night; this route trades it
// for that pair and writes nothing else. See src/lib/offeringLink.ts.

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
// A token that does not resolve is told nothing about why. "Expired",
// "wrong night" and "no such token" must read identically from outside.
const UNKNOWN = "This link is no longer good. Open the Council and log your wine there.";

// A standing fixture so the page can be looked at and driven without a real
// summons in hand: the service role key lives only on the server in
// production, so a developer's machine can otherwise never open this page.
// Shut twice over: only outside a production build, and only when login
// enforcement has been explicitly switched off, which production never does.
// "demo" opens an empty form; "demo-sealed" pretends a wine was already
// sealed, so the overwrite confirmation can be walked without a summons.
const FIXTURE_TOKENS = new Set(["demo", "demo-sealed"]);
const fixtureAllowed = () =>
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENFORCE_LOGIN === "false";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") || "";
  if (FIXTURE_TOKENS.has(token) && fixtureAllowed()) {
    return NextResponse.json({
      ok: true, name: "Seer Matthew", numberRoman: "XIX", theme: "Cape Bordeaux Blends",
      date: new Date().toISOString().slice(0, 10), closed: false,
      canReadLabel: !!process.env.ANTHROPIC_API_KEY,
      // `&had=` pretends a wine was already sealed, so the overwrite
      // confirmation can be seen without a real summons.
      offering: token === "demo-sealed"
        ? { title: "Meerlust Rubicon 2018", price: 395, varietals: ["Cabernet Sauvignon"] }
        : { title: "", price: null, varietals: [] },
    });
  }
  const who = await bearerOf(token);
  if (!who) return bad(UNKNOWN, 404);

  const db = serviceClient();
  const { data } = await db!
    .from("offerings")
    .select("title,price,varietals")
    .eq("gathering_id", who.gatheringId)
    .eq("member_id", who.memberId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    name: who.memberName,
    numberRoman: roman(who.gatheringNumber),
    theme: who.theme,
    date: who.date,
    closed: who.closed,
    // Whether the camera is worth offering at all: without the key, the page
    // shows the three fields alone rather than a button that cannot work.
    canReadLabel: !!process.env.ANTHROPIC_API_KEY,
    offering: { title: data?.title || "", price: data?.price ?? null, varietals: (data?.varietals as string[]) || [] },
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { t?: string; grape?: string; title?: string; price?: string };
  if (FIXTURE_TOKENS.has(body.t || "") && fixtureAllowed()) {
    // The fixture seals nothing: it echoes back what it was given so the page
    // can be walked end to end without touching anybody's night.
    return NextResponse.json({ ok: true, offering: { title: (body.title || "").trim(), price: body.price ? Number(String(body.price).replace(/[^\d.]/g, "")) : null, varietals: (body.grape || "").split(",").map((g) => g.trim()).filter(Boolean) } });
  }
  const who = await bearerOf(body.t || "");
  if (!who) return bad(UNKNOWN, 404);
  // Once the cloths have lifted the record is the record: a letter answered
  // late must not rewrite a judged night.
  if (who.closed) return bad("The cloths have already lifted on this night.", 409);

  const title = (body.title || "").trim().slice(0, 200);
  const grape = (body.grape || "").trim().slice(0, 200);
  if (!title) return bad("Name the wine, and the rest may wait.");

  // "R780", "780", "780.50", or nothing at all.
  const raw = (body.price || "").replace(/[^\d.]/g, "");
  const price = raw === "" ? null : Number(raw);
  if (price != null && (!Number.isFinite(price) || price < 0 || price > 1_000_000)) return bad("That price cannot be right.");

  // The grape is typed freely, so it is read the same way the codex reads a
  // wine's name: known grapes are recognised, and anything unrecognised is
  // kept as written rather than thrown away.
  const known = [...new Set([...detectVarietals(grape), ...detectVarietals(title)])];
  const varietals = known.length ? known : grape ? [grape] : [];

  const db = serviceClient();
  const { error } = await db!.from("offerings").upsert(
    { gathering_id: who.gatheringId, member_id: who.memberId, title, price, varietals },
    { onConflict: "gathering_id,member_id" }
  );
  if (error) return bad(`It would not seal: ${error.message}`, 500);

  return NextResponse.json({ ok: true, offering: { title, price, varietals } });
}

function roman(n: number): string {
  const map: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out || "I";
}
