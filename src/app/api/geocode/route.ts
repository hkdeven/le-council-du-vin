import { NextResponse } from "next/server";

// Same-origin proxy for the Open-Meteo geocoding API. The petition and
// profile pages call this instead of the API directly because browser content
// blockers and locked-down networks silently kill cross-origin fetches — the
// place-of-birth lookup then "finds nothing" for a town that plainly exists.
// The server-side hop is invisible to those blockers. No key required.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return NextResponse.json({ error: true, reason: `the atlas answered ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: true, reason: "the atlas could not be reached" }, { status: 502 });
  }
}
