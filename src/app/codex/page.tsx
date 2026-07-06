"use client";

import { useState, useEffect } from "react";
import { toRoman } from "@/lib/util";
import { loadAnnals, loadDqCounts, DQ_THRESHOLD, AnnalEntry } from "@/lib/annals";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function AnnalCard({ a }: { a: AnnalEntry }) {
  const [open, setOpen] = useState(false);
  const champ = a.rows.find((r) => r.rank === 1);
  return (
    <div style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}>
        <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)" }} />
        <div style={{ flex: 1 }}>
          <div className="disp" style={{ fontSize: 15 }}>Gathering {toRoman(a.number)} — {a.theme}</div>
          <div className="whisper" style={{ fontSize: 13 }}>
            {fmtDate(a.date)}{champ ? ` · crowned: ${champ.owner || `Bottle ${toRoman(champ.cloth)}`}` : ""}
          </div>
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 8, paddingLeft: 24 }}>
          {[...a.rows].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99)).map((r) => (
            <div key={r.cloth} style={{ display: "flex", gap: 8, fontSize: 13, padding: "3px 0", color: r.dq ? "var(--wine)" : "var(--parch)" }}>
              <span className="disp" style={{ width: 24, fontSize: 11 }}>{r.dq ? "✕" : toRoman(r.rank || 0)}</span>
              <span style={{ flex: 1 }}>
                Bottle {toRoman(r.cloth)}{r.owner ? ` — ${r.owner}` : ""}{r.title ? ` · ${r.title}` : ""}
                {r.dq && <span className="whisper" style={{ fontSize: 12, color: "var(--wine)" }}> · disqualified</span>}
              </span>
              <span className="disp" style={{ fontSize: 12 }}>{r.votes > 0 ? r.score.toFixed(1) : "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Codex() {
  const [annals, setAnnals] = useState<AnnalEntry[]>([]);
  const [dq, setDq] = useState<Record<string, number>>({});

  useEffect(() => {
    setAnnals(loadAnnals());
    setDq(loadDqCounts());
  }, []);

  const dqList = Object.entries(dq).sort((a, b) => b[1] - a[1]);
  const dqMax = Math.max(DQ_THRESHOLD, ...dqList.map(([, n]) => n));

  // Everything below is derived from committed reckonings only.
  const bottlesJudged = annals.reduce((n, a) => n + a.rows.length, 0);
  const victories: Record<string, number> = {};
  for (const a of annals) {
    const champ = a.rows.find((r) => r.rank === 1);
    if (champ?.owner) victories[champ.owner] = (victories[champ.owner] || 0) + 1;
  }
  const victoryList = Object.entries(victories).sort((a, b) => b[1] - a[1]);
  const winsMax = Math.max(1, ...victoryList.map(([, n]) => n));
  // The most frequent winner holds the chalice.
  const chaliceChampion = victoryList[0]?.[0] || "—";
  const themeAvgs = annals
    .map((a) => {
      const scored = a.rows.filter((r) => !r.dq && r.votes > 0);
      return { theme: a.theme, avg: scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : null };
    })
    .filter((t): t is { theme: string; avg: number } => t.avg != null);

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The codex</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        The annals of the Council — all that has been poured, remembered. Nothing is
        written here until the Keiser commits it.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Metric value={String(annals.length)} label="gatherings" />
        <Metric value={String(bottlesJudged)} label="bottles judged" />
        <Metric value={chaliceChampion} label="champion of the chalice" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Committed reckonings</div>
        {annals.length === 0 ? (
          <p className="whisper" style={{ margin: 0, fontSize: 14 }}>Nothing committed yet. The Keiser seals each reveal into the codex.</p>
        ) : (
          annals.map((a) => <AnnalCard key={a.gatheringId} a={a} />)
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Disqualifications</div>
        <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
          Wines cast out for breaking theme. At {DQ_THRESHOLD}, the offender is summoned before the tribunal.
        </p>
        {dqList.length === 0 ? (
          <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No wine has yet strayed. The Council is watching.</p>
        ) : (
          dqList.map(([name, n]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 110, fontSize: 13, color: n >= DQ_THRESHOLD ? "var(--wine)" : "var(--dim)" }}>{name}</span>
              <div className="bar" style={{ flex: 1, margin: 0 }}>
                <i style={{ width: `${(n / dqMax) * 100}%`, background: n >= DQ_THRESHOLD ? "var(--wine)" : "var(--gold)" }} />
              </div>
              <span className="disp" style={{ fontSize: 13, color: n >= DQ_THRESHOLD ? "var(--wine)" : "var(--gold2)" }}>
                {n}{n >= DQ_THRESHOLD ? " · summoned" : ""}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Victories by member</div>
        {victoryList.length === 0 ? (
          <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No champions crowned yet.</p>
        ) : (
          victoryList.map(([name, wins]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 110, fontSize: 13, color: "var(--dim)" }}>{name}</span>
              <div className="bar" style={{ flex: 1, margin: 0 }}>
                <i style={{ width: `${(wins / winsMax) * 100}%` }} />
              </div>
              <span className="disp" style={{ fontSize: 13 }}>{wins}</span>
            </div>
          ))
        )}
      </div>

      {themeAvgs.length > 0 && (
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Average score by theme</div>
          {themeAvgs.map((r) => (
            <div key={r.theme} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 130, fontSize: 13, color: "var(--dim)" }}>{r.theme}</span>
              <div className="bar" style={{ flex: 1, margin: 0 }}>
                <i style={{ width: `${(r.avg / 10) * 100}%` }} />
              </div>
              <span className="disp" style={{ fontSize: 13 }}>{r.avg.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
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
