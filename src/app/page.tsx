import Link from "next/link";
import Emblem from "@/components/Emblem";

export default function Gate() {
  return (
    <section style={{ textAlign: "center", padding: "40px 0 20px" }}>
      <div className="moons" style={{ justifyContent: "center", marginBottom: 6 }} aria-hidden="true">
        <i className="ti ti-moon-stars" />
        <i className="ti ti-moon" />
        <i className="ti ti-circle" />
        <i className="ti ti-moon-2" />
        <i className="ti ti-moon-stars" />
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Emblem size={124} />
      </div>
      <h1 className="disp" style={{ fontSize: 26, marginTop: 10, fontWeight: 500 }}>
        Le Council du Vin
      </h1>
      <p className="scr" style={{ fontSize: 19, margin: "2px 0 30px" }}>in vino veritas</p>

      <div style={{ maxWidth: 300, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <Link href="/convene" className="btn gold" style={{ textDecoration: "none", display: "block" }}>
          Enter the council
        </Link>
        <Link href="/initiation" className="btn" style={{ textDecoration: "none", display: "block" }}>
          Petition for initiation
        </Link>
      </div>

      <p className="whisper" style={{ marginTop: 30, fontSize: 15 }}>
        The twelfth moon awaits. Speak the vintage, or be turned away.
      </p>
    </section>
  );
}
