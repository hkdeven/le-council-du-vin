"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sunSign, moonSign, risingSign, shengxiao, wuXing } from "@/lib/astrology";
import { fetchAnnals } from "@/lib/annals";
import Avatar from "./Avatar";
import type { Member } from "@/lib/types";

const SUN_TIP = 'Core identity, ego, and life purpose (what most call their "star sign").';
const MOON_TIP = "Inner emotions, subconscious, and private self.";
const ASC_TIP = "The sign rising on the eastern horizon at the exact birth time — outward personality and how others first perceive them.";
const SX_TIP = "The Chinese zodiac: a 12-year cycle, each year a specific animal.";
const WX_TIP = "The five elements govern deeper personality, destiny, and how one moves through the world.";

const initialsOf = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 5 }}>
      <button type="button" aria-label="More" onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--dim)", display: "inline-flex", width: "auto" }}>
        <i className="ti ti-info-circle" style={{ fontSize: 12 }} />
      </button>
      {open && (
        <span role="tooltip" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, width: 210, background: "#0d0b0a", border: "1px solid var(--line2)", borderRadius: 8, padding: "8px 10px", color: "var(--parch)", fontSize: 12, lineHeight: 1.5, fontFamily: "'EB Garamond', serif", fontStyle: "normal", letterSpacing: "normal", textTransform: "none", boxShadow: "0 6px 20px rgba(0,0,0,0.55)" }}>
          {text}
        </span>
      )}
    </span>
  );
}

function Row({ label, tip, value }: { label: string; tip: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "5px 0" }}>
      <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center" }}>{label}<Tip text={tip} /></span>
      <span style={{ color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontSize: 16 }}>{value}</span>
    </div>
  );
}

// The tarot-style stats card for a member, opened by clicking their avatar.
function CardModal({ member, chalices, shown, onClose }: { member: Member; chalices: number; shown: boolean; onClose: () => void }) {
  const dob = member.date_of_birth || "";
  const tob = member.time_of_birth || "";
  const sun = dob ? sunSign(dob) : null;
  const moon = dob ? moonSign(dob, tob || undefined) : null;
  const rising = dob && tob ? risingSign(dob, tob) : null;
  const animal = dob ? shengxiao(dob) : null;
  const wx = dob ? wuXing(dob) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, opacity: shown ? 1 : 0, transition: "opacity 0.22s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 340, maxHeight: "90vh", overflowY: "auto", background: "linear-gradient(180deg,#12100e,#0a0908)", border: "1px solid var(--gold)", borderRadius: 14, boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 20px 60px rgba(0,0,0,0.7)", padding: "22px 20px 24px", textAlign: "center", transform: shown ? "scale(1) translateY(0)" : "scale(0.9) translateY(10px)", transition: "transform 0.26s cubic-bezier(0.2,0.9,0.3,1)", transformOrigin: "center" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 8, right: 8, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 6 }}>
          <i className="ti ti-x" style={{ fontSize: 16 }} />
        </button>

        <div className="moons" style={{ justifyContent: "center", fontSize: 14, marginBottom: 12, color: "var(--gold)", opacity: 0.6 }} aria-hidden="true">
          <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <Avatar src={member.avatar_url} initials={member.short_name || initialsOf(member.cult_name)} size={72} />
        </div>
        <div className="disp" style={{ fontSize: 19 }}>{member.cult_name}</div>
        <div style={{ marginTop: 4 }}><span className="tag">{member.role}</span></div>

        <div style={{ borderTop: "1px solid var(--line)", margin: "16px 0 6px" }} />

        {dob ? (
          <div style={{ textAlign: "left" }}>
            <Row label="Element" tip="The classical element of their sun sign." value={sun?.element || "—"} />
            <Row label="Sun sign" tip={SUN_TIP} value={sun ? `${sun.symbol} ${sun.name}` : "—"} />
            <Row label="Moon sign" tip={MOON_TIP} value={moon ? `${moon.symbol} ${moon.name}` : "—"} />
            <Row label="Ascendant" tip={ASC_TIP} value={rising ? `${rising.symbol} ${rising.name}` : "unknown hour"} />
            <Row label="Shengxiao" tip={SX_TIP} value={animal ? `${animal.symbol} ${animal.name}` : "—"} />
            <Row label="Wu Xing" tip={WX_TIP} value={wx ? `${wx.symbol} ${wx.name}` : "—"} />
          </div>
        ) : (
          <p className="whisper" style={{ fontSize: 14, margin: "6px 0" }}>The stars that made them are unrecorded.</p>
        )}

        <div style={{ borderTop: "1px solid var(--line)", margin: "14px 0 12px" }} />

        <div className="eyebrow" style={{ marginBottom: 10 }}>Chalice count</div>
        {chalices > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {Array.from({ length: chalices }).map((_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src="/chalice.webp" alt="" width={22} height={31} style={{ display: "block" }} />
            ))}
          </div>
        ) : (
          <p className="whisper" style={{ fontSize: 14, margin: 0 }}>No moons yet crowned.</p>
        )}
      </div>
    </div>
  );
}

// A member's avatar that opens their tarot-style stats card on click. Drop-in
// replacement wherever a member circle-icon appears.
export default function MemberCard({ member, size = 30 }: { member: Member; size?: number }) {
  const [open, setOpen] = useState(false);   // mounted (kept during the exit animation)
  const [shown, setShown] = useState(false); // drives the fade + zoom
  const [chalices, setChalices] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Animate in on the next frame after mounting; animate out then unmount.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);
  const close = () => {
    setShown(false);
    setTimeout(() => setOpen(false), 260);
  };

  useEffect(() => {
    if (!open) return;
    fetchAnnals().then((annals) => {
      const wins = annals.filter((a) => a.rows.find((r) => r.rank === 1)?.owner === member.cult_name).length;
      setChalices(wins);
    });
  }, [open, member.cult_name]);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`View ${member.cult_name}'s card`} title={member.cult_name}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", width: "auto", lineHeight: 0 }}>
        <Avatar src={member.avatar_url} initials={member.short_name || initialsOf(member.cult_name)} size={size} />
      </button>
      {mounted && open && createPortal(<CardModal member={member} chalices={chalices} shown={shown} onClose={close} />, document.body)}
    </>
  );
}
