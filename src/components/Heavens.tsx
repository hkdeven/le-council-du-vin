"use client";

// The Heavens: one door for all of the sky. Three stops under one pill,
// the Wheel · the Foretelling · the Kundli; the Foretelling carries both
// skies behind its own lens. Rendered as the back face of the member card
// (the card turns over to reveal it) and pre-opened from the profile's door.
// Every stop ends with its own envelope on the owner's card.

import { useState } from "react";
import { chartReady, NatalContent, VeiledGate } from "./NatalChart";
import { ForetellingContent } from "./Foretelling";
import { KundliContent } from "./Kundli";
import type { CardMember } from "./MemberCard";
import { emailWheel, emailForetelling, emailKundli, emailVedicForetelling } from "@/lib/skyEmails";
import { useAuth } from "./AuthProvider";

type Stop = "wheel" | "fore" | "kundli";

export default function HeavensFace({ member, isSelf, onGo, onBack }: {
  member: CardMember;
  isSelf?: boolean;
  onGo: () => void; // close everything (the veiled gate's road to the profile)
  onBack?: () => void; // turn the card back over; absent on the profile's door
}) {
  const [stop, setStop] = useState<Stop>("wheel");
  const { email } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ready = chartReady(member);

  const emailThis = async () => {
    if (!isSelf || busy) return;
    if (!email) { setMsg("No inbox is known for you in this mode."); return; }
    setBusy(true); setMsg(null);
    try {
      const lens = typeof window !== "undefined" && localStorage.getItem("lcv_sky_lens") === "vedic" ? "vedic" : "west";
      const res =
        stop === "wheel" ? await emailWheel(member, email) :
        stop === "kundli" ? await emailKundli(member, email) :
        lens === "vedic" ? await emailVedicForetelling(member, email) :
        await emailForetelling(member, email);
      setMsg(res.ok ? "Sent. Consult your inbox." : res.skipped ? "The heralds are not yet configured." : res.error || "The herald failed on the road.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {onBack && (
        <button onClick={onBack} aria-label="Back to the card" title="Back to the card"
          style={{ position: "absolute", top: 6, left: 6, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 12, zIndex: 2 }}>
          <i className="ti ti-arrow-back-up" style={{ fontSize: 18 }} />
        </button>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 11, color: "var(--gold)", opacity: 0.55, fontSize: 14, marginBottom: 12 }}>
        <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
      </div>
      <div className="disp" style={{ fontSize: 19 }}>The Heavens</div>
      <p className="whisper" style={{ fontSize: 13, margin: "2px 0 0" }}>
        the sky at {isSelf ? "your" : "their"} first breath, and the sky to come
      </p>

      <div style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 16, overflow: "hidden", margin: "12px 0 14px" }}>
        {([
          { key: "wheel", label: "The Wheel" },
          { key: "fore", label: "The Foretelling" },
          { key: "kundli", label: "The Kundli" },
        ] as const).map((seg) => (
          <button key={seg.key} onClick={() => setStop(seg.key)}
            style={{ width: "auto", border: "none", cursor: "pointer", padding: "7px 10px", background: stop === seg.key ? "var(--gold2)" : "none", color: stop === seg.key ? "#0a0908" : "var(--dim)", fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {seg.label}
          </button>
        ))}
      </div>

      {!ready ? (
        <VeiledGate member={member} what="the heavens cannot be opened" isSelf={isSelf} onGo={onGo} />
      ) : stop === "wheel" ? (
        <NatalContent member={member} isSelf={isSelf} onGo={onGo} />
      ) : stop === "fore" ? (
        <ForetellingContent member={member} isSelf={isSelf} onGo={onGo} />
      ) : (
        <KundliContent member={member} isSelf={isSelf} onGo={onGo} />
      )}

      {(isSelf && ready) && (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
          <button onClick={emailThis} disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto", background: "none", border: "1px solid var(--line2)", borderRadius: 10, color: "var(--parch)", fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: "0.08em", padding: "10px 22px", cursor: "pointer" }}>
            <i className={`ti ti-${busy ? "loader-2" : "mail"}`} style={{ color: "var(--gold)", fontSize: 14 }} />Email me this view
          </button>
          {msg && <p className="scr" style={{ margin: "8px 0 0", fontSize: 14 }}>{msg}</p>}
        </div>
      )}

      {onBack && (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 10 }}>
          <button onClick={onBack}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 10px" }}>
            <i className="ti ti-arrow-back-up" style={{ color: "var(--gold)", fontSize: 14 }} />Turn the card back
          </button>
        </div>
      )}
    </>
  );
}
