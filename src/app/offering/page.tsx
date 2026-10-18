"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  offering: { title: string; price: number | null; varietals: string[] };
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
