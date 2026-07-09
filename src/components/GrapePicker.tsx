"use client";

// Multi-grape picker: chosen varietals as removable chips, plus an input with
// the full grape list to add more. Callers auto-detect from the wine's name
// via detectVarietals and merge the result in.

import { useState } from "react";
import { GRAPES } from "@/lib/varietals";

export default function GrapePicker({ value, onChange, listId }: {
  value: string[];
  onChange: (next: string[]) => void;
  listId: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    const match = GRAPES.find((g) => g.toLowerCase() === name.toLowerCase()) || name;
    if (!value.includes(match)) onChange([...value, match]);
    setDraft("");
  };

  return (
    <div>
      <datalist id={listId}>
        {GRAPES.filter((g) => !value.includes(g)).map((g) => <option key={g} value={g} />)}
      </datalist>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((g) => (
            <span key={g} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid var(--line2)", borderRadius: 12, padding: "2px 8px 2px 10px", fontSize: 12.5, color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif" }}>
              {g}
              <button onClick={() => onChange(value.filter((x) => x !== g))} aria-label={`Remove ${g}`}
                style={{ width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 0, display: "inline-flex" }}>
                <i className="ti ti-x" style={{ fontSize: 11 }} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
        onBlur={() => add(draft)}
        placeholder={value.length ? "Another grape…" : "The grape…"}
      />
    </div>
  );
}
