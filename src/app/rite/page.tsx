"use client";

import { useState, useEffect } from "react";
import { seedGathering } from "@/lib/seed";
import { aromasFor } from "@/lib/aromas";
import { toRoman } from "@/lib/util";
import { useAuth } from "@/components/AuthProvider";
import { useWineCount } from "@/lib/useWineCount";

export default function Rite() {
  const { role } = useAuth();
  const isKeiser = role === "keiser";
  const [total, setTotal] = useWineCount(seedGathering.id, seedGathering.wine_count);
  const wines = Array.from({ length: total }, (_, i) => i + 1);

  const [current, setCurrent] = useState(1);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [aromasByWine, setAromasByWine] = useState<Record<number, string[]>>({});
  const [notesByWine, setNotesByWine] = useState<Record<number, string>>({});
  const [newAroma, setNewAroma] = useState("");
  const [sealed, setSealed] = useState(false);

  const score = scores[current] ?? 0;
  const aromas = aromasByWine[current] ?? [];
  const notes = notesByWine[current] ?? "";
  // A small random handful of aromas per wine (deterministic), plus any the
  // taster has added themselves so they stay visible/selected.
  const suggestions = aromasFor(`${seedGathering.id}-${current}`);
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
  // an earlier wine while judging a later one (relative scoring).
  const setScore = (wine: number, val: number) =>
    setScores((s) => ({ ...s, [wine]: val }));

  const toggleAroma = (a: string) =>
    setAromasByWine((m) => {
      const list = m[current] ?? [];
      return { ...m, [current]: list.includes(a) ? list.filter((x) => x !== a) : [...list, a] };
    });

  const addAroma = () => {
    const a = newAroma.trim().toLowerCase();
    if (!a) return;
    setAromasByWine((m) => {
      const list = m[current] ?? [];
      return { ...m, [current]: list.includes(a) ? list : [...list, a] };
    });
    setNewAroma("");
  };

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
          <label className="field">The verdict</label>
          <div className="orbs mid" style={{ justifyContent: "center" }} role="slider" aria-label={`Score for wine ${current}, out of ten`} aria-valuenow={score} aria-valuemin={1} aria-valuemax={10}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
              <span key={i} className={`orb${i <= score ? " f" : ""}`} onClick={() => setScore(current, i)}>
                {i === score ? i : ""}
              </span>
            ))}
          </div>

          <label className="field">Aromas caught</label>
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

          <label className="field">Whispered notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotesByWine((m) => ({ ...m, [current]: e.target.value }))}
            placeholder="What the wine confessed to you…"
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
          Tap any wine to revise it — later pours may unseat your earlier favourites.
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
        disabled={judged < total || sealed}
        onClick={() => setSealed(true)}
      >
        {sealed ? "Sealed · awaiting the reveal" : judged < total ? `Seal the reckoning · ${judged}/${total} judged` : "Seal the reckoning"}
      </button>
    </section>
  );
}
