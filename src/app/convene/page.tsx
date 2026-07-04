import Link from "next/link";
import { seedGathering, seedMembers } from "@/lib/seed";
import { toRoman } from "@/lib/util";

export default function Convene() {
  const g = seedGathering;
  const avatars = seedMembers.slice(0, 5);
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
          <Detail label="Vessels" value={<span style={{ color: "var(--parch)" }}>{g.wine_count} cloaked</span>} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0 8px", alignItems: "center", flexWrap: "wrap" }}>
        {avatars.map((m) => (
          <div key={m.id} className="av">{m.short_name}</div>
        ))}
        <div className="av">+6</div>
        <span className="whisper" style={{ marginLeft: 6, fontSize: 15 }}>{g.wine_count} souls attending</span>
      </div>

      <Link href="/rite" className="btn gold" style={{ textDecoration: "none", display: "block" }}>
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

