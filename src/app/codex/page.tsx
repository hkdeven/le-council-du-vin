import { seedVictories } from "@/lib/seed";

export default function Codex() {
  const max = Math.max(...seedVictories.map((v) => v.wins));

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The codex</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        All that has been poured, remembered.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Metric value="47" label="gatherings" />
        <Metric value="517" label="bottles judged" />
        <Metric value="Larissa" label="reigning champion" />
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Victories by member</div>
        {seedVictories.map((v) => (
          <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <span style={{ width: 90, fontSize: 13, color: "var(--dim)" }}>{v.name}</span>
            <div className="bar" style={{ flex: 1, margin: 0 }}>
              <i style={{ width: `${(v.wins / max) * 100}%` }} />
            </div>
            <span className="disp" style={{ fontSize: 13 }}>{v.wins}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Average score by theme</div>
        {[
          { theme: "Volcanic soils", avg: 7.9 },
          { theme: "Orange wines", avg: 7.4 },
          { theme: "Under €15", avg: 6.1 },
          { theme: "Barolo vs Barbaresco", avg: 8.3 },
        ].map((r) => (
          <div key={r.theme} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <span style={{ width: 130, fontSize: 13, color: "var(--dim)" }}>{r.theme}</span>
            <div className="bar" style={{ flex: 1, margin: 0 }}>
              <i style={{ width: `${(r.avg / 10) * 100}%` }} />
            </div>
            <span className="disp" style={{ fontSize: 13 }}>{r.avg.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
