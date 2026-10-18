// The cloth number: the order a bottle was poured in, written as a plain
// number inside a circle, and always trailing whatever it belongs to.
//
// It used to be a roman numeral, which put it in the same typeface as the
// PLACE a wine took, so a row read "II · Bottle III" and the table could not
// tell the pour from the standing. The circle now marks a cloth as a cloth
// before a word is read, and the place stays roman.
//
// The other half of the rule: claiming a wine replaces only the word "Bottle"
// with its name. The number stays, so the order of the night survives the
// naming: "Bottle ⑤" becomes "Porseleinberg 2021 ⑤".

import type { CSSProperties } from "react";

export function Cloth({ n, size = 21, tone = "gold", style }: {
  n: number | null | undefined;
  size?: number;
  tone?: "gold" | "wine" | "spoiled";
  style?: CSSProperties;
}) {
  // A hand-recorded night may never have known the pour order. Nothing is
  // drawn rather than a circle around a guess.
  if (n == null) return null;
  const colour = tone === "wine" ? "#c99" : tone === "spoiled" ? "var(--spoiled)" : "var(--gold2)";
  const border = tone === "wine" ? "#6d3a3e" : tone === "spoiled" ? "#8a6c3a" : "var(--line2)";
  return (
    <span
      aria-label={`Cloth ${n}`}
      title={`Poured ${ordinal(n)}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: "50%", flex: "none",
        border: `1px solid ${border}`, color: colour,
        fontFamily: "'Cinzel', serif", fontSize: Math.round(size * 0.52),
        background: "radial-gradient(circle, #161310, #0d0b0a)",
        lineHeight: 1, ...style,
      }}
    >
      {n}
    </span>
  );
}

// A wine as it is written anywhere the cloth matters: the name if it has one,
// the word "Bottle" if it does not, and the circled number either way.
export function WineName({ title, cloth, size = 21, tone = "gold", strike = false, style }: {
  title?: string | null;
  cloth: number | null | undefined;
  size?: number;
  tone?: "gold" | "wine" | "spoiled";
  strike?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap", ...style }}>
      <span style={{ textDecoration: strike ? "line-through" : "none" }}>{title || "Bottle"}</span>
      <Cloth n={cloth} size={size} tone={tone} />
    </span>
  );
}

// The same rule in plain text, for the places a circle cannot go: an email
// body, a calendar entry, a filename, a screen reader's ear.
export const wineNameText = (title: string | null | undefined, cloth: number | null | undefined): string =>
  cloth == null ? (title || "Bottle") : `${title || "Bottle"} ${cloth}`;

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
}
