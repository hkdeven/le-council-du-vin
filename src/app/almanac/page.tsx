"use client";

import { useState } from "react";
import { seedThemes, seedMembers } from "@/lib/seed";
import { supabase } from "@/lib/supabase";

const THEME_ICONS = ["ti-flame", "ti-hourglass", "ti-coin", "ti-grape", "ti-skull", "ti-star"];

export default function Almanac() {
  const [themes, setThemes] = useState(
    seedThemes.filter((t) => t.status === "pool").sort((a, b) => b.favours - a.favours)
  );
  const [favoured, setFavoured] = useState<Record<string, boolean>>({});
  const [proposal, setProposal] = useState("");

  const favour = (id: string) => {
    const already = favoured[id];
    setFavoured((f) => ({ ...f, [id]: !already }));
    setThemes((ts) =>
      ts
        .map((t) => (t.id === id ? { ...t, favours: t.favours + (already ? -1 : 1) } : t))
        .sort((a, b) => b.favours - a.favours)
    );
  };

  const propose = async () => {
    const title = proposal.trim();
    if (!title) return;
    if (supabase) await supabase.from("themes").insert({ title, status: "pool" });
    setThemes((ts) =>
      [...ts, { id: `local-${Date.now()}`, title, status: "pool" as const, favours: 1, created_at: new Date().toISOString() }]
        .sort((a, b) => b.favours - a.favours)
    );
    setProposal("");
  };

  const wheel = [...seedMembers]
    .filter((m) => m.active)
    .sort((a, b) => (a.last_hosted || "").localeCompare(b.last_hosted || ""));

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The almanac</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        Themes yet to come, and the turning of the host.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Theme pool — cast your favour</div>
        {themes.map((t, i) => (
          <div key={t.id} className="rk">
            <i className={`ti ${THEME_ICONS[i % THEME_ICONS.length]}`} style={{ color: "var(--gold2)" }} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <div>{t.title}</div>
              {t.description && <div className="whisper" style={{ fontSize: 13 }}>{t.description}</div>}
            </div>
            <button
              onClick={() => favour(t.id)}
              aria-label="Cast favour"
              style={{
                width: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: favoured[t.id] ? "var(--gold2)" : "var(--faint)",
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className={favoured[t.id] ? "ti ti-flame" : "ti ti-flame"} />
              {t.favours} favours
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && propose()}
            placeholder="Propose a new theme to the pool…"
            style={{ flex: 1 }}
          />
          <button className="btn" style={{ width: "auto", padding: "0 16px" }} onClick={propose}>Add</button>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>The hosting wheel</div>
        {wheel.map((m, i) => {
          const hostingNow = m.id === "m-silas";
          const upNext = i === 0 && !hostingNow;
          const when = m.last_hosted
            ? new Date(m.last_hosted).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
            : "never";
          return (
            <div key={m.id} className="rk" style={{ opacity: hostingNow || upNext ? 1 : 0.6 }}>
              <div className="av">{m.short_name}</div>
              <div style={{ flex: 1 }}>
                {m.cult_name}{" "}
                {hostingNow && <span className="tag" style={{ color: "var(--gold2)", borderColor: "var(--line2)" }}>hosting now</span>}
              </div>
              <span className="whisper" style={{ fontSize: 14 }}>
                {hostingNow ? "this moon" : upNext ? "up next" : `last hosted · ${when}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
