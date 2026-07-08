"use client";

// The Foretelling: a personal reading computed from real transits against the
// member's natal chart. Two views: this moon (new moon to new moon) and the
// year glimpsed. Computed, never invented; the passages are written by hand.

import { useEffect, useMemo, useRef, useState } from "react";
import { foretellingFor, type Omen } from "@/lib/transits";
import { AstralShell, VeiledGate, Methodology, chartReady } from "./NatalChart";
import type { CardMember } from "./MemberCard";

function OmenBlock({ o }: { o: Omen }) {
  return (
    <div style={{ background: "#0d0b0a", border: "1px solid var(--line)", borderRadius: 10, padding: "11px 14px", marginBottom: 10, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
        <span style={{ color: "var(--gold2)", fontSize: 15, letterSpacing: 2, whiteSpace: "nowrap" }}>{o.glyphs}</span>
        <span className="eyebrow" style={{ flex: 1, fontSize: 11, lineHeight: 1.5 }}>{o.title}</span>
        <span style={{ color: "var(--faint)", fontSize: 12, whiteSpace: "nowrap" }}>{o.when}</span>
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: "var(--parch)", lineHeight: 1.5 }}>{o.body}</div>
    </div>
  );
}

export default function ForetellingModal({ member, onClose, onLeave, isSelf }: { member: CardMember; onClose: () => void; onLeave?: () => void; isSelf?: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  const close = () => { setShown(false); setTimeout(onClose, 240); };
  const [view, setView] = useState<"moon" | "year">("moon");
  const [tipOpen, setTipOpen] = useState(false);
  const tipMe = useRef({});
  useEffect(() => {
    if (!tipOpen) return;
    window.dispatchEvent(new CustomEvent("lcv-tip-open", { detail: tipMe.current }));
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== tipMe.current) setTipOpen(false);
    };
    window.addEventListener("lcv-tip-open", onOther);
    return () => window.removeEventListener("lcv-tip-open", onOther);
  }, [tipOpen]);

  const ready = chartReady(member);
  const reading = useMemo(
    () => (ready ? foretellingFor({ dateStr: member.date_of_birth!, timeStr: member.time_of_birth, tz: member.birth_tz, lat: member.birth_lat, lon: member.birth_lon }, Date.now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, member.date_of_birth, member.time_of_birth, member.birth_tz, member.birth_lat, member.birth_lon]
  );

  return (
    <AstralShell shown={shown} onClose={close}>
      {!ready || !reading ? (
        <VeiledGate member={member} what="the foretelling cannot be read" isSelf={isSelf} onGo={onLeave || close} />
      ) : (
        <>
          <div className="disp" style={{ fontSize: 19 }}>The Foretelling</div>
          <p className="whisper" style={{ fontSize: 13, margin: "2px 0 12px" }}>
            what the sky intends for {isSelf ? "you" : member.cult_name} · computed, never invented
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "0 0 16px" }}>
            <span className={`pill${view === "moon" ? " on" : ""}`} onClick={() => setView("moon")} style={{ position: "relative" }}>
              This moon
              <button aria-label="More" onClick={(e) => { e.stopPropagation(); setTipOpen((o) => !o); }}
                style={{ background: "none", border: "none", padding: 0, marginLeft: 5, cursor: "pointer", color: "var(--dim)", width: "auto", display: "inline-flex" }}>
                <i className="ti ti-info-circle" style={{ fontSize: 11 }} />
              </button>
              {tipOpen && (
                <span role="tooltip" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 9, width: 200, background: "#0d0b0a", border: "1px solid var(--line2)", borderRadius: 8, padding: "8px 10px", color: "var(--parch)", fontSize: 12, lineHeight: 1.5, textAlign: "left", fontFamily: "'EB Garamond', serif", textTransform: "none", letterSpacing: "normal" }}>
                  Read by the moon itself: the reading runs from new moon to new moon, not the calendar month.
                </span>
              )}
            </span>
            <span className={`pill${view === "year" ? " on" : ""}`} onClick={() => setView("year")}>The year</span>
          </div>

          {view === "moon" ? (
            <>
              <p className="whisper" style={{ margin: "0 0 12px", fontSize: 13 }}>{reading.moonLabel}</p>
              {reading.entries.map((o, i) => <OmenBlock key={i} o={o} />)}
              {reading.warning && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--wine)", color: "#c17b80", borderRadius: 14, padding: "6px 12px", fontSize: 12.5, marginBottom: 4 }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 13 }} />{reading.warning}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="whisper" style={{ margin: "0 0 12px", fontSize: 13 }}>{reading.yearLabel}, glimpsed</p>
              {reading.year.map((o, i) => <OmenBlock key={i} o={o} />)}
            </>
          )}

          <p className="whisper" style={{ margin: "8px 0 0", fontSize: 12 }}>the vine calculates, it does not flatter</p>
          <Methodology title="How this reading is made">
            The positions of the planets for the month and year ahead are computed by the same astronomical engine as the natal chart, then compared against this chart. A transit is reported only when a real geometric alignment occurs, with its true dates; moon phases and retrogrades are exact to the day. The words that interpret each alignment are written once, by hand, in the Council&apos;s voice, and chosen by the alignment itself, never at random. Nothing is padded to fill a quiet month: a quiet month reads quiet.
          </Methodology>
        </>
      )}
    </AstralShell>
  );
}
