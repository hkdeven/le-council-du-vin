import { seedWines, seedGathering } from "@/lib/seed";
import { toRoman } from "@/lib/util";

export default function Reveal() {
  const ranked = seedWines
    .filter((w) => w.revealed && w.rank != null)
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const champion = ranked[0];
  const rest = ranked.slice(1);
  const maxScore = 10;

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The revelation</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>
        The cloths are lifted. Gathering {toRoman(seedGathering.number)} · scores tallied
      </p>

      {champion && (
        <div className="card" style={{ textAlign: "center", borderColor: "var(--line2)", margin: "14px 0" }}>
          <span className="tag">Champion of the moon</span>
          <div className="disp" style={{ fontSize: 19, margin: "10px 0 2px" }}>
            Bottle {toRoman(champion.cloth_number)}
          </div>
          <div style={{ color: "var(--parch)" }}>
            {champion.vintage} {champion.producer} ·{" "}
            <span className="scr" style={{ fontSize: 15 }}>brought by {champion.brought_by_name}</span>
          </div>
          <div className="disp" style={{ fontSize: 28, marginTop: 8 }}>{champion.avg_score?.toFixed(1)}</div>
        </div>
      )}

      {rest.map((w) => {
        const last = w.rank === Math.max(...ranked.map((r) => r.rank || 0));
        return (
          <div key={w.id} className="rk">
            <span className="disp" style={{ width: 26, fontSize: 14, color: last ? "var(--wine)" : "var(--gold2)" }}>
              {toRoman(w.rank || 0)}
            </span>
            <div style={{ flex: 1 }}>
              <div>
                Bottle {toRoman(w.cloth_number)} — {w.producer}{" "}
                <span className="whisper" style={{ fontSize: 14 }}>· {w.brought_by_name}</span>
              </div>
              <div className="bar">
                <i style={{ width: `${((w.avg_score || 0) / maxScore) * 100}%`, background: last ? "var(--wine)" : "var(--gold)" }} />
              </div>
            </div>
            <span className="disp" style={{ color: last ? "var(--wine)" : "var(--gold2)" }}>
              {w.avg_score?.toFixed(1)}
            </span>
          </div>
        );
      })}
    </section>
  );
}
