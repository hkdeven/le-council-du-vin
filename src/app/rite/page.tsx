"use client";

import { useState } from "react";
import { seedGathering, aromaLexicon } from "@/lib/seed";
import { toRoman } from "@/lib/util";

export default function Rite() {
  const total = seedGathering.wine_count;
  const [index, setIndex] = useState(4);
  const [score, setScore] = useState(7);
  const [aromas, setAromas] = useState<string[]>(["apricot", "incense", "dried flower"]);
  const [notes, setNotes] = useState("");

  const toggleAroma = (a: string) =>
    setAromas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const seal = () => {
    // Once live: upsert into `scores` keyed on (wine_id, member_id).
    setIndex((i) => Math.min(total, i + 1));
    setScore(7);
    setAromas([]);
    setNotes("");
  };

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The rite of judgement</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>
        Wine {index} of {total} · bottles stay cloaked until the reveal
      </p>

      <div className="card" style={{ textAlign: "center", marginTop: 14 }}>
        <div className="cloth" style={{ margin: "2px auto 16px" }}>{toRoman(index)}</div>

        <div style={{ textAlign: "left" }}>
          <label className="field" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>The verdict</span>
            <span className="disp" style={{ fontSize: 17 }}>{score}</span>
          </label>
          <div className="orbs" role="slider" aria-label="Score out of ten" aria-valuenow={score} aria-valuemin={1} aria-valuemax={10}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
              <span
                key={i}
                className={`orb${i <= score ? " f" : ""}`}
                onClick={() => setScore(i)}
              />
            ))}
          </div>

          <label className="field">Aromas caught</label>
          <div className="pills">
            {aromaLexicon.map((a) => (
              <span key={a} className={`pill${aromas.includes(a) ? " on" : ""}`} onClick={() => toggleAroma(a)}>
                {a}
              </span>
            ))}
          </div>

          <label className="field">Whispered notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What the wine confessed to you…" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn" style={{ flex: 1 }} disabled={index <= 1} onClick={() => setIndex((i) => Math.max(1, i - 1))}>
          <i className="ti ti-arrow-left" /> Wine {index > 1 ? toRoman(index - 1) : "—"}
        </button>
        <button className="btn gold" style={{ flex: 2 }} onClick={seal}>
          {index >= total ? "Seal the final verdict" : `Seal verdict · Wine ${toRoman(index + 1)}`}
        </button>
      </div>
    </section>
  );
}
