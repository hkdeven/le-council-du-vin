"use client";

import { useState } from "react";
import { seedApplications } from "@/lib/seed";
import { supabase } from "@/lib/supabase";
import type { Application } from "@/lib/types";

export default function Tribunal() {
  const [apps, setApps] = useState<Application[]>(seedApplications);

  const decree = async (id: string, status: "anointed" | "cast_out") => {
    if (supabase) await supabase.from("applications").update({ status }).eq("id", id);
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const pending = apps.filter((a) => a.status === "pending");

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The tribunal</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        A petitioner stands before the Council.{" "}
        <span className="tag" style={{ color: "var(--wine)", borderColor: "var(--wine)" }}>Keiser only</span>
      </p>

      {pending.length === 0 && (
        <p className="whisper" style={{ fontSize: 16 }}>No souls await judgement. The gate is quiet.</p>
      )}

      {pending.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div className="av" style={{ width: 40, height: 40 }}>
              {a.cult_name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </div>
            <div>
              <div className="disp" style={{ fontSize: 16 }}>{a.cult_name}</div>
              <div className="whisper" style={{ fontSize: 14 }}>
                {a.zodiac} · governed by {a.element?.toLowerCase()}
              </div>
            </div>
          </div>

          {a.wine_sin && (
            <p style={{ margin: "0 0 4px" }}>
              <span className="scr">Gravest wine sin —</span> &ldquo;{a.wine_sin}&rdquo;
            </p>
          )}
          {a.if_wine && (
            <p style={{ margin: 0 }}>
              <span className="scr">If a wine —</span> &ldquo;{a.if_wine}&rdquo;
            </p>
          )}
          {a.draw_reason && (
            <p style={{ margin: "4px 0 0" }}>
              <span className="scr">What draws them —</span> &ldquo;{a.draw_reason}&rdquo;
            </p>
          )}

          {a.tally && (
            <div style={{ display: "flex", gap: 16, margin: "16px 0", padding: "12px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <Tally n={a.tally.anoint} label="anoint" color="var(--gold2)" />
              <Tally n={a.tally.cast_out} label="cast out" color="var(--wine)" />
              <Tally n={a.tally.abstain} label="abstain" color="var(--dim)" />
            </div>
          )}

          <p className="whisper" style={{ margin: "0 0 12px", fontSize: 15 }}>
            The Council has spoken. The decree is yours alone, Keiser.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn gold" style={{ flex: 1 }} onClick={() => decree(a.id, "anointed")}>Anoint</button>
            <button className="btn danger" style={{ flex: 1 }} onClick={() => decree(a.id, "cast_out")}>Cast out</button>
          </div>
        </div>
      ))}

      {apps.filter((a) => a.status !== "pending").map((a) => (
        <div key={a.id} className="rk">
          <div className="av">{a.cult_name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
          <div style={{ flex: 1 }}>{a.cult_name}</div>
          <span className="tag" style={{ color: a.status === "anointed" ? "var(--gold2)" : "var(--wine)", borderColor: a.status === "anointed" ? "var(--line2)" : "var(--wine)" }}>
            {a.status === "anointed" ? "anointed" : "cast out"}
          </span>
        </div>
      ))}
    </section>
  );
}

function Tally({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="disp" style={{ fontSize: 19, color }}>{n}</div>
      <span className="whisper" style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}
