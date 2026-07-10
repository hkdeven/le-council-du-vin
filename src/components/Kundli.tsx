"use client";

// The Kundli modal: the Vedic sky, drawn to the Keiser-approved mockup.
// North/South chart toggle (remembered per device), the three header rows,
// kindred stars (full members only), the current dasha age, the full turning,
// the pillars and the pits, muhurta days, the marriage bond, and the yogas.
// Every passage is hand-written (kundli-text.ts) and chosen by the chart;
// without a birth time + place the veiled gate shows instead of a guess.

import { useEffect, useState } from "react";
import { AstralShell, VeiledGate, chartReady, Methodology } from "./NatalChart";
import Tip from "./Tip";
import type { CardMember } from "./MemberCard";
import { supabase } from "@/lib/supabase";
import { gatheringsLive } from "@/lib/gatherings";
import { loadMembers } from "@/lib/members";
import { vedicChart, RASHIS, RASHI_WESTERN, NAKSHATRAS, type VedicChart } from "@/lib/vedic";
import {
  kutaAccord, kutaVerdict, muhurtaDays, detectYogas, mangalDosha, pillarsOf,
  sanskritLord, rashiName, type Muhurta,
} from "@/lib/kundli";
import * as T from "@/lib/kundli-text";
import type { Member } from "@/lib/types";

const STYLE_KEY = "lcv_kundli_style"; // north | south

const PLANET_SHORT: Record<string, string> = {
  sun: "Sy", moon: "Ch", mercury: "Bu", venus: "Sk", mars: "Ma",
  jupiter: "Gu", saturn: "Sha", rahu: "Ra", ketu: "Ke",
};

// ── the North Indian diamond (houses fixed, signs rotate) ───────────────────
const N_NUM: [number, number][] = [
  [200, 124], [104, 48], [46, 112], [112, 205], [46, 292], [104, 358],
  [200, 288], [296, 358], [354, 292], [288, 205], [354, 112], [296, 48],
];
const N_PL: [number, number][] = [
  [200, 78], [104, 82], [58, 152], [112, 238], [58, 254], [104, 328],
  [200, 330], [296, 328], [342, 254], [288, 238], [342, 152], [296, 82],
];

function northSvg(chart: VedicChart): string {
  const byHouse: string[][] = Array.from({ length: 12 }, () => []);
  byHouse[0].push("La");
  for (const p of chart.planets) byHouse[p.house - 1].push(PLANET_SHORT[p.key]);
  let s = `<svg viewBox="0 0 400 400" role="img" aria-label="North Indian kundli"><title>North Indian kundli</title>`;
  s += `<rect x="8" y="8" width="384" height="384" fill="none" stroke="#9c8a5f" stroke-width="1.5"/>`;
  s += `<line x1="8" y1="8" x2="392" y2="392" stroke="#9c8a5f"/><line x1="392" y1="8" x2="8" y2="392" stroke="#9c8a5f"/>`;
  s += `<line x1="200" y1="8" x2="8" y2="200" stroke="#9c8a5f"/><line x1="200" y1="8" x2="392" y2="200" stroke="#9c8a5f"/>`;
  s += `<line x1="8" y1="200" x2="200" y2="392" stroke="#9c8a5f"/><line x1="392" y1="200" x2="200" y2="392" stroke="#9c8a5f"/>`;
  for (let h = 0; h < 12; h++) {
    const rashi = ((chart.lagna.rashi + h) % 12) + 1; // 1..12 sign number
    s += `<text x="${N_NUM[h][0]}" y="${N_NUM[h][1]}" fill="#7c766a" font-size="12" text-anchor="middle" font-family="'Cinzel',serif">${rashi}</text>`;
    const labels = byHouse[h];
    if (!labels.length) continue;
    const [x, y] = N_PL[h];
    if (labels.join(" ").length > 6 && labels.length > 2) {
      const half = Math.ceil(labels.length / 2);
      s += `<text x="${x}" y="${y - 7}" fill="#cbbd93" font-size="13" text-anchor="middle" font-family="'Cinzel',serif">${labels.slice(0, half).join(" ")}</text>`;
      s += `<text x="${x}" y="${y + 9}" fill="#cbbd93" font-size="13" text-anchor="middle" font-family="'Cinzel',serif">${labels.slice(half).join(" ")}</text>`;
    } else {
      s += `<text x="${x}" y="${y}" fill="#cbbd93" font-size="14" text-anchor="middle" font-family="'Cinzel',serif">${labels.join(" ")}</text>`;
    }
  }
  return s + "</svg>";
}

// ── the South Indian square (signs fixed, lagna marked) ─────────────────────
// Grid column/row per rashi (Mesha..Meena), on the classical fixed wheel.
const S_CELL: [number, number][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3],
  [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0],
];

function southSvg(chart: VedicChart): string {
  const byRashi: string[][] = Array.from({ length: 12 }, () => []);
  for (const p of chart.planets) byRashi[p.rashi].push(PLANET_SHORT[p.key]);
  const cell = 96, o = 8;
  let s = `<svg viewBox="0 0 400 400" role="img" aria-label="South Indian kundli"><title>South Indian kundli</title>`;
  s += `<rect x="8" y="8" width="384" height="384" fill="none" stroke="#9c8a5f" stroke-width="1.5"/>`;
  s += `<line x1="8" y1="104" x2="392" y2="104" stroke="#9c8a5f"/><line x1="8" y1="296" x2="392" y2="296" stroke="#9c8a5f"/>`;
  s += `<line x1="104" y1="8" x2="104" y2="392" stroke="#9c8a5f"/><line x1="296" y1="8" x2="296" y2="392" stroke="#9c8a5f"/>`;
  s += `<line x1="104" y1="200" x2="8" y2="200" stroke="#9c8a5f"/><line x1="392" y1="200" x2="296" y2="200" stroke="#9c8a5f"/>`;
  s += `<line x1="200" y1="8" x2="200" y2="104" stroke="#9c8a5f"/><line x1="200" y1="296" x2="200" y2="392" stroke="#9c8a5f"/>`;
  for (let r = 0; r < 12; r++) {
    const [cx, cy] = S_CELL[r];
    const x = o + cx * cell + cell / 2, yTop = o + cy * cell;
    s += `<text x="${x}" y="${yTop + 18}" fill="#5a554c" font-size="9" letter-spacing="1" text-anchor="middle" font-family="'Cinzel',serif">${RASHIS[r].toUpperCase()}</text>`;
    const labels = byRashi[r];
    if (labels.length) {
      if (labels.join(" ").length > 6 && labels.length > 2) {
        const half = Math.ceil(labels.length / 2);
        s += `<text x="${x}" y="${yTop + 48}" fill="#cbbd93" font-size="13" text-anchor="middle" font-family="'Cinzel',serif">${labels.slice(0, half).join(" ")}</text>`;
        s += `<text x="${x}" y="${yTop + 66}" fill="#cbbd93" font-size="13" text-anchor="middle" font-family="'Cinzel',serif">${labels.slice(half).join(" ")}</text>`;
      } else {
        s += `<text x="${x}" y="${yTop + 56}" fill="#cbbd93" font-size="14" text-anchor="middle" font-family="'Cinzel',serif">${labels.join(" ")}</text>`;
      }
    }
    if (r === chart.lagna.rashi) {
      // The lagna's diagonal stroke, bottom-left corner of its cell.
      const x0 = o + cx * cell, y0 = o + cy * cell;
      s += `<line x1="${x0 + 6}" y1="${y0 + cell - 6}" x2="${x0 + 30}" y2="${y0 + cell - 30}" stroke="#cbbd93" stroke-width="1.5"/>`;
    }
  }
  s += `<text x="200" y="207" fill="#9c8a5f" text-anchor="middle" font-size="22" font-family="'Great Vibes',cursive">The Kundli</text>`;
  return s + "</svg>";
}

// ── small shared pieces ─────────────────────────────────────────────────────
function MoonRow() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 11, color: "var(--gold)", opacity: 0.55, fontSize: 14, margin: "18px 0 12px" }}>
      <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
    </div>
  );
}
function Eyebrow({ children, tip, style }: { children: React.ReactNode; tip?: string; style?: React.CSSProperties }) {
  return (
    <div className="eyebrow" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginBottom: 8, ...style }}>
      {children}{tip && <Tip text={tip} />}
    </div>
  );
}
const bodyStyle: React.CSSProperties = {
  fontSize: 15, lineHeight: 1.58, textAlign: "left", color: "#ddd7c9",
  fontFamily: "'EB Garamond', serif", margin: "0 0 10px",
};
const monthYear = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const yearOf = (ms: number) => new Date(ms).getFullYear();
const fmtScore = (n: number) => (n % 1 === 0.5 ? `${Math.floor(n)}½` : `${n}`);

interface Kin { name: string; total: number; verdict: string }

export default function KundliModal({ member, onClose, onLeave, isSelf }: { member: CardMember; onClose: () => void; onLeave?: () => void; isSelf?: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  const close = () => { setShown(false); setTimeout(onClose, 240); };

  const [style, setStyle] = useState<"north" | "south">("north");
  useEffect(() => {
    try { const s = localStorage.getItem(STYLE_KEY); if (s === "south") setStyle("south"); } catch {}
  }, []);
  const pickStyle = (s: "north" | "south") => { setStyle(s); try { localStorage.setItem(STYLE_KEY, s); } catch {} };

  const ready = chartReady(member);
  const chart = ready
    ? vedicChart(member.date_of_birth!, member.time_of_birth, member.birth_tz, member.birth_lat, member.birth_lon, Date.now())
    : null;

  const v = isSelf ? T.SELF : T.OTHER;

  // Kindred stars: every other living full member whose chart is complete.
  const [kin, setKin] = useState<Kin[] | null>(null);
  const moonLon = chart?.planets.find((p) => p.key === "moon")?.lon;
  const subjectFull = member.role !== "initiate";
  useEffect(() => {
    if (moonLon == null || !subjectFull) return;
    let alive = true;
    (async () => {
      let others: Member[];
      if (gatheringsLive() && supabase) {
        const { data } = await supabase.from("members")
          .select("id,cult_name,role,active,date_of_birth,time_of_birth,birth_lat,birth_lon,birth_tz");
        others = (data as Member[]) || [];
      } else {
        others = loadMembers();
      }
      const rows: Kin[] = [];
      for (const o of others) {
        if (o.cult_name === member.cult_name || (member.id && o.id === member.id)) continue;
        if (o.role === "initiate" || o.active === false) continue;
        if (!chartReady(o)) continue;
        const oc = vedicChart(o.date_of_birth!, o.time_of_birth, o.birth_tz, o.birth_lat, o.birth_lon, Date.now());
        const oMoon = oc?.planets.find((p) => p.key === "moon")?.lon;
        if (oMoon == null) continue;
        const k = kutaAccord(moonLon, oMoon);
        rows.push({ name: o.cult_name, total: k.total, verdict: kutaVerdict(k.total) });
      }
      rows.sort((a, b) => b.total - a.total);
      if (alive) setKin(rows);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moonLon, subjectFull]);

  // Muhurta: computed once per open (the Moon does not hurry).
  const [muhurta, setMuhurta] = useState<Muhurta | null>(null);
  useEffect(() => {
    if (!chart) return;
    setMuhurta(muhurtaDays(chart.moonNakshatra, chart.lagna.rashi, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <AstralShell shown={shown} onClose={close}>
      {!ready || !chart ? (
        <VeiledGate member={member} what="the kundli cannot be drawn" isSelf={isSelf} onGo={onLeave || close} />
      ) : (
        <KundliBody chart={chart} v={v} isSelf={isSelf} style={style} pickStyle={pickStyle} kin={subjectFull ? kin : null} muhurta={muhurta} />
      )}
    </AstralShell>
  );
}

function KundliBody({ chart, v, isSelf, style, pickStyle, kin, muhurta }: {
  chart: VedicChart; v: T.V; isSelf?: boolean;
  style: "north" | "south"; pickStyle: (s: "north" | "south") => void;
  kin: Kin[] | null; muhurta: Muhurta | null;
}) {
  const pillars = pillarsOf(chart);
  const yogas = detectYogas(chart);
  const cur = chart.current;
  const mahas = chart.mahadashas.slice(0, 9);
  const nextMaha = cur ? chart.mahadashas[chart.mahadashas.findIndex((d) => d === cur.maha) + 1] : null;
  const now = Date.now();

  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0", textAlign: "left" };
  const labStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", fontFamily: "'Cinzel',serif", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold)", fontSize: 10 };
  const valStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond',serif", color: "var(--gold2)", fontSize: 16, textAlign: "right", display: "inline-flex", alignItems: "center" };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", gap: 11, color: "var(--gold)", opacity: 0.55, fontSize: 14, marginBottom: 12 }}>
        <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
      </div>
      <div className="disp" style={{ fontSize: 19 }}>The Kundli</div>
      <p className="whisper" style={{ fontSize: 13, margin: "2px 0 0" }}>the Vedic sky at {v.pos} first breath · Lahiri ayanamsa</p>

      <div style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 16, overflow: "hidden", margin: "12px 0 4px" }}>
        {(["north", "south"] as const).map((s) => (
          <button key={s} onClick={() => pickStyle(s)} style={{ width: "auto", padding: "7px 18px", fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", border: "none", cursor: "pointer", background: style === s ? "var(--gold2)" : "none", color: style === s ? "#0a0908" : "var(--dim)" }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ margin: "0 auto", maxWidth: 300 }} dangerouslySetInnerHTML={{ __html: style === "north" ? northSvg(chart) : southSvg(chart) }} />

      <div style={{ borderTop: "1px solid var(--line)", margin: "14px 0 6px" }} />
      <div style={rowStyle}>
        <span style={labStyle}>Lagna<Tip align="left" text={T.LAGNA_TIP} /></span>
        <span style={valStyle}>{rashiName(chart.lagna.rashi)} ({RASHI_WESTERN[chart.lagna.rashi]}) · {chart.lagna.degInRashi.toFixed(1)}°<Tip text={T.LAGNA_NATURE[chart.lagna.rashi]} /></span>
      </div>
      <div style={rowStyle}>
        <span style={labStyle}>Moon&rsquo;s nakshatra<Tip align="left" text={T.NAKSHATRA_ROW_TIP} /></span>
        <span style={valStyle}>{NAKSHATRAS[chart.moonNakshatra]} · pada {chart.moonPada}<Tip text={T.NAKSHATRA_TIP[chart.moonNakshatra]} /></span>
      </div>
      <div style={rowStyle}>
        <span style={labStyle}>Navamsa lagna<Tip align="left" text={T.NAVAMSA_TIP} /></span>
        <span style={valStyle}>{rashiName(chart.lagna.navamsaRashi)} (D9)</span>
      </div>

      {kin !== null && kin.length > 0 && (
        <>
          <MoonRow />
          <Eyebrow tip={T.KINDRED_TIP}>Kindred stars</Eyebrow>
          {kin.map((k, i) => (
            <div key={k.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < kin.length - 1 ? "1px solid var(--line)" : "none", fontSize: 14.5, textAlign: "left", fontFamily: "'EB Garamond',serif" }}>
              <span>{k.name}</span>
              <span style={{ color: k.total >= 24 ? "var(--gold2)" : k.total >= 18 ? "var(--parch)" : "var(--dim)", fontFamily: "'Cormorant Garamond',serif", fontSize: 15 }}>
                {fmtScore(k.total)} of 36 · {k.verdict}
              </span>
            </div>
          ))}
        </>
      )}

      <div style={{ borderTop: "2px solid var(--gold)", margin: "18px -18px 16px" }} />
      {cur && (
        <>
          <Eyebrow style={{ margin: "10px 0 8px" }}>The age {v.subj} are living</Eyebrow>
          <div style={{ fontFamily: "'Great Vibes',cursive", color: "var(--gold2)", fontSize: 28, lineHeight: 1.2 }}>
            The years of {sanskritLord(cur.maha.lord)}
          </div>
          <p className="whisper" style={{ margin: "2px 0 10px" }}>
            {monthYear(cur.maha.fromMs)} to {monthYear(cur.maha.toMs)}
            {cur.antar.lord !== cur.maha.lord && <> · tempered by {sanskritLord(cur.antar.lord)} until {monthYear(cur.antar.toMs)}</>}
          </p>
          <p style={bodyStyle}>{T.DASHA_TEXT[cur.maha.lord](v)}{cur.antar.lord !== cur.maha.lord && <> {T.ANTAR_TEXT[cur.antar.lord](v)}</>}</p>
          {nextMaha && (
            <p style={{ ...bodyStyle, marginBottom: 0 }}>
              Next: the years of {sanskritLord(nextMaha.lord)} from {monthYear(nextMaha.fromMs)}, {T.NEXT_CLAUSE[nextMaha.lord]}.
            </p>
          )}
        </>
      )}

      <MoonRow />
      <Eyebrow>The full turning</Eyebrow>
      {mahas.map((d, i) => {
        const isNow = now >= d.fromMs && now < d.toMs;
        const past = d.toMs <= now;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < mahas.length - 1 ? "1px solid var(--line)" : "none", fontSize: 14, textAlign: "left" }}>
            <span style={{ display: "inline-flex", alignItems: "center", fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: "0.08em", color: isNow ? "var(--gold2)" : past ? "var(--faint)" : "var(--parch)" }}>
              {d.lord.toUpperCase()}{isNow && " · NOW"}<Tip align="left" text={T.DASHA_TIP[d.lord]} />
            </span>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 13, color: isNow ? "var(--gold2)" : "var(--dim)" }}>
              {yearOf(d.fromMs)} to {yearOf(d.toMs)}
            </span>
          </div>
        );
      })}

      <MoonRow />
      <Eyebrow>The pillars and the pits</Eyebrow>
      <p style={bodyStyle}>
        <span style={{ color: "var(--gold2)" }}>{v.Pos} strength:</span>{" "}
        {T.STRENGTH_BY_HOUSE[pillars.lagnaLordHouse - 1](v, sanskritLord(pillars.lagnaLord))}
      </p>
      <p style={bodyStyle}>
        <span style={{ color: "var(--gold2)" }}>{v.Pos} dharma path:</span>{" "}
        {T.DHARMA_BY_LORD[pillars.tenthLord]?.(v, rashiName(pillars.tenthRashi))}
      </p>
      {pillars.pitfalls.length > 0 && (
        <p style={{ ...bodyStyle, marginBottom: 0 }}>
          <span style={{ color: "var(--gold2)" }}>{v.Pos} pitfalls:</span>{" "}
          {pillars.pitfalls.slice(0, 2).map((k) => T.PITFALL_TEXT[k]?.(v)).filter(Boolean).join(" ")}
        </p>
      )}

      {muhurta && muhurta.favourable.length > 0 && (
        <>
          <MoonRow />
          <Eyebrow style={{ marginBottom: 2 }} tip={T.MUHURTA_TIP}>Muhurta · Favourable Hours</Eyebrow>
          <div style={{ fontFamily: "'Cinzel',serif", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold2)", fontSize: 10.5, marginTop: 10 }}>Begin boldly</div>
          <p className="whisper" style={{ margin: "2px 0 0", fontSize: 14, color: "var(--parch)" }}>sign, ask, and begin on these days</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", margin: "8px 0 4px" }}>
            {muhurta.favourable.map((d) => (
              <span key={d.ms} style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, color: "var(--gold2)", border: "1px solid var(--line2)", borderRadius: 14, padding: "5px 14px" }}>{d.label}</span>
            ))}
          </div>
          {muhurta.hostile.length > 0 && (
            <>
              <div style={{ fontFamily: "'Cinzel',serif", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold2)", fontSize: 10.5, marginTop: 10 }}>Let pass quietly</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", margin: "8px 0 4px" }}>
                {muhurta.hostile.map((d) => (
                  <span key={d.ms} style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, color: "var(--faint)", border: "1px solid var(--line)", borderRadius: 14, padding: "5px 14px" }}>{d.label}</span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <MoonRow />
      <Eyebrow>The marriage bond</Eyebrow>
      <p style={{ ...bodyStyle, marginBottom: 0 }}>
        {pillars.seventhLordHouse != null && T.SEVENTH_LORD_HOUSE[pillars.seventhLordHouse - 1](v, rashiName(pillars.seventhRashi), sanskritLord(pillars.seventhLord))}
        {T.venusLine(v, pillars.venusHouse)}
        {" "}The navamsa, chart of the marriage itself, rises in {rashiName(chart.lagna.navamsaRashi)}: {(isSelf ? T.NAVAMSA_BOND : T.NAVAMSA_BOND_OTHER)[chart.lagna.navamsaRashi]}
        {mangalDosha(chart) && T.MANGAL_NOTE(v)}
      </p>

      <MoonRow />
      <Eyebrow tip={T.YOGAS_TIP}>The yogas</Eyebrow>
      {yogas.length > 0 ? (
        <p style={{ ...bodyStyle, marginBottom: 0 }}>
          {yogas.map((y, i) => (
            <span key={y.key}>
              {i > 0 && " "}
              <span style={{ color: "var(--gold2)" }}>{y.name}</span>: {T.YOGA_TEXT[y.key](v)}
            </span>
          ))}
        </p>
      ) : (
        <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No classical yoga marks this chart; its strength is spread evenly.</p>
      )}

      <Methodology title="How this chart is drawn">
        {T.KUNDLI_METHOD_1}
        <br /><br />
        {T.KUNDLI_METHOD_2}
      </Methodology>
    </>
  );
}
