"use client";

// The Foretelling: a personal reading computed from real transits against the
// member's natal chart. Three views: this day (the Moon's crossing + exact
// fast-planet aspects), this moon (new moon to new moon), and the year
// glimpsed. Computed, never invented; the passages are written by hand and
// spoken plainly on the page (the emails keep the Council tongue).

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
      <div style={{ fontFamily: "'EB Garamond', serif", fontSize: 14.5, color: "var(--parch)", lineHeight: 1.55 }}>{o.plain || o.body}</div>
    </div>
  );
}

export default function ForetellingModal({ member, onClose, onLeave, isSelf }: { member: CardMember; onClose: () => void; onLeave?: () => void; isSelf?: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  const close = () => { setShown(false); setTimeout(onClose, 240); };
  const [view, setView] = useState<"day" | "moon" | "year">("day");
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
          {/* One segmented pill: the active view wears the gold. */}
          <div style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 18, overflow: "visible", margin: "0 0 16px", position: "relative" }}>
            {([
              { key: "day", label: "This day" },
              { key: "moon", label: "This moon" },
              { key: "year", label: "The year" },
            ] as const).map((seg, i) => (
              <button key={seg.key} onClick={() => setView(seg.key)}
                style={{
                  width: "auto", border: "none", cursor: "pointer", padding: "8px 14px",
                  borderRadius: i === 0 ? "17px 0 0 17px" : i === 2 ? "0 17px 17px 0" : 0,
                  borderLeft: i > 0 ? "1px solid var(--line2)" : "none",
                  background: view === seg.key ? "var(--gold2)" : "none",
                  color: view === seg.key ? "#0a0908" : "var(--dim)",
                  fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                  display: "inline-flex", alignItems: "center", gap: 5, position: "relative",
                }}>
                {seg.label}
                {seg.key === "moon" && (
                  <>
                    <span role="button" aria-label="More" onClick={(e) => { e.stopPropagation(); setTipOpen((o) => !o); }}
                      style={{ display: "inline-flex", cursor: "pointer", color: view === "moon" ? "#0a0908" : "var(--dim)" }}>
                      <i className="ti ti-info-circle" style={{ fontSize: 11 }} />
                    </span>
                    {tipOpen && (
                      <span role="tooltip" style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 9, width: 200, background: "#0d0b0a", border: "1px solid var(--line2)", borderRadius: 8, padding: "8px 10px", color: "var(--parch)", fontSize: 12, lineHeight: 1.5, textAlign: "left", fontFamily: "'EB Garamond', serif", textTransform: "none", letterSpacing: "normal" }}>
                        Read by the moon itself: the moon view runs from new moon to new moon, not the calendar month.
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>

          {view === "day" ? (
            <>
              <p className="whisper" style={{ margin: "0 0 12px", fontSize: 13 }}>{reading.dayLabel}</p>
              {reading.day.map((o, i) => <OmenBlock key={i} o={o} />)}
            </>
          ) : view === "moon" ? (
            <>
              <p className="whisper" style={{ margin: "0 0 12px", fontSize: 13 }}>{reading.moonLabel}</p>
              {reading.entries.map((o, i) => <OmenBlock key={i} o={o} />)}
              {reading.warning && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--wine)", color: "#c17b80", borderRadius: 14, padding: "6px 12px", fontSize: 12.5, marginBottom: 4 }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 13 }} />{reading.warningPlain || reading.warning}
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
            The positions of the planets for the day, the month, and the year ahead are computed by the same astronomical engine as the natal chart, then compared against this chart. A transit is reported only when a real geometric alignment occurs, with its true dates; moon phases and retrogrades are exact to the day. The words that interpret each alignment are written once, by hand, in the Council&apos;s voice, and chosen by the alignment itself, never at random. Nothing is padded to fill a quiet month: a quiet month reads quiet.
          </Methodology>
        </>
      )}
    </AstralShell>
  );
}
