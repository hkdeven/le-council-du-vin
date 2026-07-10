"use client";

// The natal chart modal: the wheel, every placement in sign + whole-sign house
// (tap a row for what it signifies), and the collapsed methodology note.
// Opens from the member card and from "Your sky" on the profile. Without a
// birth time + place there is no guessing — the veiled gate shows instead.

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";
import Link from "next/link";
import { fullChart, placementText, ordinal, type Chart } from "@/lib/natal";
import { temperamentOf, figuresOf, bearerOf, birthMoonOf, type Voice } from "@/lib/natal-analysis";
import Tip from "./Tip";
import type { CardMember } from "./MemberCard";

// Lock the page's scroll while any modal is open (counted, so stacked modals
// unlock only when the last closes). Without this, iOS chains the card's
// scroll into the page and the fixed overlay drifts, leaving black space.
let bodyLocks = 0;
export function useBodyLock() {
  useEffect(() => {
    bodyLocks++;
    if (bodyLocks === 1) document.body.style.overflow = "hidden";
    return () => {
      bodyLocks--;
      if (bodyLocks === 0) document.body.style.overflow = "";
    };
  }, []);
}

const VS = "︎"; // text-presentation: thin glyphs, not emoji, inside the wheel

// Pure SVG-string builder for the wheel — shared by this modal and the
// emailed-chart snapshot (a string can be rasterized without React).
export function wheelSvgString(chart: Chart): string {
  const ASC = chart.asc ?? 180;
  const C = 165, VB = 330;
  const pt = (L: number, r: number): [number, number] => {
    const a = ((180 + (ASC - L)) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const SG = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => g + VS);
  let s = `<svg viewBox="0 0 ${VB} ${VB}" role="img" aria-label="Natal chart wheel"><title>Natal chart wheel</title>`;
  s += `<circle cx="${C}" cy="${C}" r="158" fill="none" stroke="rgba(180,168,120,0.42)" stroke-width="1"/>`;
  s += `<circle cx="${C}" cy="${C}" r="132" fill="none" stroke="rgba(160,150,120,0.2)" stroke-width="1"/>`;
  s += `<circle cx="${C}" cy="${C}" r="92" fill="none" stroke="rgba(160,150,120,0.2)" stroke-width="1"/>`;
  for (let i = 0; i < 12; i++) {
    const d = pt(i * 30, 132), e = pt(i * 30, 158);
    s += `<line x1="${d[0]}" y1="${d[1]}" x2="${e[0]}" y2="${e[1]}" stroke="rgba(160,150,120,0.25)" stroke-width="1"/>`;
    const g = pt(i * 30 + 15, 145);
    s += `<text x="${g[0]}" y="${g[1] + 5}" text-anchor="middle" font-size="14" fill="#9c8a5f">${SG[i]}</text>`;
    const hn = ((i - Math.floor(ASC / 30) + 12) % 12) + 1;
    const hp = pt(i * 30 + 15, 82);
    s += `<text x="${hp[0]}" y="${hp[1] + 3}" text-anchor="middle" font-size="9" fill="#5a554c">${hn}</text>`;
  }
  const lonOf: Record<string, number> = {};
  for (const p of chart.planets) lonOf[p.key] = p.lon;
  for (const a of chart.aspects) {
    if (a.type === "conjunction") continue; // shown by proximity
    const p1 = pt(lonOf[a.a], 92), p2 = pt(lonOf[a.b], 92);
    s += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="${a.hard ? "#7a3038" : "#cbbd93"}" stroke-width="1" opacity="0.7"/>`;
  }
  const srt = [...chart.planets].sort((x, y) => x.lon - y.lon);
  for (let k = 0; k < srt.length; k++) {
    const near = k > 0 && srt[k].lon - srt[k - 1].lon < 9;
    const r = near ? 122 : 107;
    const q = pt(srt[k].lon, r), t1 = pt(srt[k].lon, 128), t2 = pt(srt[k].lon, 132);
    s += `<line x1="${t1[0]}" y1="${t1[1]}" x2="${t2[0]}" y2="${t2[1]}" stroke="#cbbd93" stroke-width="1.4"/>`;
    s += `<text x="${q[0]}" y="${q[1] + 5}" text-anchor="middle" font-size="15" fill="#cbbd93">${srt[k].glyph}</text>`;
  }
  if (chart.asc != null) {
    const a1 = pt(ASC, 92), a2 = pt(ASC, 158);
    s += `<line x1="${a1[0]}" y1="${a1[1]}" x2="${a2[0]}" y2="${a2[1]}" stroke="#cbbd93" stroke-width="1.6"/>`;
    s += `<text x="${a2[0] + 4}" y="${a2[1] - 6}" text-anchor="start" font-size="9" letter-spacing="1" fill="#cbbd93">ASC</text>`;
  }
  return s + "</svg>";
}

export const chartReady = (m: CardMember) =>
  !!m.date_of_birth && !!m.time_of_birth && m.birth_lat != null && m.birth_lon != null;

// The shared "sky is veiled" gate for chart + foretelling.
export function VeiledGate({ member, what, isSelf, onGo }: { member: CardMember; what: string; isSelf?: boolean; onGo: () => void }) {
  const missing: { icon: string; label: string }[] = [];
  if (!member.time_of_birth) missing.push({ icon: "ti-clock", label: "time of birth" });
  if (member.birth_lat == null || member.birth_lon == null) missing.push({ icon: "ti-map-pin", label: "place of birth" });
  if (!member.date_of_birth) missing.unshift({ icon: "ti-calendar", label: "date of birth" });
  return (
    <>
      <div className="disp" style={{ fontSize: 20 }}>The sky is veiled</div>
      <p className="whisper" style={{ fontSize: 14, margin: "8px 0 14px" }}>{what}</p>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, margin: "0 auto 6px", maxWidth: 280 }}>
        The heavens ask {missing.length === 1 ? "one more truth" : `${missing.length === 2 ? "two" : "three"} more truths`} of {isSelf ? "you" : "them"}:
      </p>
      <div className="pills" style={{ justifyContent: "center", margin: "10px 0 16px" }}>
        {missing.map((m2) => (
          <span key={m2.label} className="pill"><i className={`ti ${m2.icon}`} style={{ fontSize: 11, marginRight: 5 }} />{m2.label}</span>
        ))}
      </div>
      {isSelf ? (
        <>
          <p className="whisper" style={{ margin: "0 0 14px", fontSize: 13 }}>give them on your profile, and the sky unveils itself</p>
          <Link href="/profile" className="btn gold" style={{ display: "block", textDecoration: "none", textAlign: "center" }} onClick={onGo}>
            <i className="ti ti-user" style={{ fontSize: 13, marginRight: 6 }} />Complete your record
          </Link>
        </>
      ) : (
        <p className="whisper" style={{ margin: "0 0 6px", fontSize: 13 }}>their record awaits their own hand</p>
      )}
    </>
  );
}

// The astral modal shell: fixed overlay above the member card.
export function AstralShell({ shown, onClose, children }: { shown: boolean; onClose: () => void; children: React.ReactNode }) {
  useBodyLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-scroll" onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.75)", overflowY: "auto", display: "flex", padding: 16, opacity: shown ? 1 : 0, transition: "opacity 0.22s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 380, margin: "auto", background: "linear-gradient(180deg,#12100e,#0a0908)", border: "1px solid var(--gold)", borderRadius: 14, boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 20px 60px rgba(0,0,0,0.7)", padding: "22px 18px 24px", textAlign: "center", transform: shown ? "scale(1)" : "scale(0.92)", transition: "transform 0.24s cubic-bezier(0.2,0.9,0.3,1)" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 8, right: 8, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 6, zIndex: 2 }}>
          <i className="ti ti-x" style={{ fontSize: 16 }} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

// A collapsed methodology note at the foot of a card.
export function Methodology({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "'Cinzel', serif", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 10.5, color: "var(--dim)", padding: "4px 0" }}>
        <i className="ti ti-chevron-right" style={{ fontSize: 12, color: "var(--gold)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />{title}
      </button>
      {open && (
        <div style={{ textAlign: "left", fontSize: 13.5, color: "var(--dim)", lineHeight: 1.55, padding: "8px 2px 0" }}>{children}</div>
      )}
    </div>
  );
}

// The whole wheel, shell-free, so the Heavens can host it.
export function NatalContent({ member, isSelf, onGo }: { member: CardMember; isSelf?: boolean; onGo: () => void }) {
  const [openRow, setOpenRow] = useState<string | null>(null);

  const ready = chartReady(member);
  const chart = ready ? fullChart(member.date_of_birth!, member.time_of_birth, member.birth_tz, member.birth_lat, member.birth_lon) : null;

  return (
    <>
      {!ready || !chart ? (
        <VeiledGate member={member} what="the wheel cannot be drawn" isSelf={isSelf} onGo={onGo} />
      ) : (
        <>
          <div className="disp" style={{ fontSize: 19 }}>{member.cult_name}</div>
          <p className="whisper" style={{ fontSize: 13, margin: "2px 0 12px" }}>
            the sky at {isSelf ? "your" : "their"} first breath{member.birth_place ? ` · ${member.birth_place.split(",")[0]}` : ""}
          </p>
          <div style={{ margin: "0 auto", maxWidth: 330 }} dangerouslySetInnerHTML={{ __html: wheelSvgString(chart) }} />
          <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 12, color: "var(--dim)", marginTop: 6 }}>
            <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#cbbd93", verticalAlign: "middle", marginRight: 5 }} />harmonious</span>
            <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#7a3038", verticalAlign: "middle", marginRight: 5 }} />hard</span>
            <span style={{ color: "var(--gold2)" }}>ASC · rising</span>
          </div>
          <div style={{ borderTop: "1px solid var(--line)", margin: "14px 0 4px" }} />
          {chart.planets.map((p, i) => (
            <div key={p.key} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <button
                onClick={() => setOpenRow(openRow === p.key ? null : p.key)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 0", textAlign: "left", color: "inherit" }}
              >
                <span style={{ flex: "none", width: 22, color: "var(--gold2)", fontSize: 16, textAlign: "center" }}>{p.glyph}</span>
                <span className="eyebrow" style={{ flex: 1, fontSize: 11 }}>{p.name}</span>
                <span style={{ color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontSize: 15 }}>
                  {p.sign.symbol} {p.sign.name} {p.deg}°{p.house ? <span style={{ color: "var(--dim)", fontSize: 13 }}> · {ordinal(p.house)} house</span> : null}
                </span>
                <i className="ti ti-chevron-right" style={{ color: "var(--gold)", fontSize: 13, flex: "none", transform: openRow === p.key ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              {openRow === p.key && (
                <div style={{ textAlign: "left", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14.5, color: "var(--dim)", lineHeight: 1.5, padding: "0 0 10px 32px" }}>
                  {placementText(p)}
                </div>
              )}
            </div>
          ))}
          <p className="whisper" style={{ margin: "10px 0 0", fontSize: 13 }}>tap a row to read what the placement signifies</p>
          <p className="whisper" style={{ margin: "4px 0 0", fontSize: 12 }}>whole-sign houses · computed from the true sky</p>
          <WheelReadings chart={chart} isSelf={isSelf} />
          <Methodology title="How this chart is drawn">
            Nothing here is guessed or generated. The birth moment is first converted from local time to Universal Time using the historical timezone database, so old dates carry the offsets of their era. Each position is then computed from established astronomical formulae: the sun from its true ecliptic longitude, the moon from a perturbed lunar ephemeris, the planets from their orbital elements, and the ascendant from the exact sidereal time at the birthplace&apos;s latitude and longitude. Houses follow the whole-sign tradition.
            <br /><br />
            The engine is tested against documented reference charts and known sky events: cusp-day birthdays, recorded full and new moons, and historical charts with published ascendants. Where a detail is missing, a birth time or place, the chart shows nothing rather than an estimate.
          </Methodology>
        </>
      )}
    </>
  );
}

// The temperament, the figures, the chart bearer, and the birth moon: the
// wheel's deeper readings, every value computed (natal-analysis.ts) and every
// passage hand-written.
function WheelReadings({ chart, isSelf }: { chart: Chart; isSelf?: boolean }) {
  const v: Voice = isSelf
    ? { subj: "you", Subj: "You", obj: "you", pos: "your", Pos: "Your" }
    : { subj: "they", Subj: "They", obj: "them", pos: "their", Pos: "Their" };
  const temper = temperamentOf(chart, v);
  const figures = figuresOf(chart, v);
  const bearer = bearerOf(chart, v);
  const birthMoon = birthMoonOf(chart, v);

  const eyebrow: React.CSSProperties = { fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 8 };
  const body: React.CSSProperties = { fontSize: 15, lineHeight: 1.58, textAlign: "left", color: "#ddd7c9", fontFamily: "'EB Garamond', serif", margin: "0 0 10px" };
  const moons = (
    <div style={{ display: "flex", justifyContent: "center", gap: 11, color: "var(--gold)", opacity: 0.55, fontSize: 14, margin: "18px 0 12px" }}>
      <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
    </div>
  );
  const bar = (b: { name: string; count: number; who: string[] }, max: number, tip: string) => (
    <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", textAlign: "left" }}>
      <span style={{ fontFamily: "'Cinzel',serif", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10, color: "var(--gold)", width: 96, flex: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {b.name}<Tip align="left" text={tip} />
      </span>
      <span style={{ flex: 1, height: 4, background: "rgba(160,150,120,0.14)", borderRadius: 2, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${(b.count / max) * 100}%`, background: "var(--gold2)", borderRadius: 2, opacity: 0.55 + 0.45 * (b.count / max) }} />
      </span>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", color: "var(--gold2)", fontSize: 15, width: 16, flex: "none", textAlign: "right" }}>{b.count}</span>
    </div>
  );
  const ELEM_TIPS: Record<string, string> = {
    Fire: "Will, drive, and daring: the element of action and appetite. Strong fire acts first and explains after.",
    Earth: "Patience, sense, and craft: the element of the tangible. Strong earth trusts what it can hold and build.",
    Air: "Thought, speech, and connection: the element of ideas and judgement. Strong air thinks its way through life.",
    Water: "Feeling, memory, and instinct: the element of depth. Strong water reads the room before a word is spoken.",
  };
  const MODE_TIPS: Record<string, string> = {
    Cardinal: "The signs that begin each season: initiators. Strong cardinal starts things and sets others in motion.",
    Fixed: "The signs that hold each season: sustainers. Strong fixed keeps its course and its grudges alike.",
    Mutable: "The signs that close each season: adapters. Strong mutable bends, blends, and finishes what others start.",
  };
  const maxEl = Math.max(...temper.elements.map((e) => e.count), 1);
  const maxMd = Math.max(...temper.modes.map((m) => m.count), 1);

  return (
    <>
      <div style={{ borderTop: "2px solid var(--gold)", margin: "18px -18px 16px" }} />
      <div className="eyebrow" style={{ ...eyebrow, margin: "20px 0 10px" }}>
        The temperament<Tip text="Every placement counted by its element and mode; the balance is the weather of the whole chart." />
      </div>
      {temper.elements.map((e) => bar(e, maxEl, ELEM_TIPS[e.name]))}
      <div style={{ height: 8 }} />
      {temper.modes.map((m) => bar(m, maxMd, MODE_TIPS[m.name]))}
      <p style={{ ...body, marginTop: 10, marginBottom: 0 }}>{temper.verdict}</p>

      {figures.length > 0 && (
        <>
          {moons}
          <div className="eyebrow" style={eyebrow}>
            The figures<Tip text="Classical aspect patterns, detected in the chart itself: stelliums, grand trines, T-squares, grand crosses, yods, and exact conjunctions. Only figures truly present are named." />
          </div>
          {figures.map((f, i) => (
            <p key={f.key} style={{ ...body, marginBottom: i === figures.length - 1 ? 0 : 10 }}>
              <span style={{ color: "var(--gold2)" }}>{f.name}</span>: {f.text}
            </p>
          ))}
        </>
      )}

      {bearer && (
        <>
          {moons}
          <div className="eyebrow" style={eyebrow}>
            The chart bearer<Tip text="The planet that rules the rising sign carries the whole chart; its condition colours everything else." />
          </div>
          <div style={{ fontFamily: "'Great Vibes',cursive", color: "var(--gold2)", fontSize: 26, lineHeight: 1.2 }}>{bearer.title}</div>
          <p className="whisper" style={{ margin: "2px 0 10px" }}>{bearer.whisper}</p>
          <p style={{ ...body, marginBottom: 0 }}>{bearer.text}</p>
        </>
      )}

      {birthMoon && (
        <>
          {moons}
          <div className="eyebrow" style={eyebrow}>
            The birth moon<Tip text="The angle between the sun and moon at birth gives the lunation phase, one of eight, each with its own temperament." />
          </div>
          <div style={{ fontFamily: "'Great Vibes',cursive", color: "var(--gold2)", fontSize: 26, lineHeight: 1.2 }}>{birthMoon.title}</div>
          <p className="whisper" style={{ margin: "2px 0 10px" }}>{birthMoon.whisper}</p>
          <p style={{ ...body, marginBottom: 0 }}>{birthMoon.text}</p>
        </>
      )}
    </>
  );
}

export default function NatalChartModal({ member, onClose, onLeave, isSelf }: { member: CardMember; onClose: () => void; onLeave?: () => void; isSelf?: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  const close = () => { setShown(false); setTimeout(onClose, 240); };
  return (
    <AstralShell shown={shown} onClose={close}>
      <NatalContent member={member} isSelf={isSelf} onGo={onLeave || close} />
    </AstralShell>
  );
}
