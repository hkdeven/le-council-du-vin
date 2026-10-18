"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { addApplication } from "@/lib/applications";
import { geocodePlace, type GeoHit } from "@/lib/geo";
import { DEFAULT_TZ, curatedTimezones } from "@/lib/astrology";
import { useAuth } from "@/components/AuthProvider";

/* eslint-disable-next-line @next/next/no-img-element */
const Mark = ({ size }: { size: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/favicon-mark.png" alt="" aria-hidden="true" width={size} height={size} style={{ display: "block", margin: "0 auto" }} />
);

// The mark of a required field, shown on its label from the start.
const Req = () => (
  <span aria-hidden="true" style={{ color: "#ff4d4d", marginLeft: 3 }}>*</span>
);

export default function Initiation() {
  const { mode } = useAuth();
  const [cultName, setCultName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [place, setPlace] = useState("");
  const [placeHits, setPlaceHits] = useState<GeoHit[] | null>(null); // null = not searched
  const [placeError, setPlaceError] = useState<string | null>(null); // the lookup itself failed
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLon, setPlaceLon] = useState<number | null>(null);
  const [placeTz, setPlaceTz] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const seekPlace = async () => {
    if (!place.trim()) return;
    setSeeking(true);
    const { hits, error } = await geocodePlace(place);
    setSeeking(false);
    setPlaceError(error);
    setPlaceHits(error ? null : hits);
    if (hits.length === 1) pickPlace(hits[0]);
  };
  const pickPlace = (h: GeoHit) => {
    setPlace(h.label);
    setPlaceLat(h.latitude);
    setPlaceLon(h.longitude);
    setPlaceTz(h.timezone);
    setPlaceHits([]);
    setPlaceError(null);
  };
  const [drawReason, setDrawReason] = useState("");
  const [ifWine, setIfWine] = useState("");
  const [wineSin, setWineSin] = useState("");
  const [oath, setOath] = useState(true);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set on the first submit attempt. From then on every empty required field
  // is painted red, and clears itself the moment it is filled.
  const [attempted, setAttempted] = useState(false);

  // Required fields, in page order. The button used to stay disabled until all
  // of these were filled, which read as "nothing happens" to a petitioner who
  // had missed one. Now the button always answers and names the gap.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const required: { id: string; label: string; missing: boolean }[] = [
    { id: "f-name", label: "your name", missing: !cultName.trim() },
    { id: "f-email", label: "a valid email", missing: !emailOk },
    { id: "f-dob", label: "date of birth", missing: !dob },
    { id: "f-tob", label: "time of birth", missing: !tob },
    { id: "f-place", label: "place of birth", missing: !place.trim() },
  ];
  const missing = required.filter((f) => f.missing);
  const miss = (id: string) => attempted && required.some((f) => f.id === id && f.missing);
  const cls = (id: string) => (miss(id) ? "missing" : undefined);
  const labelCls = (id: string) => (miss(id) ? "field missing" : "field");

  const submit = async () => {
    setAttempted(true);
    if (missing.length) {
      const names = missing.map((f) => f.label);
      const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
      setError(`The Council cannot read your petition yet. Missing: ${list}.`);
      const first = document.getElementById(missing[0].id);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
    // Pin the birth town quietly (first atlas match); the chart uses its
    // coordinates + timezone. A miss just leaves the typed name.
    let lat = placeLat, lon = placeLon, zone = placeTz || tz;
    if (lat == null && place.trim()) {
      const { hits } = await geocodePlace(place);
      if (hits[0]) { lat = hits[0].latitude; lon = hits[0].longitude; zone = hits[0].timezone; }
    }
    const record = {
      cult_name: cultName.trim(),
      email: email.trim().toLowerCase(),
      date_of_birth: dob || null,
      time_of_birth: tob || null,
      birth_place: place || null,
      birth_lat: lat,
      birth_lon: lon,
      birth_tz: zone || null,
      draw_reason: drawReason,
      if_wine: ifWine,
      wine_sin: wineSin,
      oath,
    };
    if (mode === "live" && supabase) {
      // Live: the petition must actually land in Supabase. Surface any failure
      // instead of faking success (a silent insert error hid earlier petitions).
      const { error: dbError } = await supabase.from("applications").insert(record);
      if (dbError) {
        setError(`Your petition could not be sealed: ${dbError.message}. Tell the Keiser.`);
        return;
      }
    } else {
      // Demo: persist locally so the petition reaches this browser's tribunal.
      addApplication({ id: `app-${Date.now()}`, status: "pending", created_at: new Date().toISOString(), ...record });
    }
    // Notify the Keiser by email (no-ops until Resend is configured). Fire and
    // forget — never block the petitioner's confirmation on it.
    fetch("/api/notify-petition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cult_name: cultName.trim(), email }),
    }).catch(() => {});
    setSent(true);
    } catch (e) {
      // Anything that throws (the write lock, a dropped network) used to leave
      // the button stuck on "Sealing…" forever. Say so instead.
      setError(`Your petition could not be sealed: ${(e as Error).message || "something went wrong"}. Try again, or tell the Keiser.`);
    } finally {
      setBusy(false);
    }
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
        <br />
        <span style={{ fontSize: 13 }}>Fields marked <Req /> are required.</span>
      </p>

      <div className="card">
        <label className={labelCls("f-name")} htmlFor="f-name">The name you offer<Req /></label>
        <input id="f-name" className={cls("f-name")} value={cultName} onChange={(e) => setCultName(e.target.value)} placeholder="Priestess Larissa" />

        <label className={labelCls("f-email")} htmlFor="f-email">A sigil to reach you by (email)<Req /></label>
        <input id="f-email" type="email" autoComplete="email" className={cls("f-email")} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@vessel.com" />

        <div className="birth-fields">
          <div>
            <label className={labelCls("f-dob")} htmlFor="f-dob">Date of birth<Req /></label>
            <input id="f-dob" className={cls("f-dob")} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div>
            <label className={labelCls("f-tob")} htmlFor="f-tob">Time of birth<Req /></label>
            <input id="f-tob" className={cls("f-tob")} type="time" value={tob} onChange={(e) => setTob(e.target.value)} />
          </div>
        </div>

        <label className="field">Timezone of birth</label>
        <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ colorScheme: "dark" }}>
          {curatedTimezones(tz).map((z) => (
            <option key={z.tz} value={z.tz}>{z.label}</option>
          ))}
        </select>

        <label className={labelCls("f-place")} htmlFor="f-place">Place of birth<Req /></label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="f-place"
            className={cls("f-place")}
            value={place}
            onChange={(e) => { setPlace(e.target.value); setPlaceLat(null); setPlaceLon(null); setPlaceHits(null); setPlaceError(null); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), seekPlace())}
            placeholder="Cape Town"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn" style={{ width: "auto", padding: "0 14px" }} onClick={seekPlace} disabled={seeking || !place.trim()}>
            {seeking ? "Seeking…" : "Mark it"}
          </button>
        </div>
        {placeLat != null && (
          <p className="whisper" style={{ margin: "6px 0 0", fontSize: 13 }}>
            <i className="ti ti-map-pin" style={{ fontSize: 12, marginRight: 4 }} />The atlas knows it. Your sky will be drawn from this place.
          </p>
        )}
        {placeHits && placeHits.length > 1 && (
          <div className="pills" style={{ marginTop: 8 }}>
            {placeHits.map((h) => (
              <span key={h.label} className="pill" onClick={() => pickPlace(h)}>{h.label}</span>
            ))}
          </div>
        )}
        {placeHits && placeHits.length === 0 && placeLat == null && (
          <p className="whisper" style={{ margin: "6px 0 0", fontSize: 13 }}>The atlas does not know it. Try adding the region, or the nearest larger town.</p>
        )}
        {placeError && (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#c98" }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 12, marginRight: 4 }} />
            The lookup failed: {placeError}. Try again in a moment.
          </p>
        )}
        <p className="whisper" style={{ margin: "6px 0 0", fontSize: 13 }}>
          The stars that made you: your chart is drawn from these.
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

        {error && (
          <p className="form-error" role="alert">{error}</p>
        )}
        <button
          className="btn gold"
          style={{ marginTop: error ? 10 : 18 }}
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Sealing…" : "Offer yourself to the Council"}
        </button>
      </div>
    </section>
  );
}
