"use client";

// The Council's tooltip: a small info glyph that opens on tap (toggle) or
// hover where hover exists. Only one is ever open at once, any outside tap
// dismisses, and the bubble nudges itself back inside the viewport.
// Shared by the member card, the Kundli, and anywhere else a whisper helps.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function Tip({ text, align = "right" }: { text: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  // Only one tooltip open anywhere: opening one announces itself and every
  // other tooltip closes (they used to pile up until closed by hand).
  const me = useRef({});
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("lcv-tip-open", { detail: me.current }));
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== me.current) setOpen(false);
    };
    // Any tap outside the tip (not just on another tip) dismisses it.
    const onDoc = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("lcv-tip-open", onOther);
    document.addEventListener("pointerdown", onDoc, true);
    return () => {
      window.removeEventListener("lcv-tip-open", onOther);
      document.removeEventListener("pointerdown", onDoc, true);
    };
  }, [open]);
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
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", marginLeft: 5 }}>
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
