"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Loading from "@/components/Loading";

export default function Gate() {
  const { mode, status, signedIn, hasAccess, signOut } = useAuth();
  const authed = mode === "demo" || (signedIn && hasAccess);
  const [showLogin, setShowLogin] = useState(false);
  // Just back from Google / a magic link? The session is still being read out
  // of the URL. Show an "entering" state until it resolves, so the bare login
  // page never flashes past — which read as broken.
  const [returning, setReturning] = useState(() => {
    if (typeof window === "undefined") return false;
    const h = window.location.hash || "", s = window.location.search || "";
    return /\baccess_token=|\berror=/.test(h) || /[?&]code=/.test(s);
  });
  const router = useRouter();

  // After a real login (SSO / magic link / password) Supabase returns to the
  // gate. Once the member is resolved, carry them straight inside instead of
  // making them click "Enter the council" again. Demo mode keeps the gate as a
  // landing page (no forced forward).
  useEffect(() => {
    if (mode === "live" && status === "member") {
      // A deep link they followed before logging in (a shared card / heavens /
      // soul address, which AppShell wrote) carries them there. A main nav page
      // never does: login always defaults to Convene, so a logged-out visit to
      // /profile — which AppShell also saves — can't hijack the entrance. Only
      // our own paths are ever honoured, never an outside address.
      let to = "/convene";
      try {
        const saved = sessionStorage.getItem("lcv_return_to");
        sessionStorage.removeItem("lcv_return_to");
        const navHome = /^\/(convene|profile|oracle|codex|tribunal|rite|reveal)(\/|$)/;
        if (saved && /^\/[a-z]/.test(saved) && !saved.startsWith("//") && !navHome.test(saved)) to = saved;
      } catch {}
      router.replace(to);
    }
  }, [mode, status, router]);

  // Never spin forever: if the return never resolves, fall back to the gate.
  useEffect(() => {
    if (!returning) return;
    const t = setTimeout(() => setReturning(false), 10000);
    return () => clearTimeout(t);
  }, [returning]);

  // In the live app a signed-in (or still-resolving) soul is carried straight
  // inside, so the gate shows controls only to a stranger. Everyone mid-entry
  // sees progress instead of a flash of the login page.
  const entering = mode === "live" && (status === "loading" || authed || (returning && status !== "no-membership"));

  return (
    <section style={{ textAlign: "center", padding: "40px 0 20px" }}>
      <div className="moons" style={{ justifyContent: "center", marginBottom: 18, fontSize: 22 }} aria-hidden="true">
        <i className="ti ti-moon-stars" />
        <i className="ti ti-moon" />
        <i className="ti ti-circle" />
        <i className="ti ti-moon-2" />
        <i className="ti ti-moon-stars" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/black-gold-full-logo.png"
        alt="Le Council du Vin · in vino veritas"
        style={{ width: "100%", maxWidth: 340, height: "auto", margin: "0 auto 30px", display: "block" }}
      />

      <div style={{ maxWidth: 320, margin: "0 auto" }}>
        {entering ? (
          <Loading text={returning || authed ? "Entering the council…" : "Consulting the register…"} />
        ) : authed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href="/convene" className="btn gold" style={{ textDecoration: "none", display: "block" }}>
              Enter the council
            </Link>
            <Link href="/initiation" className="btn" style={{ textDecoration: "none", display: "block" }}>
              Petition for initiation
            </Link>
          </div>
        ) : status === "no-membership" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="whisper" style={{ fontSize: 15 }}>
              You are known to the gate, but not yet of the Council. Your petition awaits the Keiser&rsquo;s decree.
            </p>
            <Link href="/initiation" className="btn" style={{ textDecoration: "none", display: "block" }}>
              Petition for initiation
            </Link>
            <button className="btn" onClick={signOut}>Withdraw</button>
          </div>
        ) : showLogin ? (
          <LoginPanel onBack={() => setShowLogin(false)} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button className="btn gold" onClick={() => setShowLogin(true)}>
              Enter the council
            </button>
            <Link href="/initiation" className="btn" style={{ textDecoration: "none", display: "block" }}>
              Petition for initiation
            </Link>
          </div>
        )}
      </div>

      <p className="whisper" style={{ marginTop: 30, fontSize: 15 }}>
        The twelfth moon awaits. Speak the vintage, or be turned away.
      </p>
    </section>
  );
}

function LoginPanel({ onBack }: { onBack: () => void }) {
  const { signInWithGoogle, signInWithOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const doLink = async () => {
    setBusy(true); setErr(null); setMsg(null);
    const res = await signInWithOtp(email);
    setBusy(false);
    if (res.error) setErr(res.error);
    else setMsg("A rite of passage has been sent to your inbox.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
      <button className="btn" onClick={signInWithGoogle} style={{ textAlign: "center" }}>
        <i className="ti ti-brand-google" style={{ marginRight: 6 }} /> Enter by Google
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--faint)" }}>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span className="eyebrow" style={{ fontSize: 8.5 }}>or by sigil</span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@vessel.com"
        autoComplete="email"
        onKeyDown={(e) => { if (e.key === "Enter" && email && !busy) doLink(); }}
      />

      {err && <p style={{ color: "#c98", fontSize: 13, margin: 0 }}>{err}</p>}
      {msg && <p className="scr" style={{ fontSize: 15, margin: 0 }}>{msg}</p>}

      <button className="btn gold" disabled={busy || !email} onClick={doLink}>
        {busy ? "Sending…" : "Send a magic link"}
      </button>
      <p className="whisper" style={{ fontSize: 13, margin: 0, textAlign: "center", fontStyle: "italic" }}>
        We&rsquo;ll email you a link that signs you straight in — no password to remember.
      </p>

      <button onClick={onBack}
        style={{ width: "auto", background: "none", border: "none", color: "var(--faint)", cursor: "pointer", padding: 0, marginTop: 4, fontFamily: "'Inter', system-ui, sans-serif", fontStyle: "italic", fontSize: 15, textAlign: "center" }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 13, marginRight: 4 }} /> turn back
      </button>
    </div>
  );
}
