"use client";

import { useState } from "react";
import { seedThemes, seedMembers, seedDateOptions } from "@/lib/seed";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

const THEME_ICONS = ["ti-flame", "ti-hourglass", "ti-coin", "ti-grape", "ti-skull", "ti-star"];
const ME = "m-keiser"; // stand-in current user until auth resolves the member

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });

export default function Oracle() {
  const { role } = useAuth();
  const isKeiser = role === "keiser";
  const [dates, setDates] = useState(seedDateOptions);
  const [themes, setThemes] = useState(
    seedThemes.filter((t) => t.status === "pool").sort((a, b) => b.favours - a.favours)
  );
  const [favoured, setFavoured] = useState<Record<string, boolean>>({});
  const [proposal, setProposal] = useState("");
  const [proposalDesc, setProposalDesc] = useState("");

  const toggleDate = (id: string) =>
    setDates((ds) =>
      ds.map((d) =>
        d.id === id
          ? { ...d, voters: d.voters.includes(ME) ? d.voters.filter((v) => v !== ME) : [...d.voters, ME] }
          : d
      )
    );

  const leadCount = Math.max(...dates.map((d) => d.voters.length));

  const shareDates = () => {
    const origin = window.location.origin;
    const text =
      "Le Council du Vin — choose the next night:\n" +
      dates.map((d) => `• ${fmtDate(d.date)}`).join("\n") +
      `\n\nCast your vote (all you can make): ${origin}/oracle`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const favour = (id: string) => {
    const already = favoured[id];
    setFavoured((f) => ({ ...f, [id]: !already }));
    setThemes((ts) =>
      ts
        .map((t) => (t.id === id ? { ...t, favours: t.favours + (already ? -1 : 1) } : t))
        .sort((a, b) => b.favours - a.favours)
    );
  };

  const propose = () => {
    const title = proposal.trim();
    if (!title) return;
    const description = proposalDesc.trim() || null;
    setThemes((ts) =>
      [...ts, { id: `local-${Date.now()}`, title, description, status: "pool" as const, favours: 1, created_at: new Date().toISOString() }]
        .sort((a, b) => b.favours - a.favours)
    );
    setProposal("");
    setProposalDesc("");
    if (supabase) supabase.from("themes").insert({ title, description, status: "pool" });
  };

  const removeTheme = (id: string) => {
    setThemes((ts) => ts.filter((t) => t.id !== id));
    if (supabase) supabase.from("themes").delete().eq("id", id);
  };

  const wheel = [...seedMembers]
    .filter((m) => m.active)
    .sort((a, b) => (a.last_hosted || "").localeCompare(b.last_hosted || ""));

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The oracle</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        What the moons ahead will bring — dates, themes, and the turning of the host.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div className="eyebrow">Choose the next night</div>
          <button
            onClick={shareDates}
            style={{ marginLeft: "auto", width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--gold2)", padding: "6px 10px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}
          >
            <i className="ti ti-brand-whatsapp" /> Share poll
          </button>
        </div>
        <p className="whisper" style={{ margin: "0 0 10px", fontSize: 14 }}>
          Mark every date you can make. The night the most souls can attend prevails.
        </p>
        {dates
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d) => {
            const mine = d.voters.includes(ME);
            const leading = d.voters.length === leadCount && leadCount > 0;
            return (
              <div key={d.id} className="rk">
                <button
                  onClick={() => toggleDate(d.id)}
                  aria-label={mine ? "Withdraw your vote" : "Vote for this date"}
                  style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: mine ? "var(--gold2)" : "var(--faint)", fontSize: 20, display: "flex", alignItems: "center" }}
                >
                  <i className={mine ? "ti ti-square-check" : "ti ti-square"} />
                </button>
                <div style={{ flex: 1 }}>
                  {fmtDate(d.date)}{" "}
                  {leading && <span className="tag" style={{ color: "var(--gold2)", borderColor: "var(--line2)" }}>leading</span>}
                </div>
                <span className="whisper" style={{ fontSize: 14 }}>
                  {d.voters.length} can attend
                </span>
              </div>
            );
          })}
      </div>

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
              style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: favoured[t.id] ? "var(--gold2)" : "var(--faint)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, display: "flex", alignItems: "center", gap: 5 }}
            >
              <i className="ti ti-flame" />
              {t.favours} favours
            </button>
            {isKeiser && (
              <button
                onClick={() => removeTheme(t.id)}
                aria-label="Cast this theme from the pool"
                title="Cast out"
                style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", display: "flex", alignItems: "center", paddingLeft: 10 }}
              >
                <i className="ti ti-trash" style={{ fontSize: 15 }} />
              </button>
            )}
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <input
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && propose()}
            placeholder="Propose a new theme…"
            style={{ width: "100%" }}
          />
          <input
            value={proposalDesc}
            onChange={(e) => setProposalDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && propose()}
            placeholder="A supporting line (optional)…"
            style={{ width: "100%", marginTop: 8 }}
          />
          <button className="btn" style={{ marginTop: 8 }} onClick={propose} disabled={!proposal.trim()}>
            Add to the pool
          </button>
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
