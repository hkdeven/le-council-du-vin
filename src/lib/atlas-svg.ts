// The Atlas map as an SVG string, shared by the card (interactive legend on
// top) and the email (rasterised once at send time). Equirectangular,
// 1000 x 500, hairline coasts, no tiles, no outside map service.

import { LAND_PATH } from "./atlas-land";
import { PLANET_COLOUR, type LineKind, type PlanetLines } from "./atlas";
import type { AtlasCity } from "./atlas-cities";

export const MAP_W = 1000, MAP_H = 500;
export const mapX = (lon: number) => ((lon + 180) / 360) * MAP_W;
export const mapY = (lat: number) => ((90 - lat) / 180) * MAP_H;

export interface MapLayer {
  id: string; // data-p attribute, for dimming
  label: string; // glyph or initials at the top of the meridian lines
  colour: string;
  lines: PlanetLines;
  kinds?: LineKind[]; // default all four
  labelFont?: string;
}

export interface MapOptions {
  home?: { lat: number; lon: number } | null; // the birthplace eye
  cities?: AtlasCity[]; // marked and named
  dimAllBut?: string | null; // layer id kept bright
}

export function layerFor(p: PlanetLines, kinds?: LineKind[]): MapLayer {
  return { id: p.key, label: p.glyph, colour: PLANET_COLOUR[p.key] || "#cbbd93", lines: p, kinds };
}

export function atlasMapSvg(layers: MapLayer[], opts: MapOptions = {}): string {
  const dim = (id: string) => (opts.dimAllBut && opts.dimAllBut !== id ? ' opacity="0.12"' : "");
  let s = `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The Atlas">`;
  s += `<rect width="${MAP_W}" height="${MAP_H}" fill="#050404"/>`;
  for (let lon = -150; lon <= 150; lon += 30) s += `<line x1="${mapX(lon)}" y1="0" x2="${mapX(lon)}" y2="${MAP_H}" stroke="rgba(160,150,120,0.08)" stroke-width="0.6"/>`;
  for (let lat = -60; lat <= 60; lat += 30) s += `<line x1="0" y1="${mapY(lat)}" x2="${MAP_W}" y2="${mapY(lat)}" stroke="rgba(160,150,120,${lat === 0 ? 0.16 : 0.08})" stroke-width="0.6"/>`;
  s += `<path d="${LAND_PATH}" fill="#100e0c" stroke="rgba(160,150,120,0.35)" stroke-width="0.7"/>`;
  for (const L of layers) {
    const kinds = L.kinds || ["asc", "mc", "dsc", "ic"];
    const g = `data-p="${L.id}"${dim(L.id)}`;
    const font = L.labelFont || `font-family="'EB Garamond',serif" font-size="13"`;
    const solid = `fill="none" stroke="${L.colour}" stroke-width="1.1" opacity="0.85"`;
    const dashed = `${solid} stroke-dasharray="3 3"`;
    if (kinds.includes("mc")) {
      const x = mapX(L.lines.mc);
      s += `<g ${g}><line x1="${x}" y1="14" x2="${x}" y2="${MAP_H}" ${solid}/><text x="${x}" y="11" text-anchor="middle" fill="${L.colour}" ${font}>${L.label}</text></g>`;
    }
    if (kinds.includes("ic")) {
      const x = mapX(L.lines.ic);
      s += `<g ${g}><line x1="${x}" y1="14" x2="${x}" y2="${MAP_H}" ${dashed}/><text x="${x}" y="11" text-anchor="middle" fill="${L.colour}" opacity="0.6" ${font}>${L.label}</text></g>`;
    }
    for (const k of ["asc", "dsc"] as const) {
      if (!kinds.includes(k)) continue;
      for (const seg of L.lines[k]) {
        const pts = seg.map((q) => `${mapX(q[0]).toFixed(1)},${mapY(q[1]).toFixed(1)}`).join(" ");
        s += `<polyline ${g} points="${pts}" ${k === "asc" ? solid : dashed}/>`;
      }
    }
  }
  if (opts.home) {
    const x = mapX(opts.home.lon), y = mapY(opts.home.lat);
    s += `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#cbbd93" stroke-width="1"/><circle cx="${x}" cy="${y}" r="1.2" fill="#cbbd93"/>`;
  }
  for (const c of opts.cities || []) {
    const x = mapX(c[3]), y = mapY(c[2]);
    s += `<circle cx="${x}" cy="${y}" r="2.2" fill="#cbbd93" opacity="0.9"/><text x="${x + 5}" y="${y + 3}" font-size="10" fill="#cbc5b7" font-family="'Cormorant Garamond',serif" font-style="italic">${escapeXml(c[0])}</text>`;
  }
  return s + "</svg>";
}

function escapeXml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
