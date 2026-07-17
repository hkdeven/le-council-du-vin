"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { aromasFor, cleanAromaText } from "@/lib/aromas";
import { toRoman } from "@/lib/util";
import { useAuth } from "@/components/AuthProvider";
import { useWineCount } from "@/lib/useWineCount";
import { fetchBallot, saveBallot } from "@/lib/ballots";
import { fetchCurrentGathering, riteOpensAt } from "@/lib/gatherings";
import { useRiteOpen } from "@/lib/useRiteOpen";
import type { Gathering } from "@/lib/types";

export default function Rite() {
  const { mode, role, member, sleeping } = useAuth();
  const isKeiser = role === "keiser";
  const meId = mode === "live" ? member?.id ?? null : role === "keiser" ? "m-keiser" : role === "member" ? "m-larissa" : null;

  const [g, setG] = useState<Gathering | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetchCurrentGathering().then((cg) => {
      setG(cg);
      setReady(true);
    });
  }, []);
  const gid = g?.id ?? "none";
  // Re-renders the moment the rite opens, so the gate below lifts without a refresh.
  const riteOpen = useRiteOpen(g);

  const [total, setTotal] = useWineCount(g);
  const wines = Array.from({ length: total }, (_, i) => i + 1);

  const [current, setCurrent] = useState(1);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [aromasByWine, setAromasByWine] = useState<Record<number, string[]>>({});
  const [notesByWine, setNotesByWine] = useState<Record<number, string>>({});
  const [newAroma, setNewAroma] = useState("");
  const [sealed, setSealed] = useState(false);

  // Restore a previously sealed (or in-progress) ballot for this member.
  useEffect(() => {
    if (!meId || !g) return;
    let active = true;
    fetchBallot(g.id, meId).then((b) => {
      if (active && b) {
        setScores(b.scores || {});
        setSealed(!!b.sealed);
        if (b.aromas) setAromasByWine(b.aromas);
        if (b.notes) setNotesByWine(b.notes);
      }
    });
    return () => { active = false; };
  }, [meId, g]);

  const score = scores[current] ?? 0;
  const aromas = aromasByWine[current] ?? [];
  const notes = notesByWine[current] ?? "";
  // A small random handful of aromas per wine (deterministic), plus any the
  // taster has added themselves so they stay visible/selected.
  const suggestions = aromasFor(`${gid}-${current}`);
  const displayedAromas = [...suggestions, ...aromas.filter((a) => !suggestions.includes(a))];
  const judged = wines.filter((w) => scores[w] != null).length;

  const addWine = () => setTotal(total + 1);
  const removeWine = () => {
    const n = total - 1;
    setTotal(n);
    if (current > n) setCurrent(n);
  };

  // Warm the browser cache for every cloth badge up front so moving between
  // wines is instant (they're otherwise fetched only when first shown).
  useEffect(() => {
    for (let i = 1; i <= Math.min(total, 20); i++) {
      const img = new window.Image();
      img.src = `/cloths/${i}.webp`;
    }
  }, [total]);

  // Set any wine's score — from the focused card or the ballot. Free to revise
  // an earlier wine while judging a later one (relative scoring). Revising a
  // sealed ballot breaks the seal until it is sealed again.
  const setScore = (wine: number, val: number) => {
    setScores((s) => {
      const next = { ...s, [wine]: val };
      // A sleeping hand judges nothing: the draft save was swallowed silently
      // (.catch(() => {})), so a sleeping member could score a whole night and
      // only learn at the seal that none of it was ever written.
      if (meId && !sleeping) saveBallot(gid, meId, { scores: next, sealed: false, aromas: aromasByWine, notes: notesByWine }).catch(() => {});
      return next;
    });
    setSealed(false);
  };

  const sealReckoning = async () => {
    if (meId) {
      try {
        await saveBallot(gid, meId, { scores, sealed: true, aromas: aromasByWine, notes: notesByWine });
      } catch (e) {
        alert(`Could not seal your reckoning: ${(e as Error).message}`);
        return;
      }
    }
    setSealed(true);
  };

  const toggleAroma = (a: string) =>
    setAromasByWine((m) => {
      const list = m[current] ?? [];
      const next = { ...m, [current]: list.includes(a) ? list.filter((x) => x !== a) : [...list, a] };
      // Aromas feed the Palate Dossier's Nose, so they persist with the ballot.
      if (meId) saveBallot(gid, meId, { scores, sealed, aromas: next, notes: notesByWine }).catch(() => {});
      return next;
    });

  const addAroma = () => {
    // Fillers stripped ("a hint of black cherry" → "black cherry") so only
    // real scent words reach the ballot and, later, the Nose cloud.
    const a = cleanAromaText(newAroma);
    if (!a) return;
    setAromasByWine((m) => {
      const list = m[current] ?? [];
      return { ...m, [current]: list.includes(a) ? list : [...list, a] };
    });
    setNewAroma("");
  };

  if (ready && !g) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-glass-full" style={{ fontSize: 30, color: "var(--gold)" }} aria-hidden="true" />
        <p className="whisper" style={{ fontSize: 16, marginTop: 12 }}>
          No gathering is scheduled. The convening comes first.
        </p>
      </section>
    );
  }

  // The rite is sealed until 30 minutes after the gathering's scheduled start.
  if (ready && g && !riteOpen) {
    const opens = riteOpensAt(g);
    const opensStr = opens.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-lock-clock" style={{ fontSize: 32, color: "var(--gold)" }} aria-hidden="true" />
        <h1 className="disp" style={{ fontSize: 18, fontWeight: 500, marginTop: 12 }}>The rite is not yet open</h1>
        <p className="whisper" style={{ fontSize: 16, maxWidth: 380, margin: "10px auto 0" }}>
          Judgement begins half an hour after the gathering convenes. Return at{" "}
          <span className="scr" style={{ color: "var(--gold2)" }}>{opensStr}</span>.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The rite of judgement</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>
            Judging wine {current} of {total} · {judged} verdict{judged === 1 ? "" : "s"} cast · revise any at will
          </p>
        </div>
        {isKeiser && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <span className="eyebrow" title="Only the Keiser may alter the count">Wines</span>
            <button className="btn" style={{ width: 34, padding: "8px 0", textAlign: "center" }} onClick={removeWine} disabled={total <= 1} aria-label="Remove a wine">
              <i className="ti ti-minus" />
            </button>
            <span className="disp" style={{ fontSize: 18, minWidth: 22, textAlign: "center" }}>{total}</span>
            <button className="btn" style={{ width: 34, padding: "8px 0", textAlign: "center" }} onClick={addWine} aria-label="Add a wine">
              <i className="ti ti-plus" />
            </button>
          </div>
        )}
      </div>

      {/* negative margin lets the card use most of the mobile width (breaks out of the page padding) */}
      <div style={{ margin: "14px -14px 0" }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          backgroundImage: "url(/card-frame.webp)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          paddingTop: "20%",
          paddingBottom: "calc(22% + 90px)",
          paddingLeft: "14%",
          paddingRight: "14%",
          textAlign: "center",
        }}
      >
        {current <= 20 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/cloths/${current}.webp`}
            alt={`Wine ${current}`}
            width={132}
            height={132}
            style={{ display: "block", margin: "0 auto 12px" }}
          />
        ) : (
          <div className="cloth" style={{ margin: "2px auto 16px" }}>{toRoman(current)}</div>
        )}

        <div style={{ textAlign: "center" }}>
          <label className="field" style={{ fontSize: 14, color: "#fff" }}>The verdict</label>
          <div className="orbs mid" style={{ justifyContent: "center" }} role="slider" aria-label={`Score for wine ${current}, out of ten`} aria-valuenow={score} aria-valuemin={1} aria-valuemax={10}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
              <span key={i} className={`orb${i <= score ? " f" : ""}`} onClick={() => setScore(current, i)}>
                {i === score ? i : ""}
              </span>
            ))}
          </div>

          <label className="field" style={{ fontSize: 14, color: "#fff" }}>Aromas</label>
          <div className="pills" style={{ justifyContent: "center" }}>
            {displayedAromas.map((a) => (
              <span key={a} className={`pill${aromas.includes(a) ? " on" : ""}`} onClick={() => toggleAroma(a)}>
                {a}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={newAroma}
              onChange={(e) => setNewAroma(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAroma())}
              placeholder="Name another aroma…"
              style={{ flex: 1 }}
            />
            <button className="btn" style={{ width: "auto", padding: "0 12px" }} onClick={addAroma} aria-label="Add aroma">
              <i className="ti ti-plus" />
            </button>
          </div>

          <label className="field" style={{ fontSize: 14, color: "#fff" }}>Whispered notes</label>
          <textarea
            value={notes}
            disabled={sleeping}
            onChange={(e) => setNotesByWine((m) => ({ ...m, [current]: e.target.value }))}
            onBlur={() => { if (meId && !sleeping) saveBallot(gid, meId, { scores, sealed, aromas: aromasByWine, notes: notesByWine }).catch(() => {}); }}
            placeholder={sleeping ? "A sleeping hand writes no notes." : "What the wine confessed to you…"}
          />
        </div>
      </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn" style={{ flex: 1 }} disabled={current <= 1} onClick={() => setCurrent((c) => Math.max(1, c - 1))}>
          <i className="ti ti-arrow-left" /> Wine {current > 1 ? toRoman(current - 1) : "—"}
        </button>
        <button className="btn" style={{ flex: 1 }} disabled={current >= total} onClick={() => setCurrent((c) => Math.min(total, c + 1))}>
          Wine {current < total ? toRoman(current + 1) : "—"} <i className="ti ti-arrow-right" />
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Your ballot</div>
        <p className="whisper" style={{ margin: "0 0 12px", fontSize: 14 }}>
          Tap any wine to revise it: later pours may unseat your earlier favourites.
        </p>
        {wines.map((w) => {
          const s = scores[w] ?? 0;
          const isCurrent = w === current;
          return (
            <div
              key={w}
              className="rk"
              style={{ background: isCurrent ? "rgba(160,150,120,0.08)" : "none", borderRadius: 8, padding: isCurrent ? "11px 8px" : "11px 8px" }}
            >
              <button
                onClick={() => setCurrent(w)}
                aria-label={`Focus wine ${w}`}
                style={{ width: 54, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: "0.08em", color: isCurrent ? "var(--gold2)" : "var(--dim)" }}
              >
                Wine {toRoman(w)}
              </button>
              <div className="orbs sm" style={{ flex: 1 }} role="slider" aria-label={`Score for wine ${w}`} aria-valuenow={s} aria-valuemin={1} aria-valuemax={10}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
                  <span key={i} className={`orb${i <= s ? " f" : ""}`} onClick={() => setScore(w, i)}>
                    {i === s ? i : ""}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="btn gold"
        style={{ marginTop: 14 }}
        disabled={judged < total || sealed || sleeping}
        onClick={sealReckoning}
      >
        {sealed ? "Sealed" : judged < total ? `Seal the reckoning · ${judged}/${total} judged` : "Seal the reckoning"}
      </button>

      {sealed && (
        <Link href="/reveal" className="btn" style={{ display: "block", textDecoration: "none", textAlign: "center", fontSize: 14, marginTop: 10 }}>
          <i className="ti ti-eye" style={{ marginRight: 6 }} /> Proceed to the revelation
        </Link>
      )}
    </section>
  );
}
