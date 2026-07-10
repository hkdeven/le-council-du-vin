"use client";

// The Foretelling: a personal reading computed from real transits against the
// member's natal chart, in two skies. Three horizons (this day, this moon,
// the year) crossed with a lens pill (the Western sky / the Vedic sky).
// Computed, never invented; the passages are written by hand and spoken
// plainly on the page (the emails keep the Council tongue).

import { useEffect, useMemo, useState } from "react";
import { foretellingFor, type Omen } from "@/lib/transits";
import { vedicChart } from "@/lib/vedic";
import { panchangOf, dayStarFor, gocharaFor, gocharaPassage, yearTurnings, ironPassageFor, clockWithin, GRAHA_TIP } from "@/lib/gochara";
import { DASHA_TIP } from "@/lib/kundli-text";
import { AstralShell, VeiledGate, Methodology, chartReady } from "./NatalChart";
import Tip from "./Tip";
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

const LENS_KEY = "lcv_sky_lens"; // west | vedic

const bodyStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.58, textAlign: "left", color: "var(--bright, #ddd7c9)", fontFamily: "'EB Garamond', serif", margin: "0 0 10px" };
const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0", textAlign: "left" };
const labStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", fontFamily: "'Cinzel',serif", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold)", fontSize: 10 };
const valStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", color: "var(--gold2)", fontSize: 16, textAlign: "right" };

function MoonRow() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 11, color: "var(--gold)", opacity: 0.55, fontSize: 14, margin: "18px 0 12px" }}>
      <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
    </div>
  );
}

// The whole Foretelling, shell-free, so the Heavens can host it.
export function ForetellingContent({ member, isSelf, onGo }: { member: CardMember; isSelf?: boolean; onGo: () => void }) {
  const [view, setView] = useState<"day" | "moon" | "year">("day");
  const [lens, setLens] = useState<"west" | "vedic">("west");
  useEffect(() => {
    try { if (localStorage.getItem(LENS_KEY) === "vedic") setLens("vedic"); } catch {}
  }, []);
  const pickLens = (l: "west" | "vedic") => { setLens(l); try { localStorage.setItem(LENS_KEY, l); } catch {} };
  const ready = chartReady(member);
  const reading = useMemo(
    () => (ready ? foretellingFor({ dateStr: member.date_of_birth!, timeStr: member.time_of_birth, tz: member.birth_tz, lat: member.birth_lat, lon: member.birth_lon }, Date.now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, member.date_of_birth, member.time_of_birth, member.birth_tz, member.birth_lat, member.birth_lon]
  );
  const natal = useMemo(
    () => (ready ? vedicChart(member.date_of_birth!, member.time_of_birth, member.birth_tz, member.birth_lat, member.birth_lon, Date.now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, member.date_of_birth, member.time_of_birth, member.birth_tz, member.birth_lat, member.birth_lon]
  );
  const v = isSelf ? { obj: "you", pos: "your", subj: "you" } : { obj: "them", pos: "their", subj: "they" };
  const now = Date.now();
  const vedic = useMemo(() => {
    if (!natal) return null;
    return {
      panchang: panchangOf(now),
      dayStar: dayStarFor(natal, now, v),
      gochara: gocharaFor(natal, now),
      turnings: view === "year" ? yearTurnings(natal, now) : [],
      iron: view === "year" ? ironPassageFor(natal, now, v) : null,
      clock: view === "year" ? clockWithin(natal, now) : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natal, view]);

  if (!ready || !reading || !natal) {
    return <VeiledGate member={member} what="the foretelling cannot be read" isSelf={isSelf} onGo={onGo} />;
  }

  return (
    <>
      {/* The horizon pill: the active view wears the gold. */}
      <div style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 16, overflow: "visible", margin: "4px 0 8px", position: "relative" }}>
        {([
          { key: "day", label: "This day" },
          { key: "moon", label: "This moon" },
          { key: "year", label: "The year" },
        ] as const).map((seg, i) => (
          <button key={seg.key} onClick={() => setView(seg.key)}
            style={{
              width: "auto", border: "none", cursor: "pointer", padding: "7px 10px",
              borderRadius: i === 0 ? "15px 0 0 15px" : i === 2 ? "0 15px 15px 0" : 0,
              borderLeft: i > 0 ? "1px solid var(--line2)" : "none",
              background: view === seg.key ? "var(--gold2)" : "none",
              color: view === seg.key ? "#0a0908" : "var(--dim)",
              fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 5, position: "relative",
            }}>
            {seg.label}
          </button>
        ))}
      </div>
      <br />
      {/* The lens pill: which sky reads the horizon. */}
      <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", margin: "0 0 16px" }}>
        {([{ key: "west", label: "The Western sky" }, { key: "vedic", label: "The Vedic sky" }] as const).map((seg) => (
          <button key={seg.key} onClick={() => pickLens(seg.key)}
            style={{ width: "auto", border: "none", cursor: "pointer", padding: "7px 10px", background: lens === seg.key ? "var(--gold2)" : "none", color: lens === seg.key ? "#0a0908" : "var(--dim)", fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {seg.label}
          </button>
        ))}
      </div>

      {lens === "west" ? (
        view === "day" ? (
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
        )
      ) : view === "day" ? (
        <>
          <p className="whisper" style={{ margin: "0 0 6px", fontSize: 13 }}>{reading.dayLabel}</p>
          {vedic?.dayStar && (
            <>
              <div className="eyebrow" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 6 }}>
                The day&rsquo;s star<Tip text="Tara bala: the Moon's mansion today, counted from the birth star. Nine taras turn in a fixed wheel; some carry the day, some ask it to wait." />
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--line2)", borderRadius: 14, padding: "6px 16px", fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: "var(--gold2)", margin: "2px 0 8px" }}>
                <i className="ti ti-north-star" style={{ fontSize: 14, color: "var(--gold)" }} />{vedic.dayStar.tara}
              </div>
              <p style={bodyStyle}>{vedic.dayStar.passage}</p>
              <p style={bodyStyle}>{vedic.dayStar.moonLine}</p>
            </>
          )}
          {vedic?.panchang && (
            <>
              <MoonRow />
              <div className="eyebrow" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 6 }}>
                The almanac<Tip text="The five limbs of the Vedic day: the lunar day (tithi), the day's ruling planet, the Moon's mansion, the soli-lunar yoga, and the half-tithi (karana)." />
              </div>
              <div style={rowStyle}><span style={labStyle}>Tithi<Tip align="left" text="The lunar day, one thirtieth of the Moon's round: fifteen waxing (Shukla), fifteen waning (Krishna). Certain tithis carry their own observances." /></span><span style={valStyle}>{vedic.panchang.tithi}</span></div>
              <div style={rowStyle}><span style={labStyle}>Day lord<Tip align="left" text="Each weekday belongs to a graha, and the day takes its flavour: the Sun's Sunday through Shani's Saturday." /></span><span style={valStyle}>{vedic.panchang.dayLord}</span></div>
              <div style={rowStyle}><span style={labStyle}>Nakshatra<Tip align="left" text="The Moon's mansion today, one of the 27 lunar stars; it seasons the whole day's character." /></span><span style={valStyle}>{vedic.panchang.nakshatra}</span></div>
              <div style={rowStyle}><span style={labStyle}>Yoga<Tip align="left" text="One of 27 soli-lunar unions, reckoned from the sum of the Sun's and Moon's positions; some are counted tender, some stern." /></span><span style={valStyle}>{vedic.panchang.yoga}</span></div>
              <div style={rowStyle}><span style={labStyle}>Karana<Tip align="left" text="The half-tithi: eleven names turning through the month, seven movable and four fixed. Vishti is the one the old texts avoid for beginnings." /></span><span style={valStyle}>{vedic.panchang.karana}</span></div>
              {vedic.panchang.tithiNote && <p className="whisper" style={{ margin: "8px 0 0", fontSize: 14, textAlign: "left" }}>{vedic.panchang.tithiNote}</p>}
            </>
          )}
        </>
      ) : view === "moon" ? (
        <>
          <div className="eyebrow" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 4 }}>
            The wandering sky<Tip text="Gochara: each graha's live position counted from the natal Moon and judged by the classical lists, as the tradition reads the month." />
          </div>
          <p className="whisper" style={{ margin: "0 0 8px" }}>each graha counted from {v.pos} natal Moon, as the gochara is read</p>
          {vedic?.gochara.map((r, i) => (
            <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < vedic.gochara.length - 1 ? "1px solid var(--line)" : "none", fontSize: 14, textAlign: "left" }}>
              <span style={{ display: "inline-flex", alignItems: "center", fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: "0.08em", color: "var(--parch)" }}>{r.lord.toUpperCase()}<Tip align="left" text={GRAHA_TIP[r.key]} /></span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 14, color: r.favourable ? "var(--gold2)" : "var(--dim)" }}>{r.line.replace("your", v.pos)}</span>
            </div>
          ))}
          {vedic && <p style={{ ...bodyStyle, marginTop: 10, marginBottom: 0 }}>{gocharaPassage(vedic.gochara, v)}</p>}
        </>
      ) : (
        <>
          <div className="eyebrow" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 6 }}>
            The year&rsquo;s turnings<Tip text="The exact dates the slow grahas change signs as seen from the natal Moon, found by scanning their true motion, retrogrades included." />
          </div>
          {vedic?.turnings.map((t) => (
            <div key={t.ms} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <span style={{ flex: "none", width: 92, display: "inline-flex", alignItems: "flex-start", fontFamily: "'Cinzel',serif", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--gold2)" }}>{t.label}</span>
              <span style={{ fontFamily: "'EB Garamond',serif", fontSize: 14.5, color: "var(--bright, #ddd7c9)", lineHeight: 1.45 }}>{isSelf ? t.text : t.text.replace(/\byour\b/g, "their").replace(/\byou\b/g, "them")}</span>
            </div>
          ))}
          {vedic && vedic.clock.length > 0 && (
            <>
              <MoonRow />
              <div className="eyebrow" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 4 }}>
                The clock within<Tip text="The pratyantardasha: the third hand of the Vimshottari clock, the months within the current sub-period of the age." />
              </div>
              <p className="whisper" style={{ margin: "0 0 8px" }}>the fine hand of {v.pos} {natal.current ? `${natal.current.maha.lord}` : ""} years, month by month</p>
              {vedic.clock.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < vedic.clock.length - 1 ? "1px solid var(--line)" : "none", fontSize: 14, textAlign: "left" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: "0.08em", color: c.now ? "var(--gold2)" : "var(--parch)" }}>{c.lord}{c.now && " · NOW"}<Tip align="left" text={DASHA_TIP[c.lordKey]} /></span>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 13, color: c.now ? "var(--gold2)" : "var(--dim)" }}>{c.range}</span>
                </div>
              ))}
            </>
          )}
          {vedic?.iron && (
            <>
              <div style={{ borderTop: "2px solid var(--gold)", margin: "18px -18px 16px" }} />
              <div className="eyebrow" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 8, marginTop: 10 }}>
                The iron passage<Tip text="Saturn's slow walk around the natal Moon: the Sade Sati (the 12th, 1st, and 2nd signs, seven and a half years) and the Ashtama (the 8th). Dates are exact sign entries, retrograde wobbles honoured." />
              </div>
              <div style={{ fontFamily: "'Great Vibes',cursive", color: "var(--gold2)", fontSize: 26, lineHeight: 1.2 }}>{vedic.iron.title}</div>
              <p className="whisper" style={{ margin: "2px 0 10px" }}>{vedic.iron.whisper}</p>
              <p style={bodyStyle}>{vedic.iron.body}</p>
              {vedic.iron.next && <p style={{ ...bodyStyle, marginBottom: 0 }}>{vedic.iron.next}</p>}
            </>
          )}
        </>
      )}

      <p className="whisper" style={{ margin: "8px 0 0", fontSize: 12 }}>the vine calculates, it does not flatter</p>
      <Methodology title="How this reading is made">
        The positions of the planets for the day, the month, and the year ahead are computed by the same astronomical engine as the natal chart, in both the tropical and the Vedic reckoning, then compared against this chart. A transit is reported only when a real geometric alignment occurs, with its true dates; moon phases and retrogrades are exact to the day. The Vedic lens counts each graha from the natal Moon in the classical manner, and the iron passage&apos;s dates honour Saturn&apos;s retrograde wobbles. The words that interpret each alignment are written once, by hand, in the Council&apos;s voice, and chosen by the alignment itself, never at random. Nothing is padded to fill a quiet month: a quiet month reads quiet. No astrology API of any kind is consulted: every chart, transit, dasha, and kuta is computed in-house by the Council&apos;s own verified engines. That is the whole doctrine.
      </Methodology>
    </>
  );
}

export default function ForetellingModal({ member, onClose, onLeave, isSelf }: { member: CardMember; onClose: () => void; onLeave?: () => void; isSelf?: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  const close = () => { setShown(false); setTimeout(onClose, 240); };
  return (
    <AstralShell shown={shown} onClose={close}>
      <ForetellingContent member={member} isSelf={isSelf} onGo={onLeave || close} />
    </AstralShell>
  );
}
