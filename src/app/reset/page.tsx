"use client";

// Where the "Forgot password" email delivers the soul: Supabase opens a
// recovery session from the link, and here they forge the new secret word.

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setHasSession(false); return; }
    // The recovery token in the URL becomes a session; give it a beat to land.
    let active = true;
    const check = async () => {
      const { data } = await supabase!.auth.getSession();
      if (active) setHasSession(!!data.session);
    };
    check();
    const t = setTimeout(check, 1500);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (active) setHasSession(!!s); });
    return () => { active = false; clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  const save = async () => {
    setErr(null);
    if (password.length < 8) { setErr("The word must carry at least 8 characters."); return; }
    if (password !== again) { setErr("The words do not match."); return; }
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) setErr(res.error);
    else setDone(true);
  };

  return (
    <section style={{ maxWidth: 420, margin: "0 auto", padding: "70px 18px", textAlign: "center" }}>
      <h1 className="disp" style={{ fontSize: 22, fontWeight: 500 }}>Forge a new secret word</h1>

      {hasSession === null ? (
        <p className="whisper" style={{ fontSize: 15, marginTop: 14 }}>Reading the sigil…</p>
      ) : done ? (
        <>
          <p className="scr" style={{ fontSize: 16, marginTop: 14 }}>It is sealed. Your new word opens the gate.</p>
          <Link href="/" className="btn gold" style={{ display: "inline-block", marginTop: 18, textDecoration: "none", width: "auto", padding: "12px 26px" }}>
            Enter the Council
          </Link>
        </>
      ) : !hasSession ? (
        <>
          <p className="whisper" style={{ fontSize: 15, marginTop: 14 }}>
            The path has faded. Return to the gate and ask again with &ldquo;Forgot password&rdquo;.
          </p>
          <Link href="/" className="btn" style={{ display: "inline-block", marginTop: 18, textDecoration: "none", width: "auto", padding: "12px 26px" }}>
            Back to the gate
          </Link>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18, textAlign: "left" }}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="your new secret word" autoComplete="new-password" />
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)}
            placeholder="speak it once more" autoComplete="new-password"
            onKeyDown={(e) => e.key === "Enter" && save()} />
          {err && <p style={{ color: "#c98", fontSize: 13, margin: 0 }}>{err}</p>}
          <button className="btn gold" disabled={busy || !password || !again} onClick={save}>
            {busy ? "Sealing…" : "Seal the word"}
          </button>
        </div>
      )}
    </section>
  );
}
