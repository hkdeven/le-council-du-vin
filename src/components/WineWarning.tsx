"use client";

import { useEffect } from "react";
import type { MetBefore } from "@/lib/wineMatch";

// The two warnings a member may meet while logging a wine. Neither forbids
// the bottle; both are meant to be read rather than skimmed past, which is
// why one of them stops the page.

// A twin already logged for tonight costs the table a standing, so it is a
// popup: the member must dismiss it before carrying on. It names nobody.
export function TwinPopup({ text, onClose }: { text: string; onClose: () => void }) {
  // Escape closes it, as it closes everything else with a backdrop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [first, ...rest] = text.split(/(?<=!)\s+/);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="This wine is already logged for tonight"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rise"
        style={{
          maxWidth: 380, width: "100%", background: "linear-gradient(180deg,#141110,#0b0a09)",
          border: "1px solid var(--gold)", borderRadius: 14, padding: "22px 20px", textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <i className="ti ti-alert-triangle" style={{ fontSize: 30, color: "var(--gold2)" }} aria-hidden="true" />
        <p className="disp" style={{ fontSize: 16, lineHeight: 1.4, color: "var(--gold2)", margin: "12px 0 0", letterSpacing: "0.01em" }}>
          {first}
        </p>
        {rest.length > 0 && (
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--parch)", margin: "12px 0 0" }}>
            {rest.join(" ")}
          </p>
        )}
        <button className="btn gold" style={{ marginTop: 20, fontSize: 13 }} onClick={onClose} autoFocus>
          Understood
        </button>
      </div>
    </div>
  );
}

// A wine the Council has met before costs nothing but pride, so it stays on
// the page, under the name it belongs to. Three lines, each on its own.
export function MetBeforeNotice({ met }: { met: MetBefore }) {
  return (
    <div style={{
      margin: "9px 0 0", border: "1px solid var(--gold)", borderRadius: 10,
      padding: "12px 13px", background: "rgba(156,138,95,0.10)", textAlign: "left",
    }}>
      <p className="disp" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.4, color: "var(--gold2)" }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 13, marginRight: 7 }} aria-hidden="true" />
        {met.lead}
      </p>
      <p style={{ margin: "7px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--bright, var(--parch))" }}>{met.detail}</p>
      <p style={{ margin: "7px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--parch)" }}>{met.tail}</p>
    </div>
  );
}
