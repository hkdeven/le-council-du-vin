import Link from "next/link";

export default function Gate() {
  return (
    <section style={{ textAlign: "center", padding: "40px 0 20px" }}>
      <div className="moons" style={{ justifyContent: "center", marginBottom: 18 }} aria-hidden="true">
        <i className="ti ti-moon-stars" />
        <i className="ti ti-moon" />
        <i className="ti ti-circle" />
        <i className="ti ti-moon-2" />
        <i className="ti ti-moon-stars" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/black-gold-full-logo.png"
        alt="Le Council du Vin — in vino veritas"
        style={{ width: "100%", maxWidth: 340, height: "auto", margin: "0 auto 30px", display: "block" }}
      />

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
