"use client";

// The Atlas: the Wheel laid upon the world. Lives behind the Wheel's lens
// pill ("The sky" / "The earth") inside the Heavens. Four parts: the map,
// the cities that favour you, the reverse question (ask of a place), and,
// for full members and the Keiser only, the council's map.

import { useEffect, useMemo, useState } from "react";
import { chartReady, Methodology, VeiledGate } from "./NatalChart";
import type { CardMember } from "./MemberCard";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";
import { loadMembers } from "@/lib/members";
import { geocodePlace, type GeoHit } from "@/lib/geo";
import {
  atlasChart, askOfPlace, citiesFor, nearestCities, councilCities, roundKm,
  DEFAULT_SHOWN, PLANET_COLOUR, PLANET_PLAIN, LINE_NAME, LINE_PLAIN, LINE_SAY, QUESTIONS, COUNCIL_THEMES,
  type AtlasChart, type CouncilSoul, type Strength,
} from "@/lib/atlas";
import { atlasMapSvg, layerFor } from "@/lib/atlas-svg";
import type { Member } from "@/lib/types";

const STRENGTH_COLOUR: Record<Strength, string> = { Strong: "var(--gold2)", Noticeable: "var(--gold)", Faint: "var(--faint)" };
const eyebrow: React.CSSProperties = { fontFamily: "'Cinzel', serif", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--gold)", fontSize: 10.5 };
const left: React.CSSProperties = { textAlign: "left" };

export const birthInputOf = (m: CardMember) => ({ dateStr: m.date_of_birth || "", timeStr: m.time_of_birth, tz: m.birth_tz, lat: m.birth_lat, lon: m.birth_lon });

function StrengthTag({ s }: { s: Strength }) {
  return <span style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: STRENGTH_COLOUR[s], whiteSpace: "nowrap" }}>{s}</span>;
}

export function AtlasContent({ member, isSelf, onGo }: { member: CardMember; isSelf?: boolean; onGo: () => void }) {
  const ready = chartReady(member);
  const chart = useMemo(() => (ready ? atlasChart(birthInputOf(member)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, member.date_of_birth, member.time_of_birth, member.birth_tz, member.birth_lat, member.birth_lon]);
  if (!ready || !chart) return <VeiledGate member={member} what="the atlas cannot be drawn" isSelf={isSelf} onGo={onGo} />;
  const you = isSelf ? "you" : "them";
  const your = isSelf ? "your" : "their";
  return (
    <>
      <div className="disp" style={{ fontSize: 19 }}>{member.cult_name}</div>
      <p className="whisper" style={{ fontSize: 13, margin: "2px 0 10px" }}>
        the sky at {your} first breath, laid upon the world
      </p>
      <TheMap chart={chart} member={member} />
      <Favours chart={chart} your={your} />
      <AskOfPlace chart={chart} you={you} your={your} />
      <CouncilMap />
      <Methodology title="How the atlas is drawn">
        The planet positions are the same ones used for the Wheel. Each line is where that planet was rising, overhead, setting or directly below at the minute of birth: the overhead and underfoot lines are meridians, the rising and setting lines are curves found from the planet&apos;s declination and hour angle. A planet&apos;s own latitude above the ecliptic is ignored, which can move the Moon&apos;s lines by up to a degree. A line&apos;s effect is usually said to reach about 600 km either side and to be strongest right on it. Birth time matters: an error of four minutes shifts every line by about 100 km. As with everything in the Heavens, this is for the pleasure of the council and is not advice on where to live.
      </Methodology>
    </>
  );
}

// ── The map ─────────────────────────────────────────────────────────────────

function TheMap({ chart, member }: { chart: AtlasChart; member: CardMember }) {
  const [shown, setShown] = useState<Set<string>>(() => new Set(DEFAULT_SHOWN));
  const [focus, setFocus] = useState<string | null>(null);
  const cities = useMemo(() => (focus ? nearestCities(chart, focus) : []), [chart, focus]);
  const svg = useMemo(() => atlasMapSvg(
    chart.planets.filter((p) => shown.has(p.key)).map((p) => layerFor(p)),
    { home: member.birth_lat != null && member.birth_lon != null ? { lat: member.birth_lat, lon: member.birth_lon } : null, cities, dimAllBut: focus }
  ), [chart, shown, focus, cities, member.birth_lat, member.birth_lon]);
  const tap = (key: string) => {
    if (focus === key) { setFocus(null); return; }
    if (!shown.has(key)) setShown((s) => new Set(s).add(key));
    setFocus(key);
  };
  const focused = focus ? chart.planets.find((p) => p.key === focus) : null;
  return (
    <>
      <div style={{ margin: "0 -8px 6px", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "#050404" }}
        dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, margin: "8px 0 2px" }}>
        {chart.planets.map((p) => {
          const on = shown.has(p.key), f = focus === p.key;
          return (
            <button key={p.key} onClick={() => tap(p.key)} title={p.name} aria-pressed={f}
              style={{ width: 38, height: 30, background: f ? "var(--gold2)" : on ? "rgba(203,189,147,0.06)" : "none", border: `1px solid ${f || on ? "var(--line2)" : "var(--line)"}`, borderRadius: 14, color: f ? "#0a0908" : on ? "var(--gold2)" : "var(--dim)", fontSize: 15, lineHeight: 1, cursor: "pointer", padding: 0 }}>
              {p.glyph}
            </button>
          );
        })}
      </div>
      <p className="whisper" style={{ margin: "6px 0 4px", fontSize: 13 }}>
        {focused ? `${focused.name}: ${PLANET_PLAIN[focused.key]}. Nearest cities marked.` : "Tap a symbol to read one planet's lines; tap again to release. The small eye is the birthplace."}
      </p>
      <div style={{ ...left, display: "grid", gap: 5, margin: "10px 0 2px" }}>
        {(["asc", "mc", "dsc", "ic"] as const).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 14, lineHeight: 1.4 }}>
            <span style={{ flex: "none", width: 22, borderTop: `1.4px ${k === "asc" || k === "mc" ? "solid" : "dashed"} var(--gold2)`, position: "relative", top: -4 }} />
            <span><b style={{ fontFamily: "'Cinzel', serif", fontWeight: 500, fontSize: 10, letterSpacing: "0.08em", color: "var(--gold2)" }}>{LINE_NAME[k].toUpperCase()}</b> · {LINE_PLAIN[k]}</span>
          </div>
        ))}
      </div>
      <div style={{ ...left, display: "grid", gap: 5, margin: "12px 0 2px" }}>
        {chart.planets.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 14, lineHeight: 1.4 }}>
            <span style={{ flex: "none", width: 22, textAlign: "center", color: PLANET_COLOUR[p.key], fontSize: 16, position: "relative", top: 1 }}>{p.glyph}</span>
            <span><b style={{ fontFamily: "'Cinzel', serif", fontWeight: 500, fontSize: 10, letterSpacing: "0.08em", color: "var(--gold2)" }}>{p.name.toUpperCase()}</b> · {PLANET_PLAIN[p.key]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Where the sky favours you ───────────────────────────────────────────────

function Favours({ chart, your }: { chart: AtlasChart; your: string }) {
  const groups = useMemo(() => QUESTIONS.map((q) => ({ q, rows: citiesFor(chart, q, 4) })), [chart]);
  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
      <div style={{ ...eyebrow, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12 }}>
        <i className="ti ti-compass" /> Where the sky favours {your === "your" ? "you" : "them"}
      </div>
      <p className="whisper" style={{ margin: "4px 0 2px", fontSize: 13 }}>
        Strong: line within 200 km. Noticeable: within 400. Faint: within 600.
      </p>
      {groups.map(({ q, rows }) => {
        const p = chart.planets.find((x) => x.key === q.planet)!;
        return (
          <div key={q.key} style={left}>
            <div style={{ margin: "14px 0 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...eyebrow, color: q.warn ? "#b08a8e" : "var(--gold)" }}>{q.title}</span>
                <span style={{ color: PLANET_COLOUR[q.planet], fontSize: 15 }}>{p.glyph}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--dim)", marginTop: 2, lineHeight: 1.4 }}>{q.why}</div>
            </div>
            {rows.length ? rows.map((r) => (
              <div key={r.city[0] + r.city[1]} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 10px", padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: "var(--gold2)" }}>{r.city[0]}</span>
                <span style={{ alignSelf: "center" }}><StrengthTag s={r.strength} /></span>
                <span style={{ gridColumn: "1 / 3", fontSize: 13.5, color: "var(--dim)" }}>{p.name} {LINE_NAME[r.kind]} line passes {roundKm(r.km)} km away</span>
              </div>
            )) : (
              <p className="whisper" style={{ margin: "4px 0", fontSize: 13, textAlign: "left" }}>No major city is within 600 km of this line. It runs mostly over sea or open country.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Ask of a place ──────────────────────────────────────────────────────────

function AskOfPlace({ chart, you, your }: { chart: AtlasChart; you: string; your: string }) {
  const [q, setQ] = useState("");
  const [seeking, setSeeking] = useState(false);
  const [hits, setHits] = useState<GeoHit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [place, setPlace] = useState<GeoHit | null>(null);
  const seek = async () => {
    if (!q.trim() || seeking) return;
    setSeeking(true); setErr(null); setPlace(null);
    const res = await geocodePlace(q);
    setSeeking(false);
    setErr(res.error);
    setHits(res.error ? null : res.hits);
    if (!res.error && res.hits.length === 1) pick(res.hits[0]);
    if (!res.error && res.hits.length === 0) setErr("The atlas does not know that town. Try the nearest city, or add the country.");
  };
  const pick = (h: GeoHit) => { setPlace(h); setHits([]); setQ(h.label); };
  const reading = useMemo(() => (place ? askOfPlace(chart, place.latitude, place.longitude) : null), [chart, place]);
  const town = place ? place.label.split(",")[0] : "";
  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
      <div style={{ ...eyebrow, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12 }}>
        <i className="ti ti-map-pin" /> Ask of a place
      </div>
      <p className="whisper" style={{ margin: "4px 0 8px", fontSize: 13 }}>Name a town, and read what {your} chart says about {you} being there.</p>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && seek()} placeholder="Lisbon, Portugal"
          style={{ flex: 1, minWidth: 0, background: "#0a0908", border: "1px solid var(--line2)", borderRadius: 10, color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontSize: 17, padding: "9px 12px" }} />
        <button onClick={seek} disabled={seeking || !q.trim()}
          style={{ width: "auto", flex: "none", background: "none", border: "1px solid var(--line2)", borderRadius: 10, color: "var(--parch)", fontFamily: "'Cinzel', serif", fontSize: 10.5, letterSpacing: "0.08em", padding: "0 14px", cursor: "pointer", opacity: seeking || !q.trim() ? 0.5 : 1 }}>
          {seeking ? <i className="ti ti-loader-2" /> : "Seek"}
        </button>
      </div>
      {err && <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#b08a8e", textAlign: "left" }}>{err}</p>}
      {hits && hits.length > 1 && (
        <div style={{ ...left, marginTop: 8 }}>
          <p className="whisper" style={{ margin: "0 0 4px", fontSize: 12.5 }}>which of these?</p>
          {hits.slice(0, 6).map((h) => (
            <button key={h.label + h.latitude} onClick={() => pick(h)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--line)", color: "var(--parch)", fontFamily: "'Cormorant Garamond', serif", fontSize: 15.5, padding: "7px 2px", cursor: "pointer" }}>
              {h.label}
            </button>
          ))}
        </div>
      )}
      {place && reading && (
        <div style={{ ...left, marginTop: 10 }}>
          {reading.length === 0 ? (
            <div style={verdictBox}>
              <b style={verdictHead}>In short</b>
              None of {your} lines comes within 600 km of {town}. A neutral place for {you}: nothing in {your} chart pushes or pulls {you} here.
            </div>
          ) : (
            <>
              <div style={verdictBox}>
                <b style={verdictHead}>In short</b>
                {town} is mostly a {reading[0].planet.name} place for {you}: {PLANET_PLAIN[reading[0].planet.key]}. {LINE_SAY[reading[0].planet.key][reading[0].kind]}
              </div>
              {reading.map((h) => (
                <div key={h.planet.key + h.kind} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: "2px 8px", padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ gridRow: "1 / 3", fontSize: 18, lineHeight: 1.1, color: PLANET_COLOUR[h.planet.key] }}>{h.planet.glyph}</span>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline", fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.08em", color: "var(--gold2)" }}>
                    {h.planet.name.toUpperCase()} {LINE_NAME[h.kind].toUpperCase()} <StrengthTag s={h.strength} />
                    <small style={{ fontFamily: "'EB Garamond', serif", fontSize: 12.5, letterSpacing: 0, color: "var(--dim)" }}>line passes {roundKm(h.km)} km away</small>
                  </span>
                  <span style={{ fontSize: 15, color: "var(--parch)", lineHeight: 1.45 }}>{LINE_SAY[h.planet.key][h.kind]}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
const verdictBox: React.CSSProperties = { fontSize: 15, lineHeight: 1.5, color: "var(--parch)", margin: "0 0 4px", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "rgba(203,189,147,0.04)" };
const verdictHead: React.CSSProperties = { display: "block", fontFamily: "'Cinzel', serif", fontWeight: 500, fontSize: 10, letterSpacing: "0.1em", color: "var(--gold)", marginBottom: 3 };

// ── The council's map ───────────────────────────────────────────────────────
// Full members and the Keiser only: initiates never see it, on any card.

const COUNCIL_ROLES = new Set(["member", "keiser"]);

function CouncilMap() {
  const { role, mode, member: me } = useAuth();
  const allowed = COUNCIL_ROLES.has(role);
  const [souls, setSouls] = useState<CouncilSoul[] | null>(null);
  const [theme, setTheme] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const fold = (list: Member[]) => {
      const out: CouncilSoul[] = [];
      for (const m of list) {
        if (m.active === false || !COUNCIL_ROLES.has(m.role)) continue;
        if (!chartReady(m)) continue;
        const chart = atlasChart(birthInputOf(m));
        if (!chart) continue;
        out.push({ id: m.id, initials: (m.short_name || m.cult_name.slice(0, 2)).toUpperCase(), name: m.cult_name, chart, self: !!me && m.id === me.id });
      }
      if (!cancelled) setSouls(out);
    };
    if (mode === "live" && supabase) {
      supabase.from("members").select("id,cult_name,short_name,role,active,date_of_birth,time_of_birth,birth_lat,birth_lon,birth_tz")
        .then(({ data }) => fold((data || []) as Member[]));
    } else {
      fold(loadMembers());
    }
    return () => { cancelled = true; };
  }, [allowed, mode, me]);

  const T = COUNCIL_THEMES[theme];
  const ranked = useMemo(() => (souls ? councilCities(souls, T) : []), [souls, T]);
  const svg = useMemo(() => {
    if (!souls) return "";
    return atlasMapSvg(souls.map((s) => ({
      id: s.id, label: s.initials, colour: s.self ? "#cbbd93" : "#8a8474", kinds: T.kinds,
      lines: s.chart.planets.find((p) => p.key === T.planet)!,
      labelFont: `font-family="'Cinzel',serif" font-size="9" letter-spacing="1"`,
    })).filter((l) => l.lines));
  }, [souls, T]);

  if (!allowed) return null;
  const planetGlyph = (key: string) => souls?.[0]?.chart.planets.find((p) => p.key === key)?.glyph || "";
  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
      <div style={{ ...eyebrow, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12 }}>
        <i className="ti ti-users" /> The council&apos;s map
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line2)", borderRadius: 6, padding: "4px 9px", fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)", margin: "6px 0 4px" }}>
        <i className="ti ti-lock" /> Members and the Keiser only
      </div>
      <p className="whisper" style={{ margin: "0 0 6px", fontSize: 13 }}>Everyone&apos;s lines on one map, one theme at a time. Initials sit at the top of each line; yours are brighter.</p>
      <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", margin: "4px 0 8px" }}>
        {COUNCIL_THEMES.map((t, i) => (
          <button key={t.key} onClick={() => setTheme(i)}
            style={{ width: "auto", border: "none", cursor: "pointer", padding: "6px 11px", background: theme === i ? "var(--gold2)" : "none", color: theme === i ? "#0a0908" : "var(--dim)", fontFamily: "'Cinzel', serif", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {t.title} {planetGlyph(t.planet)}
          </button>
        ))}
      </div>
      {!souls ? (
        <p className="whisper" style={{ fontSize: 13 }}>gathering the council&apos;s skies…</p>
      ) : souls.length === 0 ? (
        <p className="whisper" style={{ fontSize: 13 }}>No member&apos;s record is complete enough to draw yet.</p>
      ) : (
        <>
          <div style={{ margin: "0 -8px 6px", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "#050404" }} dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="whisper" style={{ margin: "4px 0 8px", fontSize: 13 }}>
            {T.title}: {T.kinds.map((k) => LINE_NAME[k]).join(" and ")} lines, one set per member.
          </p>
          <div style={{ ...eyebrow, ...left, margin: "10px 0 4px" }}>Where the council would travel well</div>
          {ranked.length === 0 ? (
            <p className="whisper" style={{ fontSize: 13, textAlign: "left", margin: "4px 0" }}>No city gathers more than one member for this theme.</p>
          ) : ranked.map((r) => (
            <div key={r.city[0] + r.city[1]} style={{ ...left, display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 10px", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: "var(--gold2)" }}>{r.city[0]}</span>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.1em", color: "var(--gold2)", alignSelf: "center", whiteSpace: "nowrap" }}>{r.who.length} of {souls.length}</span>
              <span style={{ gridColumn: "1 / 3", display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                {r.who.map((w) => (
                  <span key={w.id} title={w.name} style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.08em", border: `1px solid ${w.self ? "var(--line2)" : "var(--line)"}`, borderRadius: 4, padding: "2px 6px", color: w.self ? "var(--gold2)" : "var(--parch)" }}>{w.initials}</span>
                ))}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
