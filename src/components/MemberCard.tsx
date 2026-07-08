"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sunSign, moonSign, ascendant, shengxiao, wuXing, venusSign, moonPhase, dayMaster, lifePath, birthArcana, VENUS_IN } from "@/lib/astrology";
import { fetchAnnals } from "@/lib/annals";
import { dossierFor, type DossierStats } from "@/lib/dossier";
import { useAuth } from "./AuthProvider";
import { seedMembers } from "@/lib/seed";
import { useBodyLock } from "./NatalChart";
import NatalChartModal from "./NatalChart";
import ForetellingModal from "./Foretelling";
import Avatar from "./Avatar";

// A card can be shown for a full member OR a lighter subject (e.g. a tribunal
// petitioner or a name-only summoned soul). Only cult_name is required.
export interface CardMember {
  cult_name: string;
  id?: string; // enables the Palate Dossier (ballot history is keyed by id)
  last_hosted?: string | null;
  short_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  date_of_birth?: string | null;
  time_of_birth?: string | null;
  birth_place?: string | null;
  birth_lat?: number | null;
  birth_lon?: number | null;
  birth_tz?: string | null;
}

const ELEMENT_TIP = "This defines the fundamental energy, temperament, and personality traits of each sign.";
const SUN_TIP = 'Core identity, ego, and life purpose (what most call their "star sign").';
const MOON_TIP = "Inner emotions, subconscious, and private self.";
const ASC_TIP = "The sign rising on the eastern horizon at the exact birth time and place: outward personality and how others first perceive them.";
const SX_TIP = "The Chinese zodiac: a 12-year cycle, each year a specific animal.";
const WX_TIP = "The five elements govern deeper personality, destiny, and how one moves through the world.";
const DM_TIP = "The Bazi day-master: the element of the day of birth in the Chinese sexagenary cycle, held to be the truest self.";
const LP_TIP = "Numerology: the whole birth date reduced to its ruling number.";
const VENUS_TIP = "Venus, the planet of taste, pleasure, and desire: how they savour.";
const ARC_TIP = "The tarot birth card: the Major Arcana card hidden in the digits of the birth date. It names the archetype a soul carries for life, the lesson and power that keep returning.";

const initialsOf = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function Tip({ text, align = "right" }: { text: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLSpanElement>(null);
  // Hover-open only where hover exists. On touch, mouseenter fires WITH the
  // tap and the click-toggle then closed it again — the "tooltips don't open"
  // bug. Touch devices get a clean tap-to-toggle.
  const hoverable = typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  // Keep the tooltip on-screen: measure once shown and nudge it back inside
  // the viewport (labels sit near the left edge, values near the right).
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!open || !el) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let dx = 0;
    if (r.left < 8) dx = 8 - r.left;
    else if (r.right > vw - 8) dx = vw - 8 - r.right;
    if (dx) el.style.transform = `translateX(${dx}px)`;
  }, [open]);
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 5 }}>
      <button type="button" aria-label="More" onClick={() => setOpen((o) => !o)}
        onMouseEnter={hoverable ? () => setOpen(true) : undefined}
        onMouseLeave={hoverable ? () => setOpen(false) : undefined}
        style={{ background: "none", border: "none", padding: 5, margin: -3, cursor: "pointer", color: "var(--dim)", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "auto", minWidth: 24, minHeight: 24 }}>
        <i className="ti ti-info-circle" style={{ fontSize: 13 }} />
      </button>
      {open && (
        <span ref={tipRef} role="tooltip" style={{ position: "absolute", top: "calc(100% + 6px)", [align]: 0, zIndex: 60, width: 200, background: "#0d0b0a", border: "1px solid var(--line2)", borderRadius: 8, padding: "8px 10px", color: "var(--parch)", fontSize: 12, lineHeight: 1.5, fontFamily: "'EB Garamond', serif", fontStyle: "normal", letterSpacing: "normal", textTransform: "none", boxShadow: "0 6px 20px rgba(0,0,0,0.55)" } as React.CSSProperties}>
          {text}
        </span>
      )}
    </span>
  );
}

function Row({ label, tip, value, valueTip }: { label: string; tip: string; value: string; valueTip?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "5px 0" }}>
      <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center" }}>{label}<Tip text={tip} align="left" /></span>
      <span style={{ display: "inline-flex", alignItems: "center", color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontSize: 16 }}>{value}{valueTip && <Tip text={valueTip} />}</span>
    </div>
  );
}

// The tarot-style stats card for a member, opened by clicking their avatar.
function CardModal({ member, chalices, shown, onClose }: { member: CardMember; chalices: number; shown: boolean; onClose: () => void }) {
  useBodyLock();
  // Is the viewer looking at their own card? Pronouns bend accordingly.
  const { member: authMember, role, mode } = useAuth();
  const isSelf = !!member.id && (mode === "live"
    ? member.id === authMember?.id
    : member.id === seedMembers.find((sm) => sm.role === role)?.id);
  const dob = member.date_of_birth || "";
  const tob = member.time_of_birth || "";
  const tz = member.birth_tz || undefined;
  const sun = dob ? sunSign(dob, tob || undefined, tz) : null;
  const moon = dob ? moonSign(dob, tob || undefined, tz) : null;
  const rising = dob ? ascendant(dob, tob || undefined, tz, member.birth_lat, member.birth_lon) : null;
  const animal = dob ? shengxiao(dob) : null;
  const wx = dob ? wuXing(dob) : null;
  const venus = dob ? venusSign(dob, tob || undefined, tz) : null;
  const phase = dob ? moonPhase(dob, tob || undefined, tz) : null;
  const dm = dob ? dayMaster(dob) : null;
  const lp = dob ? lifePath(dob) : null;
  const arc = dob ? birthArcana(dob) : null;

  // The Palate Dossier: derived from real ballots + annals (needs an id).
  const [dossier, setDossier] = useState<DossierStats | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [showFore, setShowFore] = useState(false);
  useEffect(() => {
    if (!member.id) return;
    let active = true;
    dossierFor({ id: member.id, cult_name: member.cult_name, last_hosted: member.last_hosted }).then((d) => {
      if (active) setDossier(d);
    }).catch(() => {});
    return () => { active = false; };
  }, [member.id, member.cult_name, member.last_hosted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // The OVERLAY scrolls, not the card: the card keeps its natural height and
    // margin:auto centres it when short / top-anchors it when tall. No inner
    // scroll container means nothing to clip, drift, or leave black space on
    // mobile browsers.
    <div className="modal-scroll" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", overflowY: "auto", display: "flex", padding: 18, opacity: shown ? 1 : 0, transition: "opacity 0.22s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 340, margin: "auto", background: "linear-gradient(180deg,#12100e,#0a0908)", border: "1px solid var(--gold)", borderRadius: 14, boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 20px 60px rgba(0,0,0,0.7)", padding: "22px 20px 24px", textAlign: "center", transform: shown ? "scale(1) translateY(0)" : "scale(0.9) translateY(10px)", transition: "transform 0.26s cubic-bezier(0.2,0.9,0.3,1)", transformOrigin: "center" }}>
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
        {phase && (
          <div style={{ marginTop: 3, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: "var(--gold)" }}>
            {phase}<Tip text="Moon phase at birth" />
          </div>
        )}
        {member.role && <div style={{ marginTop: 4 }}><span className="tag">{member.role}</span></div>}

        <div style={{ borderTop: "1px solid var(--line)", margin: "16px 0 6px" }} />

        {dob ? (
          <div style={{ textAlign: "left" }}>
            <Row label="Element" tip={ELEMENT_TIP} value={sun?.element || "—"} />
            <Row label="Sun sign" tip={SUN_TIP} value={sun ? `${sun.symbol} ${sun.name}` : "—"} />
            <Row label="Moon sign" tip={MOON_TIP} value={moon ? `${moon.symbol} ${moon.name}` : "—"} />
            <Row label="Ascendant" tip={ASC_TIP} value={rising ? `${rising.symbol} ${rising.name}` : !tob ? "unknown hour" : "unknown place"} />
            <Row label="Shengxiao" tip={SX_TIP} value={animal ? `${animal.symbol} ${animal.name}` : "—"} />
            <Row label="Wu Xing" tip={WX_TIP} value={wx ? `${wx.symbol} ${wx.name}` : "—"} valueTip={wx?.meaning} />
            <Row label="Day-master" tip={DM_TIP} value={dm ? `${dm.hanzi} ${dm.polarity} ${dm.element}` : "—"} valueTip={dm?.meaning} />
            <Row label="Life path" tip={LP_TIP} value={lp ? String(lp.number) : "—"} valueTip={lp?.meaning} />
            <Row label="Venus sign" tip={VENUS_TIP} value={venus ? `${venus.symbol} ${venus.name}` : "—"} valueTip={venus ? VENUS_IN[venus.name] : undefined} />
            <Row label="Birth arcana" tip={ARC_TIP} value={arc ? arc.name : "—"} valueTip={arc?.meaning} />
          </div>
        ) : (
          <p className="whisper" style={{ fontSize: 14, margin: "6px 0" }}>The stars that made {isSelf ? "you" : "them"} are unrecorded.</p>
        )}

        <MoonRow />

        <div className="disp" style={{ fontSize: 15 }}>The Palate Dossier</div>
        <p className="whisper" style={{ fontSize: 13, margin: "2px 0 18px" }}>what the vine has learned of {isSelf ? "you" : "them"}</p>
        {dossier ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <Medallion num={String(dossier.moonsStood)} cap={"Moons\nstood"} />
              <Medallion num={String(dossier.bottlesCrowned)} cap={"Bottles\ncrowned"} />
              <Medallion num={String(dossier.marks)} of="of 5" cap={"Marks\nagainst"} warn={dossier.marks > 0} />
            </div>
            <div style={{ height: 14 }} />
            <div style={{ textAlign: "left" }}>
              <Row label="Palate temper" tip="How they score against the Council's average across every sealed ballot." value={dossier.temper ? dossier.temper.label : "too few ballots yet"} valueTip={dossier.temper ? `They pour ${dossier.temper.delta >= 0 ? "+" : ""}${dossier.temper.delta.toFixed(1)} against the table.` : undefined} />
              <Row label="Kindred palate" tip="The member whose scores track closest to theirs across shared gatherings." value={dossier.kindred || "not yet revealed"} />
              <Row label="The wheel" tip="Moons since they last hosted a gathering." value={dossier.wheel || "has not yet hosted"} />
              <Row label="Longest communion" tip="Their longest run of consecutive gatherings attended." value={dossier.communion > 0 ? `${dossier.communion} gathering${dossier.communion === 1 ? "" : "s"}` : "—"} />
            </div>

            <MoonRow />
            <div className="eyebrow" style={{ fontSize: 14, marginBottom: 12 }}>Nose</div>
            {dossier.nose.length > 0 ? (
              <div style={{ position: "relative", lineHeight: 1.5, padding: "2px 0", overflowWrap: "break-word" }}>
                <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(203,189,147,0.08), transparent 68%)", pointerEvents: "none" }} />
                {noseSpread(dossier.nose).map((n) => (
                  <span key={n.aroma} title={`${n.count}`} style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", margin: "0 6px", display: "inline-block", ...NOSE_W[n.w] }}>{n.aroma}</span>
                ))}
              </div>
            ) : (
              <p className="whisper" style={{ fontSize: 14, margin: 0 }}>No aromas yet marked in the rite.</p>
            )}

            <MoonRow />
            <div className="eyebrow" style={{ fontSize: 14, marginBottom: 12 }}>{isSelf ? "Your" : "Their"} Finest Pours</div>
            {dossier.pours.length > 0 ? dossier.pours.map((pr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)", textAlign: "left" }}>
                <span style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--line2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel', serif", color: "var(--gold2)", fontSize: 13 }}>{["I", "II", "III"][i]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--gold2)", fontSize: 17, lineHeight: 1.15 }}>{pr.title}</span>
                  <span style={{ display: "block", color: "var(--dim)", fontSize: 12, marginTop: 2 }}>{pr.meta}</span>
                </span>
                <span style={{ flex: "none", textAlign: "right" }}>
                  <span style={{ display: "block", fontFamily: "'Cinzel', serif", color: "var(--gold2)", fontSize: 17 }}>{pr.score.toFixed(1)}</span>
                  <span className="eyebrow" style={{ display: "block", fontSize: 8, color: "var(--faint)", marginTop: 1 }}>{pr.rank === 1 ? "crowned" : pr.rank === 2 ? "second" : pr.rank === 3 ? "third" : `${pr.rank}th`}</span>
                </span>
              </div>
            )) : (
              <p className="whisper" style={{ fontSize: 14, margin: 0 }}>No bottles yet stood at the reveal.</p>
            )}
          </>
        ) : (
          <p className="whisper" style={{ fontSize: 14, margin: "4px 0" }}>{member.id ? "The vine is remembering…" : "The vine has no record of them yet."}</p>
        )}

        <div style={{ borderTop: "2px solid var(--gold)", margin: "16px -20px" }} />
        <div className="eyebrow" style={{ fontSize: 12, marginBottom: 10 }}>Chalice count</div>
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
        <div style={{ borderTop: "2px solid var(--gold)", margin: "16px -20px 30px" }} />

        <button className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }} onClick={() => setShowChart(true)}>
          <i className="ti ti-chart-donut" style={{ fontSize: 15, color: "var(--gold)" }} />Behold the natal chart
        </button>
        <button className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 10 }} onClick={() => setShowFore(true)}>
          <i className="ti ti-sparkles" style={{ fontSize: 15, color: "var(--gold)" }} />The Foretelling
        </button>

        {showChart && <NatalChartModal member={member} isSelf={isSelf} onClose={() => setShowChart(false)} onLeave={() => { setShowChart(false); onClose(); }} />}
        {showFore && <ForetellingModal member={member} isSelf={isSelf} onClose={() => setShowFore(false)} onLeave={() => { setShowFore(false); onClose(); }} />}
      </div>
    </div>
  );
}

// The moon-phase divider row used between card sections.
function MoonRow() {
  return (
    <div className="moons" style={{ justifyContent: "center", fontSize: 14, margin: "18px 0", color: "var(--gold)", opacity: 0.55 }} aria-hidden="true">
      <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
    </div>
  );
}

// A gold hairline stat disc for the dossier.
function Medallion({ num, cap, of, warn }: { num: string; cap: string; of?: string; warn?: boolean }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 82, height: 82, borderRadius: "50%", border: `1px solid ${warn ? "var(--wine)" : "var(--line2)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: of ? 21 : 26, color: warn ? "#c17b80" : "var(--gold2)", lineHeight: 1 }}>{num}</span>
        {of && <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "var(--dim)", marginTop: 1, letterSpacing: "0.1em" }}>{of}</span>}
      </div>
      <div className="eyebrow" style={{ fontSize: 9, color: "var(--dim)", marginTop: 8, textAlign: "center", lineHeight: 1.3, whiteSpace: "pre-line" }}>{cap}</div>
    </div>
  );
}

// Word-cloud weights: rank by count into six buckets, display alphabetically.
const NOSE_W: Record<number, React.CSSProperties> = {
  1: { fontSize: 12, color: "var(--faint)" },
  2: { fontSize: 14, color: "var(--dim)" },
  3: { fontSize: 16, color: "var(--parch)" },
  4: { fontSize: 19, color: "var(--gold)" },
  5: { fontSize: 23, color: "var(--gold2)" },
  6: { fontSize: 27, color: "var(--gold2)", textShadow: "0 0 12px rgba(203,189,147,0.4)" },
};
function noseSpread(nose: { aroma: string; count: number }[]): { aroma: string; count: number; w: number }[] {
  const ranked = nose.map((n, i) => ({ ...n, w: i === 0 ? 6 : i <= 2 ? 5 : i <= 5 ? 4 : i <= 9 ? 3 : i <= 12 ? 2 : 1 }));
  return [...ranked].sort((a, b) => a.aroma.localeCompare(b.aroma));
}

// A member's avatar that opens their tarot-style stats card on click. Drop-in
// replacement wherever a member circle-icon appears.
export default function MemberCard({ member, size = 30 }: { member: CardMember; size?: number }) {
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
      const wins = annals.filter((a) => a.rows.some((r) => r.rank === 1 && r.owner === member.cult_name)).length;
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
