"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { priceCaveat } from "@/lib/labelRead";

// Three questions, and the night is ready. Opened from the button in the
// summons, with no login: the token in the address names the soul and the
// night, and can write nothing but their own offering. See
// src/lib/offeringLink.ts for why it is safe to hand out, and
// src/app/api/offering/route.ts for the only thing it can do.

interface Loaded {
  name: string;
  numberRoman: string;
  theme: string;
  date: string;
  closed: boolean;
  canReadLabel: boolean;
  offering: { title: string; price: number | null; varietals: string[] };
}

// A photograph taken on a phone is several megabytes of detail nobody needs
// to read a label. Shrink it in the browser first: the member waits seconds
// less, and on a bad signal it is the difference between working and not.
async function shrink(file: File, maxEdge = 1600): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // No canvas path available: send what we were given rather than nothing.
    const raw = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    return { data: b64, mediaType: file.type || "image/jpeg" };
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const url = canvas.toDataURL("image/jpeg", 0.82);
  return { data: url.slice(url.indexOf(",") + 1), mediaType: "image/jpeg" };
}

function OfferingForm() {
  const token = useSearchParams().get("t") || "";
  const [state, setState] = useState<"loading" | "ready" | "sealed" | "refused">("loading");
  const [refusal, setRefusal] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [grape, setGrape] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  // The label reading: what came back, and the warning when it was unsure.
  const [reading, setReading] = useState<"idle" | "reading">("idle");
  const [caveat, setCaveat] = useState("");
  const [unsure, setUnsure] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readLabel = async (file: File) => {
    if (reading === "reading") return;
    setReading("reading"); setCaveat(""); setUnsure(false);
    try {
      const { data, mediaType } = await shrink(file);
      const r = await fetch("/api/offering/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, image: data, mediaType }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok) { alert(body.error || body.skipped || "The label could not be read."); return; }
      const got = body.reading as { title: string; grape: string; price: number | null; priceNote: string; confident: boolean };
      // Filled in, never sealed: every field stays the member's to correct.
      if (got.title) setTitle(got.title);
      if (got.grape) setGrape(got.grape);
      if (got.price != null) { setPrice(String(got.price)); setCaveat(priceCaveat(got.priceNote)); }
      setUnsure(!got.confident);
    } catch {
      alert("The photograph could not be sent. Try again in a moment.");
    } finally {
      setReading("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!token) { setState("refused"); setRefusal("This link is incomplete. Open the letter again and tap the button."); return; }
    fetch(`/api/offering?t=${encodeURIComponent(token)}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok || !body.ok) { setState("refused"); setRefusal(body.error || "This link is no longer good."); return; }
        const d = body as Loaded;
        setData(d);
        setGrape(d.offering.varietals.join(", "));
        setTitle(d.offering.title);
        setPrice(d.offering.price != null ? String(d.offering.price) : "");
        // A wine already named shows what was sealed, with one way back in.
        setState(d.offering.title ? "sealed" : "ready");
      })
      .catch(() => { setState("refused"); setRefusal("The Council could not be reached. Try again in a moment."); });
  }, [token]);

  const seal = async () => {
    if (busy || !title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/offering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, grape, title, price }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok) { alert(body.error || "It would not seal."); return; }
      setData((d) => (d ? { ...d, offering: body.offering } : d));
      setState("sealed");
    } catch {
      alert("The Council could not be reached. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main style={{ minHeight: "100dvh", background: "var(--ink)", padding: "30px 16px 60px" }}>
      <div style={{ maxWidth: 360, margin: "0 auto" }}>
        <div className="disp" style={{ textAlign: "center", fontSize: 13, letterSpacing: "0.22em", color: "var(--gold2)", marginBottom: 22 }}>
          LE COUNCIL DU VIN
        </div>
        {children}
      </div>
    </main>
  );

  if (state === "loading") {
    return <Shell><p className="whisper" style={{ textAlign: "center", fontSize: 15 }}>Opening the letter…</p></Shell>;
  }

  if (state === "refused") {
    return (
      <Shell>
        <p className="whisper" style={{ textAlign: "center", fontSize: 15.5, lineHeight: 1.6 }}>{refusal}</p>
        <a className="btn" href="/convene" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 18 }}>
          Open the Council
        </a>
      </Shell>
    );
  }

  const header = (
    <>
      <div className="eyebrow" style={{ fontSize: 10.5 }}>
        Gathering {data?.numberRoman}{data?.theme ? ` · ${data.theme}` : ""}
      </div>
    </>
  );

  if (state === "sealed" && data) {
    return (
      <Shell>
        {header}
        <div className="scr" style={{ fontStyle: "italic", color: "var(--gold2)", fontSize: 17, marginTop: 6 }}>It is sealed.</div>
        <p className="whisper" style={{ fontSize: 14, margin: "4px 0 14px", lineHeight: 1.5 }}>
          Bring it cloaked and unmarked. Nothing more is asked of you until the night.
        </p>
        <table style={{ width: "100%", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", borderCollapse: "collapse" }}>
          <tbody>
            {[["Grape", data.offering.varietals.join(", ") || "—"], ["Wine", data.offering.title], ["Cost", data.offering.price != null ? `R${data.offering.price}` : "—"]].map(([k, v]) => (
              <tr key={k}>
                <td className="eyebrow" style={{ padding: "7px 0", fontSize: 10 }}>{k}</td>
                <td style={{ padding: "7px 0", textAlign: "right", color: "var(--gold2)", fontSize: 15 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn" style={{ marginTop: 18 }} onClick={() => setState("ready")}>Change it</button>
        <p className="whisper" style={{ fontSize: 13, textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
          No eye but yours, not even the Keiser&rsquo;s, until the cloths lift.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <div className="scr" style={{ fontStyle: "italic", color: "var(--gold2)", fontSize: 17, marginTop: 6 }}>
        Good evening{data?.name ? `, ${data.name}` : ""}.
      </div>
      <p className="whisper" style={{ fontSize: 14, margin: "4px 0 0", lineHeight: 1.5 }}>
        Three questions, and the night is ready for you.
      </p>

      {data?.canReadLabel && (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readLabel(f); }} />
          <button className="btn" style={{ marginTop: 14 }} onClick={() => fileRef.current?.click()} disabled={reading === "reading"}>
            <i className={`ti ti-${reading === "reading" ? "loader-2" : "camera"}`} style={{ marginRight: 7 }} />
            {reading === "reading" ? "Reading the label…" : "Photograph the label"}
          </button>
          <p className="whisper" style={{ fontSize: 13, textAlign: "center", margin: "7px 0 0", lineHeight: 1.5 }}>
            Snap the bottle and the three answers fill themselves in. Check them before you seal.
          </p>
          {unsure && (
            <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "10px 0 0", border: "1px solid #8a6c3a", borderRadius: 8, padding: "8px 11px", color: "var(--spoiled)" }}>
              The label was hard to make out, so check every line below before sealing.
            </p>
          )}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <label className="field" htmlFor="grape">The grape</label>
        <input id="grape" value={grape} onChange={(e) => setGrape(e.target.value)} placeholder="Cabernet Sauvignon, Merlot…" autoComplete="off" />
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="field" htmlFor="wine">Name of the wine</label>
        <input id="wine" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Producer and vintage" autoComplete="off" />
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="field" htmlFor="cost">What it cost</label>
        <input id="cost" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R…" inputMode="decimal" autoComplete="off" />
        {/* The one field a search cannot really answer: what a wine sells for
            is not what this member paid, and the purse measures spending. */}
        {caveat && <p className="whisper" style={{ fontSize: 12.5, margin: "5px 0 0", lineHeight: 1.45 }}>{caveat}</p>}
      </div>

      <button className="btn gold" style={{ marginTop: 18 }} onClick={seal} disabled={busy || !title.trim()}>
        {busy ? "Sealing…" : "Seal my offering"}
      </button>
      <p className="whisper" style={{ fontSize: 13, textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
        No eye but yours, not even the Keiser&rsquo;s, until the cloths lift.
      </p>
    </Shell>
  );
}

export default function OfferingPage() {
  return (
    <Suspense fallback={null}>
      <OfferingForm />
    </Suspense>
  );
}
