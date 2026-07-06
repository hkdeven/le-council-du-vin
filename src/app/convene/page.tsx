"use client";

import Link from "next/link";
import { seedGathering, seedMembers } from "@/lib/seed";
import { toRoman } from "@/lib/util";
import { drawFor } from "@/lib/tarot";
import { useAuth } from "@/components/AuthProvider";
import { useWineCount } from "@/lib/useWineCount";

export default function Convene() {
  const g = seedGathering;
  const { role } = useAuth();
  const isKeiser = role === "keiser";
  const [count, setCount] = useWineCount(g.id, g.wine_count);
  const officialNight = g.status === "scoring" || g.status === "upcoming";
  const date = new Date(g.gather_date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The convening</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>
        {g.moon_label} · gathering {toRoman(g.number)}
      </p>
      <div className="moons" style={{ margin: "10px 0 6px" }} aria-hidden="true">
        <i className="ti ti-moon-stars" />
        <i className="ti ti-moon" />
        <i className="ti ti-circle-dashed" />
      </div>

      <div className="card" style={{ borderColor: "var(--line2)" }}>
        <span className="tag">This moon&rsquo;s theme</span>
        <div className="disp" style={{ fontSize: 20, margin: "10px 0 4px" }}>{g.theme_title}</div>
        <p className="whisper" style={{ margin: 0, fontSize: 15 }}>{g.theme_description}</p>
        <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap" }}>
          <Detail label="Host" value={<span className="scr" style={{ fontSize: 16 }}>{g.host_name}</span>} />
          <Detail label="The night" value={<span style={{ color: "var(--parch)" }}>{date} · dusk</span>} />
          <Detail label="Vessels" value={<span style={{ color: "var(--parch)" }}>{count} cloaked</span>} />
        </div>
      </div>

      {isKeiser && (
        <div className="card" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="eyebrow">Set the count · Keiser</div>
            <div className="whisper" style={{ fontSize: 14 }}>How many bottles convene tonight?</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <button className="btn" style={{ width: 38, padding: "9px 0", textAlign: "center" }} onClick={() => setCount(count - 1)} disabled={count <= 1} aria-label="One fewer bottle">
              <i className="ti ti-minus" />
            </button>
            <span className="disp" style={{ fontSize: 22, minWidth: 26, textAlign: "center" }}>{count}</span>
            <button className="btn" style={{ width: 38, padding: "9px 0", textAlign: "center" }} onClick={() => setCount(count + 1)} aria-label="One more bottle">
              <i className="ti ti-plus" />
            </button>
          </div>
        </div>
      )}

      {officialNight && (
        <>
          <div className="eyebrow" style={{ margin: "20px 0 4px" }}>The cards drawn for this night</div>
          <p className="whisper" style={{ margin: "0 0 12px", fontSize: 14 }}>
            A card is dealt to each soul, renewed with every gathering.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {seedMembers.map((m) => {
              const card = drawFor(g.id, m.id);
              return (
                <div key={m.id} className="card" style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 14px" }}>
                  <div className="av" style={{ width: 40, height: 40 }}>{m.short_name}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span className="scr" style={{ fontSize: 16 }}>{m.cult_name}</span>
                      <span className="disp" style={{ fontSize: 12 }}>{card.arcana} · {card.name}</span>
                    </div>
                    <div className="whisper" style={{ fontSize: 14 }}>{card.reading}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Link href="/rite" className="btn gold" style={{ textDecoration: "none", display: "block", marginTop: 16 }}>
        Enter the rite
      </Link>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}

