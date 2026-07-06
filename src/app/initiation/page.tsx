"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { addApplication } from "@/lib/applications";

/* eslint-disable-next-line @next/next/no-img-element */
const Mark = ({ size }: { size: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/favicon-mark.png" alt="" aria-hidden="true" width={size} height={size} style={{ display: "block", margin: "0 auto" }} />
);

export default function Initiation() {
  const [cultName, setCultName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [drawReason, setDrawReason] = useState("");
  const [ifWine, setIfWine] = useState("");
  const [wineSin, setWineSin] = useState("");
  const [oath, setOath] = useState(true);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const record = {
      cult_name: cultName,
      email,
      date_of_birth: dob || null,
      time_of_birth: tob || null,
      draw_reason: drawReason,
      if_wine: ifWine,
      wine_sin: wineSin,
      oath,
    };
    // Demo: persist so the petition reaches the Keiser's tribunal.
    addApplication({ id: `app-${Date.now()}`, status: "pending", created_at: new Date().toISOString(), ...record });
    if (supabase) await supabase.from("applications").insert(record);
    setBusy(false);
    setSent(true);
  };

  if (sent) {
    return (
      <section style={{ textAlign: "center", padding: "60px 0" }}>
        <Mark size={96} />
        <h1 className="disp" style={{ fontSize: 20, marginTop: 12, fontWeight: 500 }}>
          Your petition is sealed
        </h1>
        <p className="whisper" style={{ fontSize: 16, maxWidth: 380, margin: "10px auto 0" }}>
          The Council will convene upon your name. Await the Keiser&rsquo;s decree by the next moon.
        </p>
        <Link href="/" className="btn" style={{ display: "inline-block", width: "auto", padding: "12px 24px", marginTop: 24, textDecoration: "none" }}>
          Return to the gate
        </Link>
      </section>
    );
  }

  return (
    <section style={{ padding: "24px 0 40px" }}>
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          color: "var(--dim)",
          textDecoration: "none",
          fontFamily: "'Cinzel', serif",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        <i className="ti ti-arrow-left" aria-hidden="true" /> The gate
      </Link>
      <div style={{ textAlign: "center", marginBottom: 8, marginTop: 8 }}>
        <Mark size={72} />
      </div>
      <h1 className="disp" style={{ fontSize: 20, textAlign: "center", fontWeight: 500 }}>
        The initiation rite
      </h1>
      <p className="whisper" style={{ textAlign: "center", fontSize: 15, marginBottom: 20 }}>
        Answer truthfully. The Council sees all.
      </p>

      <div className="card">
        <label className="field">The name you offer</label>
        <input value={cultName} onChange={(e) => setCultName(e.target.value)} placeholder="Cassian Vale" />

        <label className="field">A sigil to reach you by</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@vessel.com" />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}>
            <label className="field">Date of birth</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label className="field">Time of birth</label>
            <input type="time" value={tob} onChange={(e) => setTob(e.target.value)} />
          </div>
        </div>
        <p className="whisper" style={{ margin: "6px 0 0", fontSize: 13 }}>
          The stars that made you — your chart is drawn from these.
        </p>

        <label className="field">What draws you to the vine?</label>
        <textarea value={drawReason} onChange={(e) => setDrawReason(e.target.value)} placeholder="Speak plainly…" />

        <label className="field">If you were a wine, you would be…</label>
        <input value={ifWine} onChange={(e) => setIfWine(e.target.value)} placeholder="A brooding Barolo…" />

        <label className="field">Confess your gravest wine sin</label>
        <textarea value={wineSin} onChange={(e) => setWineSin(e.target.value)} placeholder="Speak it and be cleansed…" />

        <label className="field">Do you swear to bring a bottle each moon?</label>
        <div className="pills">
          <span className={`pill${oath ? " on" : ""}`} onClick={() => setOath(true)}>I so swear</span>
          <span className={`pill${!oath ? " on" : ""}`} onClick={() => setOath(false)}>I dare not</span>
        </div>

        <button
          className="btn gold"
          style={{ marginTop: 18 }}
          disabled={busy || !cultName || !email}
          onClick={submit}
        >
          {busy ? "Sealing…" : "Offer yourself to the Council"}
        </button>
      </div>
    </section>
  );
}
