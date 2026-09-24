// The envelopes of the Heavens: builders that gather a member's live sky
// data and send each view to their own inbox. Shared by the Heavens' per-view
// envelope and anything else that needs a sky email. The send route only
// ever accepts the caller's own address for these types.

import { sendEmail } from "./sendEmail";
import { supabase } from "./supabase";
import { fullChart, ordinal } from "./natal";
import { foretellingFor } from "./transits";
import { vedicChart, RASHIS, RASHI_WESTERN, NAKSHATRAS } from "./vedic";
import { pillarsOf, detectYogas, mangalDosha, muhurtaDays, sanskritLord } from "./kundli";
import * as T from "./kundli-text";
import { panchangOf, dayStarFor, gocharaFor, gocharaPassage, yearTurnings, ironPassageFor, clockWithin } from "./gochara";
import { wheelSvgString } from "@/components/NatalChart";
import { atlasChart, citiesFor, roundKm, placeContext, DEFAULT_SHOWN, LINE_NAME, QUESTIONS } from "./atlas";
import { atlasMapSvg, layerFor } from "./atlas-svg";
import type { CardMember } from "@/components/MemberCard";

export type SendResult = { ok: boolean; sent?: number; failed?: number; skipped?: string; error?: string };

const birthLineOf = (m: CardMember) =>
  m.date_of_birth
    ? `${new Date(m.date_of_birth).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${m.time_of_birth ? `, ${m.time_of_birth}` : ""}${m.birth_place ? `, ${m.birth_place.split(",")[0]}` : ""}`
    : undefined;

// Rasterise an SVG and stage it in Storage so an email can carry it.
async function svgPngUrl(svg: string, w: number, h: number, prefix: string): Promise<string | undefined> {
  try {
    return await new Promise<string | undefined>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        c.toBlob(async (blob) => {
          if (!blob || !supabase) return resolve(undefined);
          const path = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`;
          const { error } = await supabase.storage.from("charts").upload(path, blob, { contentType: "image/png" });
          if (error) return resolve(undefined);
          resolve(supabase.storage.from("charts").getPublicUrl(path).data.publicUrl);
        }, "image/png");
      };
      img.onerror = () => resolve(undefined);
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    });
  } catch {
    return undefined;
  }
}

const wheelPngUrl = (chart: NonNullable<ReturnType<typeof fullChart>>) => svgPngUrl(wheelSvgString(chart), 660, 660, "wheel");

export async function emailAtlas(self: CardMember, email: string): Promise<SendResult> {
  const chart = atlasChart({ dateStr: self.date_of_birth || "", timeStr: self.time_of_birth, tz: self.birth_tz, lat: self.birth_lat, lon: self.birth_lon });
  if (!chart) return { ok: false, error: "The sky is veiled; complete the record first." };
  const svg = atlasMapSvg(chart.planets.filter((p) => DEFAULT_SHOWN.includes(p.key)).map((p) => layerFor(p)), { home: { lat: self.birth_lat!, lon: self.birth_lon! } });
  const mapUrl = await svgPngUrl(svg, 1200, 600, "atlas");
  return sendEmail("atlas", [email], {
    name: self.cult_name, birthLine: birthLineOf(self), mapUrl,
    groups: QUESTIONS.map((q) => {
      const planet = chart.planets.find((x) => x.key === q.planet)!;
      return { title: q.title, why: q.why, rows: citiesFor(chart, q, 4).map((r) => ({ city: `${r.city[0]} <span style="color:#8a7f66;font-size:13px;font-style:italic;">${placeContext(r.city)}</span>`, detail: `${planet.name} ${LINE_NAME[r.kind]} line passes ${roundKm(r.km)} km away`, strength: r.strength })) };
    }),
  });
}

export async function emailWheel(self: CardMember, email: string): Promise<SendResult> {
  const chart = fullChart(self.date_of_birth!, self.time_of_birth, self.birth_tz, self.birth_lat, self.birth_lon);
  if (!chart) return { ok: false, error: "The sky is veiled; complete the record first." };
  const wheelUrl = await wheelPngUrl(chart);
  const sunP = chart.planets.find((x) => x.key === "sun")!;
  const moonP = chart.planets.find((x) => x.key === "moon")!;
  return sendEmail("natal", [email], {
    name: self.cult_name, birthLine: birthLineOf(self), wheelUrl,
    sun: `${sunP.sign.symbol} ${sunP.sign.name}`,
    moon: `${moonP.sign.symbol} ${moonP.sign.name}`,
    rising: chart.ascSign ? `${chart.ascSign.symbol} ${chart.ascSign.name}` : undefined,
    rows: chart.planets.map((x) => ({ glyph: x.glyph, planet: x.name, value: `${x.sign.symbol} ${x.sign.name} ${x.deg}°${x.house ? ` · ${ordinal(x.house)} house` : ""}` })),
  });
}

export async function emailForetelling(self: CardMember, email: string): Promise<SendResult> {
  const r = foretellingFor({ dateStr: self.date_of_birth!, timeStr: self.time_of_birth, tz: self.birth_tz, lat: self.birth_lat, lon: self.birth_lon }, Date.now());
  if (!r) return { ok: false, error: "The sky is veiled; complete the record first." };
  return sendEmail("foretelling", [email], {
    name: self.cult_name, dayLabel: r.dayLabel, moonLabel: r.moonLabel, yearLabel: r.yearLabel,
    day: r.day, entries: r.entries, warning: r.warning || undefined, year: r.year,
  });
}

export async function emailKundli(self: CardMember, email: string): Promise<SendResult> {
  const chart = vedicChart(self.date_of_birth!, self.time_of_birth, self.birth_tz, self.birth_lat, self.birth_lon, Date.now());
  if (!chart) return { ok: false, error: "The sky is veiled; complete the record first." };
  const my = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const yr = (ms: number) => new Date(ms).getFullYear();
  const cur = chart.current;
  const nextMaha = cur ? chart.mahadashas[chart.mahadashas.findIndex((d) => d === cur.maha) + 1] : null;
  const pillars = pillarsOf(chart);
  const yogas = detectYogas(chart);
  const muhurta = muhurtaDays(chart.moonNakshatra, chart.lagna.rashi, Date.now());
  const v = T.SELF;
  return sendEmail("kundli", [email], {
    name: self.cult_name,
    lagna: `${RASHIS[chart.lagna.rashi]} (${RASHI_WESTERN[chart.lagna.rashi]}) · ${chart.lagna.degInRashi.toFixed(1)}°`,
    nakshatra: `${NAKSHATRAS[chart.moonNakshatra]} · pada ${chart.moonPada}`,
    navamsa: `${RASHIS[chart.lagna.navamsaRashi]} (D9)`,
    ageTitle: cur ? `The years of ${sanskritLord(cur.maha.lord)}` : undefined,
    ageDates: cur ? `${my(cur.maha.fromMs)} to ${my(cur.maha.toMs)}${cur.antar.lord !== cur.maha.lord ? ` · tempered by ${sanskritLord(cur.antar.lord)} until ${my(cur.antar.toMs)}` : ""}` : undefined,
    agePassage: cur ? `${T.DASHA_TEXT[cur.maha.lord](v)}${cur.antar.lord !== cur.maha.lord ? ` ${T.ANTAR_TEXT[cur.antar.lord](v)}` : ""}` : undefined,
    nextLine: nextMaha ? `Next: the years of ${sanskritLord(nextMaha.lord)} from ${my(nextMaha.fromMs)}, ${T.NEXT_CLAUSE[nextMaha.lord]}.` : undefined,
    turning: chart.mahadashas.slice(0, 9).map((d) => ({ lord: d.lord, range: `${yr(d.fromMs)} to ${yr(d.toMs)}`, now: Date.now() >= d.fromMs && Date.now() < d.toMs })),
    strength: T.STRENGTH_BY_HOUSE[pillars.lagnaLordHouse - 1](v, sanskritLord(pillars.lagnaLord)),
    dharma: T.DHARMA_BY_LORD[pillars.tenthLord]?.(v, RASHIS[pillars.tenthRashi]),
    pitfalls: pillars.pitfalls.slice(0, 2).map((k) => T.PITFALL_TEXT[k]?.(v)).filter(Boolean).join(" ") || undefined,
    marriage: pillars.seventhLordHouse != null
      ? `${T.SEVENTH_LORD_HOUSE[pillars.seventhLordHouse - 1](v, RASHIS[pillars.seventhRashi], sanskritLord(pillars.seventhLord))}${T.venusLine(v, pillars.venusHouse)} The navamsa, chart of the marriage itself, rises in ${RASHIS[chart.lagna.navamsaRashi]}: ${T.NAVAMSA_BOND[chart.lagna.navamsaRashi]}${mangalDosha(chart) ? T.MANGAL_NOTE(v) : ""}`
      : undefined,
    yogas: yogas.map((y) => ({ name: y.name, text: T.YOGA_TEXT[y.key](v) })),
    muhurtaGood: muhurta.favourable.map((d) => d.label),
    muhurtaBad: muhurta.hostile.map((d) => d.label),
  });
}

export async function emailVedicForetelling(self: CardMember, email: string): Promise<SendResult> {
  const chart = vedicChart(self.date_of_birth!, self.time_of_birth, self.birth_tz, self.birth_lat, self.birth_lon, Date.now());
  if (!chart) return { ok: false, error: "The sky is veiled; complete the record first." };
  const now = Date.now();
  const v = { obj: "you", pos: "your", subj: "you" };
  const panchang = panchangOf(now);
  const dayStar = dayStarFor(chart, now, v);
  const gochara = gocharaFor(chart, now);
  const turnings = yearTurnings(chart, now);
  const iron = ironPassageFor(chart, now, v);
  const clock = clockWithin(chart, now);
  return sendEmail("vedic-foretelling", [email], {
    name: self.cult_name,
    dayLabel: new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    dayStar: dayStar?.tara,
    dayPassage: dayStar ? `${dayStar.passage} ${dayStar.moonLine}` : undefined,
    almanac: panchang ? [
      { label: "Tithi", value: panchang.tithi },
      { label: "Day lord", value: panchang.dayLord },
      { label: "Nakshatra", value: panchang.nakshatra },
      { label: "Yoga", value: panchang.yoga },
      { label: "Karana", value: panchang.karana },
    ] : undefined,
    monthLabel: new Date(now).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    gochara: gochara.map((g) => ({ lord: g.lord, line: g.line, favourable: g.favourable })),
    moonPassage: gocharaPassage(gochara, v),
    turnings: turnings.map((t) => ({ date: t.label, text: t.text })),
    clock: clock.map((c) => ({ lord: c.lord, range: c.range, now: c.now })),
    ironTitle: iron?.title,
    ironWhisper: iron?.whisper,
    ironBody: iron?.body,
    ironNext: iron?.next || undefined,
  });
}
