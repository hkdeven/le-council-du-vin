"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function Gate() {
  const { mode, status, signedIn, hasAccess, signOut } = useAuth();
  const authed = mode === "demo" || (signedIn && hasAccess);
  const [showLogin, setShowLogin] = useState(false);
  const router = useRouter();

  // After a real login (SSO / magic link / password) Supabase returns to the
  // gate. Once the member is resolved, carry them straight inside instead of
  // making them click "Enter the council" again. Demo mode keeps the gate as a
  // landing page (no forced forward).
  useEffect(() => {
    if (mode === "live" && status === "member") router.replace("/convene");
  }, [mode, status, router]);

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
        alt="Le Council du Vin — in vino veritas"
        style={{ width: "100%", maxWidth: 340, height: "auto", margin: "0 auto 30px", display: "block" }}
      />

      <div style={{ maxWidth: 320, margin: "0 auto" }}>
        {status === "loading" ? (
          <p className="whisper" style={{ fontSize: 15 }}>Consulting the register…</p>
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
  const { signInWithGoogle, signInWithOtp, signInWithPassword, signUpWithPassword } = useAuth();
  const [tab, setTab] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const doPassword = async (signup: boolean) => {
    setBusy(true); setErr(null); setMsg(null);
    const res = signup
      ? await signUpWithPassword(email, password)
      : await signInWithPassword(email, password);
    setBusy(false);
    if (res.error) setErr(res.error);
    else if (signup && "needsConfirm" in res && res.needsConfirm) setMsg("Check your inbox to confirm your sigil.");
  };

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
      />
      {tab === "password" && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="your secret word"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === "Enter" && doPassword(false)}
        />
      )}

      {err && <p style={{ color: "#c98", fontSize: 13, margin: 0 }}>{err}</p>}
      {msg && <p className="scr" style={{ fontSize: 15, margin: 0 }}>{msg}</p>}

      {tab === "password" ? (
        <>
          <button className="btn gold" disabled={busy || !email || !password} onClick={() => doPassword(false)}>
            {busy ? "Entering…" : "Enter"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <button onClick={() => doPassword(true)} disabled={busy || !email || !password}
              style={{ width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15 }}>
              Forge a secret word
            </button>
            <button onClick={() => { setTab("link"); setErr(null); setMsg(null); }}
              style={{ width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15 }}>
              Send a magic link
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="btn gold" disabled={busy || !email} onClick={doLink}>
            {busy ? "Sending…" : "Send magic link"}
          </button>
          <button onClick={() => { setTab("password"); setErr(null); setMsg(null); }}
            style={{ width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, textAlign: "center" }}>
            Enter with a secret word instead
          </button>
        </>
      )}

      <button onClick={onBack}
        style={{ width: "auto", background: "none", border: "none", color: "var(--faint)", cursor: "pointer", padding: 0, marginTop: 4, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, textAlign: "center" }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 13, marginRight: 4 }} /> turn back
      </button>
    </div>
  );
}
