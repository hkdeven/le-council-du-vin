"use client";

import { useState, useEffect, useRef } from "react";
import { seedMembers } from "@/lib/seed";
import { loadMembers } from "@/lib/members";
import { toRoman } from "@/lib/util";
import { fetchAllOfferings, claimCloth, type Offering } from "@/lib/bottles";
import { applyClaims, claimedCloth, unnamedClaimants } from "@/lib/revealClaims";
import { supabase } from "@/lib/supabase";
import { fetchAllBallots, statsFromBallots, fetchRevealStats, type RevealStats } from "@/lib/ballots";
import { fetchAnnal, commitAnnal, AnnalRow } from "@/lib/annals";
import { fetchRevealGathering, updateGathering, revealWindowClosed } from "@/lib/gatherings";
import { useRiteOpen } from "@/lib/useRiteOpen";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { sendEmail } from "@/lib/sendEmail";
import { useWineCount } from "@/lib/useWineCount";
import BottleReveal from "@/components/BottleReveal";
import { Cloth, WineName } from "@/components/Cloth";
import { bindRows, placeNight, rankIn, championsIn, annalScores, type TallyRow } from "@/lib/tally";
import type { Gathering } from "@/lib/types";

interface RevealRow {
  cloth: number;
  title: string; // the wine itself, unknown until the cloth is lifted
  owner: string; // who brought it, claimed after the cloths come off
  score: number; // average of every sealed ballot
  votes: number;
  dq: boolean; // disqualified by the Keiser for breaking theme
  spoiled?: boolean; // the bottle came up bad: recorded, never judged
  bind?: number | null; // the same wine as every row sharing this key
  // What THIS cloth was given, as against the shared figure `score` shows.
  rawScore?: number;
  rawVotes?: number;
  varietals?: string[]; // carried from the claimed offering
  price?: number | null; // rand, when the owner logged it
}

// Every verdict cast on one cloth, as the table reads it back: who judged it,
// what they gave it, and what they wrote. The reader comes first, always.
interface Verdict { memberId: string; name: string; avatar: string | null; score: number; note: string; mine: boolean; cloth: number }

// Inline click-to-edit text for the wine's name.
function Inline({ value, placeholder, onChange, canEdit, style }: { value: string; placeholder: string; onChange: (v: string) => void; canEdit: boolean; style?: React.CSSProperties }) {
  const [editing, setEditing] = useState(false);
  if (!canEdit) return <span style={{ color: value ? undefined : "var(--faint)", fontStyle: value ? undefined : "italic", ...style }}>{value || placeholder}</span>;
  if (editing) {
    return (
      <input
        value={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
        placeholder={placeholder}
        style={{ padding: "4px 8px", fontSize: 14, maxWidth: 240, display: "inline-block", width: "auto", ...style }}
      />
    );
  }
  return (
    <span onClick={() => setEditing(true)} title="Click to edit" style={{ cursor: "pointer", color: value ? undefined : "var(--faint)", fontStyle: value ? undefined : "italic", ...style }}>
      {value || placeholder}
      <i className="ti ti-pencil" style={{ fontSize: 11, marginLeft: 5, color: "var(--faint)" }} aria-hidden="true" />
    </span>
  );
}

// A bottle's owner slot: claim it as yours, release a mistaken claim.
function OwnerSlot({ owner, mine, canClaim, canAct, onClaim, onRelease, style }: {
  owner: string; mine: boolean; canClaim: boolean; canAct: boolean; onClaim: () => void; onRelease: () => void; style?: React.CSSProperties;
}) {
  if (owner) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={style}>{owner}</span>
        {mine && canAct && (
          <button onClick={onRelease} title="Not yours? Release it" aria-label="Release this bottle"
            style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13 }}>
            <i className="ti ti-x" style={{ fontSize: 11, marginRight: 3 }} />release
          </button>
        )}
      </span>
    );
  }
  if (canClaim && canAct) {
    return (
      <button onClick={onClaim} aria-label="Claim this bottle"
        style={{ width: "auto", background: "none", border: "1px solid var(--line2)", borderRadius: 14, color: "var(--gold2)", padding: "3px 12px", cursor: "pointer", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14 }}>
        <i className="ti ti-hand-grab" style={{ fontSize: 12, marginRight: 5 }} />claim this bottle
      </button>
    );
  }
  return <span className="whisper" style={{ fontSize: 14 }}>unclaimed</span>;
}

// A soul's face, as the Council keeps it. Only the victor wears one on the
// reveal; the rest of the table is named, not pictured.
function Face({ src, size = 86 }: { src?: string | null; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flex: "none", overflow: "hidden",
        border: `1px solid ${size > 50 ? "var(--gold)" : "var(--line2)"}`,
        background: src ? `#0d0b0a center / cover no-repeat url(${JSON.stringify(src)})` : "radial-gradient(circle at 50% 35%, #272118, #0d0b0a)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: size > 50 ? "0 0 0 4px rgba(156,138,95,0.12)" : undefined,
      }}
    >
      {!src && <i className="ti ti-user" style={{ fontSize: Math.round(size * 0.46), color: "#6b6046" }} />}
    </span>
  );
}

// Every verdict cast on one cloth, opened from the row it belongs to. The
// reader's own verdict is pinned to the top: the first thing anyone looks for
// is what they themselves said.
function Verdicts({ list, showCloth }: { list: Verdict[]; showCloth: boolean }) {
  if (!list.length) {
    return <p className="whisper" style={{ fontSize: 14, margin: "4px 2px 8px" }}>No verdicts were recorded on this bottle.</p>;
  }
  return (
    <div style={{ width: "100%", margin: "10px 0 2px", border: "1px solid var(--line)", borderRadius: 9, padding: "2px 13px 6px", background: "rgba(0,0,0,0.25)", textAlign: "left" }}>
      {list.map((v) => (
        <div key={v.memberId} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
          <Face src={v.avatar} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14, color: "var(--gold2)" }}>
              {v.name}
              {v.mine && (
                <span style={{ border: "1px solid var(--gold)", borderRadius: 3, padding: "0 5px", fontFamily: "'Cinzel', serif", fontStyle: "normal", fontSize: 8.5, letterSpacing: "0.12em", color: "var(--gold2)", marginLeft: 6, verticalAlign: 1 }}>YOU</span>
              )}
              {/* On a bound wine every soul judged each cloth, so the same
                  name appears once per glass. Without the number it reads as
                  the record repeating itself. */}
              {showCloth && <span style={{ marginLeft: 7, verticalAlign: "-4px", display: "inline-flex" }}><Cloth n={v.cloth} size={17} /></span>}
            </div>
            {v.note
              ? <div style={{ fontSize: 14, color: "var(--parch)", lineHeight: 1.5, marginTop: 1 }}>&ldquo;{v.note}&rdquo;</div>
              : <div className="whisper" style={{ fontSize: 13.5, color: "var(--faint)", marginTop: 1 }}>no words left</div>}
          </div>
          <span className="disp" style={{ fontSize: 13, color: "var(--gold2)", flex: "none" }}>{v.score.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// Once the night is sealed in the Annals, the reveal page becomes the
// Reckoning: the crowning, the rankings, the split cloth and the ledger, with
// the whole thing sendable to your own inbox. Every bottle opens to show what
// the whole table gave it and wrote about it.
function ReckoningView({ g, rows, stats, email, verdictsFor, avatarFor, canReadVerdicts, canAmend, onPatch, onBind, onUnbind, onPhotos }: {
  g: Gathering;
  rows: RevealRow[];
  stats: RevealStats;
  email: string | null;
  verdictsFor: (cloth: number[]) => Verdict[];
  avatarFor: (ownerName: string) => string | null;
  canReadVerdicts: boolean;
  // The Keiser's hand on a committed night. The annals are the record from
  // the commit onward, so every one of these writes straight back to them.
  canAmend: boolean;
  onPatch: (cloth: number, patch: Partial<RevealRow>) => void;
  onBind: (cloths: number[]) => void;
  onUnbind: (key: number) => void;
  onPhotos: (next: string[]) => void;
}) {
  const [mailState, setMailState] = useState<"idle" | "sending" | "sent">("idle");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (cloth: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(cloth)) next.add(cloth);
      return next;
    });
  const [bindMode, setBindMode] = useState(false);
  const [binding, setBinding] = useState<number[]>([]);
  // The unfolding. 0 = nothing yet, 1 = the crowning, 2.. = one standing at a
  // time, and the closing sections once every standing is in.
  const [shown, setShown] = useState(0);

  // Bound cloths are one wine with one standing; spoiled ones are recorded and
  // never placed. tally.ts holds the arithmetic, and scripts/verify-tally.ts
  // holds it to account.
  const tallyRows: TallyRow[] = rows.map((r) => ({
    cloth: r.cloth, title: r.title, owner: r.owner, score: r.score, votes: r.votes,
    dq: r.dq, spoiled: !!r.spoiled, bind: r.bind ?? null,
  }));
  const placed = placeNight(tallyRows);
  const bound = bindRows(tallyRows);
  const champions = championsIn(bound);
  // By cloth, never by identity: placeNight binds the rows a second time, so
  // its entries are different objects from the champions' and `includes`
  // silently matched nothing, which listed the crowned wine twice.
  const crownedCloths = new Set(champions.map((c) => c.cloth));
  const rest = placed.filter((x) => !crownedCloths.has(x.row.cloth));

  // Step the unfolding forward until the whole night stands. A reader who
  // has asked their device for less motion gets the page at once.
  useEffect(() => {
    const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) { setShown(rest.length + 2); return; }
    if (shown > rest.length + 1) return;
    const t = setTimeout(() => setShown((x) => x + 1), shown === 0 ? 250 : shown === 1 ? 700 : 420);
    return () => clearTimeout(t);
  }, [shown, rest.length]);

  // The wine's price and grapes live on the physical rows, not the group.
  const rowOf = (cloth: number) => rows.find((r) => r.cloth === cloth);
  // On a row the circled number trails the name. In a SENTENCE it cannot: a
  // trailing numeral reads as part of the wine ("Meerlust Rubicon 2018 1").
  // Named wines are called by their name, and only the unnamed need a number.
  const nameText = (cloths: number[], title: string) => title || `Bottle ${cloths.join(" and ")}`;
  // The emailed ranking is a list, not prose, so there the number stays.
  const listText = (cloths: number[], title: string) => `${title || "Bottle"} ${cloths.join(" and ")}`;

  // The split cloth: widest gap on any wine, three votes or more, gap >= 5.
  const cloths = new Set(rows.map((r) => r.cloth));
  let split: { cloth: number; title: string; min: number; max: number } | null = null;
  for (const cloth of cloths) {
    const t = stats.totals[cloth];
    if (!t || t.votes < 3) continue;
    const row = rows.find((r) => r.cloth === cloth);
    // A bottle that came up bad divided nobody: it was never judged on merit.
    if (row && !row.spoiled && t.max - t.min >= 5 && (!split || t.max - t.min > split.max - split.min)) {
      split = { cloth, title: row.title, min: t.min, max: t.max };
    }
  }
  const splitWine = split ? nameText([split.cloth], split.title) : null;
  const splitFinding = split ? `one soul gave it a ${split.min}, another a ${split.max}.` : null;
  // The email keeps it as one sentence; only the page breaks the line.
  const splitText = split ? `${splitWine} divided the table: ${splitFinding}` : null;

  // The ledger: best score per hundred rand, when prices were confided. A
  // spoiled bottle is no bargain and no disappointment; it is simply out.
  const priced = bound.filter((b) => !b.dq && !b.spoiled && b.votes > 0)
    .map((b) => ({ b, price: b.rows.reduce((n, r) => n + (rowOf(r.cloth)?.price || 0), 0) }))
    .filter((x) => x.price > 0);
  let value: string | null = null;
  if (priced.length >= 2) {
    const best = [...priced].sort((x, y) => y.b.score / y.price - x.b.score / x.price)[0];
    value = `Best value of the night: ${nameText(best.b.cloths, best.b.title)}, borne by ${best.b.owner || "an unclaimed hand"}, at R${best.price} · ${(best.b.score / best.price * 100).toFixed(1)} points per hundred rand.`;
  }

  const mailIt = async () => {
    if (!email || mailState === "sending") return;
    setMailState("sending");
    const res = await sendEmail("reckoning", [email], {
      numberRoman: toRoman(g.number || 0),
      theme: g.theme_title || "",
      dateLabel: g.gather_date ? new Date(g.gather_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "",
      crowned: champions.map((c) => ({ title: listText(c.cloths, c.title), owner: c.owner, score: c.score })),
      ranked: rest.map(({ row, rank }) => ({
        rank: rank != null ? toRoman(rank) : row.spoiled ? "·" : "✕",
        title: listText(row.cloths, row.title),
        owner: row.owner,
        score: rank != null ? row.score : null,
        dq: row.dq,
        spoiled: row.spoiled,
      })),
      split: splitText || undefined,
      value: value || undefined,
    });
    if (res.ok) setMailState("sent");
    else { setMailState("idle"); alert(`The reckoning would not send: ${res.error || res.skipped || "unknown"}`); }
  };

  // Gold-ruled section band, echoing the email's design (the Keiser's pick).
  const Band = ({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) => (
    <div style={{ borderTop: "1px solid var(--gold)", borderBottom: "1px solid var(--gold)", padding: "8px 6px", margin: "20px 0 14px", display: "flex", alignItems: "baseline", gap: 10, justifyContent: aside ? "space-between" : "center" }}>
      <span className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.2em" }}>{children}</span>
      {aside}
    </div>
  );

  // One line of the rankings. Spoiled and cast-out bottles keep their place in
  // the record, below the wines that stood, and hold no score.
  const Row = ({ row, rank }: { row: (typeof placed)[number]["row"]; rank: number | null }) => {
    const tone = row.dq ? "wine" : row.spoiled ? "spoiled" : "gold";
    const colour = row.dq ? "var(--wine)" : row.spoiled ? "var(--spoiled)" : "var(--parch)";
    const verdicts = verdictsFor(row.cloths);
    const openable = canReadVerdicts && verdicts.length > 0;
    const isOpen = open.has(row.cloth);
    return (
      <div style={{ borderBottom: "1px solid var(--line)", opacity: row.dq || row.spoiled ? 0.88 : 1 }}>
        <div
          onClick={() => openable && toggle(row.cloth)}
          role={openable ? "button" : undefined}
          tabIndex={openable ? 0 : undefined}
          aria-expanded={openable ? isOpen : undefined}
          onKeyDown={(e) => { if (openable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(row.cloth); } }}
          style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 2px", color: colour, cursor: openable ? "pointer" : "default" }}
        >
          <span className="disp" style={{ width: 24, flex: "none", textAlign: "center", fontSize: rank != null ? 14 : 11, color: row.dq ? "var(--wine)" : row.spoiled ? "var(--spoiled)" : "var(--gold2)" }}>
            {rank != null ? toRoman(rank) : row.dq ? "✕" : "—"}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 15 }}>
              <span style={{ textDecoration: row.dq ? "line-through" : "none" }}>{row.title || "Bottle"}</span>
              {row.cloths.map((c) => <Cloth key={c} n={c} tone={tone} />)}
              {/* The bolt used to sit alone on a line of its own, meaning
                  nothing to anyone who had not read the code. */}
              {split?.cloth === row.cloth && (
                <span className="tag" style={{ color: "var(--gold2)" }}>
                  <i className="ti ti-bolt" style={{ fontSize: 10, marginRight: 4 }} />split the table
                </span>
              )}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14.5, color: row.dq ? "#c99" : row.spoiled ? "var(--spoiled)" : "var(--gold2)" }}>
              {row.owner}
              {row.cloths.length > 1 && <span className="whisper" style={{ fontSize: 13, color: "var(--faint)" }}>· one wine, {row.cloths.length} cloths</span>}
              {row.dq && <span className="tag" style={{ color: "var(--wine)", borderColor: "#6d3a3e" }}>off theme</span>}
              {row.spoiled && <span className="tag" style={{ color: "var(--spoiled)", borderColor: "#8a6c3a" }}>spoiled</span>}
            </span>
            {row.spoiled && <span className="whisper" style={{ display: "block", fontSize: 13 }}>Kept in the record, counted against no one.</span>}
          </span>
          <span className="disp" style={{ fontSize: 14, flex: "none", color: row.dq ? "var(--wine)" : row.spoiled ? "var(--spoiled)" : "var(--gold2)" }}>
            {rank != null ? row.score.toFixed(1) : "—"}
          </span>
          <span style={{ width: 22, flex: "none", textAlign: "right", color: "var(--gold)", fontSize: 15 }}>
            {openable && <i className={`ti ti-chevron-${isOpen ? "up" : "down"}`} />}
          </span>
        </div>
        {/* The Keiser amends the record here, on the page the table is
            looking at, rather than having to go to the codex. */}
        {canAmend && !bindMode && (
          <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", padding: "0 2px 9px" }}>
            {row.rows.map((phys) => (
              <span key={phys.cloth} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                {row.cloths.length > 1 && <Cloth n={phys.cloth} size={17} />}
                <button onClick={() => onPatch(phys.cloth, { dq: !phys.dq, ...(phys.dq ? {} : { spoiled: false }) })}
                  title={phys.dq ? "Restore it to the ranking" : "Cast it out: off theme"}
                  style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: phys.dq ? "var(--gold2)" : "var(--wine)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12.5 }}>
                  <i className={`ti ti-${phys.dq ? "arrow-back-up" : "ban"}`} style={{ fontSize: 11, marginRight: 3 }} />{phys.dq ? "restore" : "disqualify"}
                </button>
                <button onClick={() => onPatch(phys.cloth, { spoiled: !phys.spoiled, ...(phys.spoiled ? {} : { dq: false }) })}
                  title={phys.spoiled ? "The bottle was sound after all" : "The bottle came up bad: recorded, never judged"}
                  style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: phys.spoiled ? "var(--gold2)" : "var(--spoiled)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12.5 }}>
                  <i className={`ti ti-${phys.spoiled ? "arrow-back-up" : "alert-triangle"}`} style={{ fontSize: 11, marginRight: 3 }} />{phys.spoiled ? "sound" : "spoiled"}
                </button>
              </span>
            ))}
            {row.cloths.length > 1 && (
              <button onClick={() => onUnbind(row.cloth)} title="Loosen this binding"
                style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12.5 }}>
                <i className="ti ti-unlink" style={{ fontSize: 11, marginRight: 3 }} />loosen
              </button>
            )}
          </div>
        )}
        {canAmend && bindMode && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px 9px", fontSize: 13.5, color: "var(--gold2)", cursor: "pointer" }}>
            <input type="checkbox" checked={row.cloths.every((c) => binding.includes(c))} style={{ width: "auto" }}
              onChange={(e) => setBinding((b) => (e.target.checked ? [...new Set([...b, ...row.cloths])] : b.filter((c) => !row.cloths.includes(c))))} />
            the same wine
          </label>
        )}
        {isOpen && <Verdicts list={verdicts} showCloth={row.cloths.length > 1} />}
      </div>
    );
  };

  return (
    <section style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
      <h1 className="disp" style={{ fontSize: 20, fontWeight: 500 }}>The Reckoning</h1>
      <p className="scr" style={{ color: "var(--gold)", fontStyle: "italic", fontSize: 15, marginTop: 2 }}>
        Gathering {toRoman(g.number || 0)} · {g.theme_title} · sealed in the Annals
      </p>

      <Band>The Crowning</Band>
      {shown >= 1 && (champions.length === 0 ? (
        <p className="whisper" style={{ margin: 0, fontSize: 15 }}>No champion this moon.</p>
      ) : champions.map((c) => {
        const champVerdicts = verdictsFor(c.cloths);
        const champOpen = open.has(c.cloth);
        const champOpenable = canReadVerdicts && champVerdicts.length > 0;
        return (
        <div key={c.cloth} style={{ textAlign: "left", margin: "0 0 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          {/* Only the victor wears a face. */}
          <Face src={c.owners.length === 1 ? avatarFor(c.owners[0]) : null} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <WineName title={c.title} cloth={null} style={{ fontFamily: "'Cinzel', serif", fontSize: 17, color: "var(--gold2)" }} />
            <span style={{ display: "inline-flex", gap: 5, marginLeft: 7 }}>{c.cloths.map((n) => <Cloth key={n} n={n} />)}</span>
            {c.owner && <div className="scr" style={{ fontStyle: "italic", fontSize: 15, color: "var(--gold2)", marginTop: 3 }}>{c.owner}</div>}
            <div className="disp" style={{ fontSize: 26, color: "var(--gold2)", marginTop: 2 }}>{c.score.toFixed(1)}</div>
            {canAmend && !bindMode && (
              <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                {c.rows.map((phys) => (
                  <span key={phys.cloth} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    {c.cloths.length > 1 && <Cloth n={phys.cloth} size={17} />}
                    <button onClick={() => onPatch(phys.cloth, { dq: true, spoiled: false })} title="Cast it out: off theme"
                      style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--wine)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12.5 }}>
                      <i className="ti ti-ban" style={{ fontSize: 11, marginRight: 3 }} />disqualify
                    </button>
                    <button onClick={() => onPatch(phys.cloth, { spoiled: true, dq: false })} title="The bottle came up bad: recorded, never judged"
                      style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--spoiled)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12.5 }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize: 11, marginRight: 3 }} />spoiled
                    </button>
                  </span>
                ))}
              </div>
            )}
            {champOpenable && (
              <button
                onClick={() => toggle(c.cloth)}
                aria-expanded={champOpen}
                style={{ width: "auto", background: "none", border: "none", padding: 0, marginTop: 5, cursor: "pointer", color: "var(--gold)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
                the table&rsquo;s verdicts <i className={`ti ti-chevron-${champOpen ? "up" : "down"}`} style={{ fontSize: 13 }} />
              </button>
            )}
          </div>
        </div>
        {champOpen && <Verdicts list={champVerdicts} showCloth={c.cloths.length > 1} />}
        </div>
        );
      }))}

      {shown >= 1 && g.prophecy && champions.length > 0 && (() => {
        const right = champions.some((c) => c.owners.includes(g.prophecy!.name));
        return (
          <p className="scr" style={{ fontStyle: "italic", fontSize: 14.5, color: right ? "var(--gold2)" : "var(--dim)", margin: "12px 0 0" }}>
            <i className="ti ti-crystal-ball" style={{ fontSize: 13, marginRight: 5 }} />
            {right
              ? `The vine foresaw it: ${g.prophecy.name} crowned, as prophesied.`
              : `The vine is humbled. It named ${g.prophecy.name}; the table crowned ${champions.map((c) => c.owner || "an unclaimed hand").join(" & ")}.`}
          </p>
        );
      })()}

      {/* The rankings carry no gold rules above and below: the hairline runs
          through the heading instead, and the instruction rides on it. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "26px 0 4px" }}>
        <span className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.2em" }}>Rankings</span>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        {canReadVerdicts && <span className="whisper" style={{ fontSize: 13 }}>tap a wine for every verdict</span>}
      </div>
      <div style={{ textAlign: "left" }}>
        {rest.slice(0, Math.max(0, shown - 1)).map(({ row, rank }) => (
          <div key={row.cloth} className="rise"><Row row={row} rank={rank} /></div>
        ))}
      </div>

      {canAmend && shown > rest.length && (
        <div className="rise" style={{ marginTop: 14, border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", textAlign: "left" }}>
          {!bindMode ? (
            <>
              <button className="btn" style={{ width: "auto", padding: "8px 16px", fontSize: 13 }} onClick={() => { setBindMode(true); setBinding([]); }}>
                <i className="ti ti-link" style={{ marginRight: 6 }} />Bind the cloths
              </button>
              <p className="whisper" style={{ fontSize: 13, margin: "8px 0 0" }}>
                Two souls brought the same wine? Bind their cloths and the table judges it once.
              </p>
            </>
          ) : (
            <>
              <p className="whisper" style={{ fontSize: 14, margin: "0 0 4px" }}>Tick every cloth that is the same wine, then seal it.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn gold" style={{ flex: 1, fontSize: 13 }} disabled={binding.length < 2}
                  onClick={() => { onBind(binding); setBinding([]); setBindMode(false); }}>
                  {binding.length < 2 ? "Tick two or more" : `Bind these ${binding.length}`}
                </button>
                <button className="btn" style={{ width: "auto", padding: "8px 16px", fontSize: 13 }} onClick={() => { setBindMode(false); setBinding([]); }}>Undo</button>
              </div>
            </>
          )}
        </div>
      )}

      {splitText && shown > rest.length && (
        <div className="rise">
          <Band>The split cloth</Band>
          <p style={{ margin: 0, fontSize: 15, color: "var(--parch)" }}>
            ⚡ {splitWine} divided the table:
            <span style={{ display: "block" }}>{splitFinding}</span>
          </p>
        </div>
      )}

      {value && shown > rest.length && (
        <div className="rise">
          <Band>The ledger</Band>
          <p style={{ margin: 0, fontSize: 15, color: "var(--parch)" }}>{value}</p>
        </div>
      )}

      {shown > rest.length && (
      <div className="rise">
      <div className="moons" style={{ justifyContent: "center", margin: "26px 0 4px" }} aria-hidden="true">
        <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle-dashed" />
      </div>

      <BottleReveal
        photos={g.reveal_photos || []}
        gatheringId={g.id}
        onPhotos={onPhotos}
      />

      <button className="btn" style={{ fontSize: 14, marginTop: 10 }}
        onClick={() => { if (!email) { alert("The demo has no post office: sign in on the live Council and the reckoning will fly."); return; } mailIt(); }}
        disabled={mailState === "sending"}>
        <i className="ti ti-mail" style={{ marginRight: 6 }} />
        {mailState === "sent" ? "It flies to your inbox" : mailState === "sending" ? "Sending…" : "Email this to me"}
      </button>
      <p className="whisper" style={{ margin: "14px 0 0", fontSize: 12 }}>the vine calculates, it does not flatter</p>
      </div>
      )}
    </section>
  );
}

export default function Reveal() {
  const { mode, role, member, email, sleeping } = useAuth();
  const router = useRouter();
  const isKeiser = role === "keiser";
  const meId = mode === "live" ? member?.id ?? null : role === "keiser" ? "m-keiser" : role === "member" ? "m-larissa" : null;
  const myName = mode === "live" ? member?.cult_name || "" : seedMembers.find((m) => m.id === meId)?.cult_name || "";

  const [g, setG] = useState<Gathering | null>(null);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<RevealStats>({ sealedIds: [], totals: {}, notes: [] });
  const [offerings, setOfferings] = useState<Record<string, Offering>>({});
  const [rows, setRows] = useState<RevealRow[]>([]);
  const [committed, setCommitted] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [shown, setShown] = useState(0);
  // Binding the cloths: the Keiser ticks the ones that are the same wine, and
  // they become a single entry with one score and one standing.
  const [bindMode, setBindMode] = useState(false);
  const [binding, setBinding] = useState<number[]>([]);

  useEffect(() => {
    fetchRevealGathering().then((cg) => {
      setG(cg);
      setReady(true);
    });
  }, []);
  const gid = g?.id ?? "none";
  const attendees = g?.attendees || [];
  // Sleeping souls are never waited on. A member deactivated AFTER RSVPing can
  // no longer seal a ballot (the write lock stops them), so counting them here
  // would hang the reveal forever and cost the Council the whole night.
  // Ballots they sealed while awake still stand in the tallies; only the
  // waiting excludes them.
  // null means "the roll is unknown" (demo mode, or the read failed): then we
  // wait on every attendee exactly as before, rather than unlocking a night on
  // a guess. A soul CAST OUT of the roster is excluded too: their id lingers
  // in attendees and, being no member at all, they can never seal either.
  const [awakeIds, setAwakeIds] = useState<Set<string> | null>(null);
  // The same read carries the cult names, so the locked panel can NAME the
  // souls still being waited on rather than only counting them.
  const [rosterNames, setRosterNames] = useState<Record<string, string>>({});
  // And the faces, for the one soul who wears theirs on this page: the victor.
  const [rosterFaces, setRosterFaces] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (mode !== "live" || !supabase) return;
    let alive = true;
    const read = () => supabase!.from("members").select("id,active,cult_name,avatar_url")
      .then(({ data, error }: { data: { id: string; active: boolean | null; cult_name: string | null; avatar_url: string | null }[] | null; error: { message: string } | null }) => {
        if (!alive) return;
        // The error was swallowed here once, which quietly restored the very
        // deadlock this exists to prevent. Retry, and say so if it persists.
        if (error || !data) { console.error("The roll would not open:", error?.message); return; }
        setAwakeIds(new Set(data.filter((m) => m.active !== false).map((m) => m.id)));
        setRosterNames(Object.fromEntries(data.map((m) => [m.id, m.cult_name || ""])));
        setRosterFaces(Object.fromEntries(data.map((m) => [m.id, m.avatar_url])));
      });
    read();
    const t = setInterval(() => { if (!awakeIds) read(); }, 15000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  // Demo mode has no roll to read: the local roster supplies the names.
  useEffect(() => {
    if (mode === "live") return;
    setRosterNames(Object.fromEntries(loadMembers().map((m) => [m.id, m.cult_name || ""])));
    setRosterFaces(Object.fromEntries(loadMembers().map((m) => [m.id, m.avatar_url || null])));
  }, [mode]);
  const awaited = awakeIds ? attendees.filter((id) => awakeIds.has(id)) : attendees;
  const sleepingAmong = attendees.length - awaited.length;

  // A week after the night ends, the reveal is gone entirely (#7): direct
  // links are turned away. The vote data itself stays in the database — the
  // codex and every tally still read it; only this page's presentation goes.
  const windowClosed = revealWindowClosed(g);
  useEffect(() => {
    if (ready && windowClosed) router.replace("/convene");
  }, [ready, windowClosed, router]);

  const [wineCount] = useWineCount(g);

  // The verdicts behind each bottle, for the panel that opens on a tap.
  // Initiates may not read individual ballots (#6), so for them the rows do
  // not open at all rather than opening on nothing.
  const canReadVerdicts = role !== "initiate";
  const [ballots, setBallots] = useState<{ memberId: string; scores: Record<number, number>; notes?: Record<number, string> }[]>([]);
  useEffect(() => {
    if (!g || !committed || !canReadVerdicts) return;
    let alive = true;
    fetchAllBallots(g.id)
      .then((bs) => { if (alive) setBallots(bs); })
      .catch((e) => console.error("The verdicts would not open:", (e as Error).message));
    return () => { alive = false; };
  }, [g, committed, canReadVerdicts]);

  // Every verdict cast on a wine, highest first, with the reader's own pinned
  // to the top. A bound wine gathers the verdicts of all its cloths; a soul
  // who judged two cloths of the same wine is listed once per cloth, since
  // they really did judge two glasses.
  const verdictsFor = (cloths: number[]): Verdict[] => {
    if (!canReadVerdicts) return [];
    const out: Verdict[] = [];
    for (const b of ballots) {
      for (const cloth of cloths) {
        const score = b.scores?.[cloth];
        if (typeof score !== "number" || score <= 0) continue;
        out.push({
          memberId: `${b.memberId}-${cloth}`,
          name: rosterNames[b.memberId] || "A soul yet unnamed",
          avatar: rosterFaces[b.memberId] ?? null,
          score,
          note: (b.notes || {})[cloth] || "",
          mine: b.memberId === meId,
          cloth,
        });
      }
    }
    return out.sort((x, y) =>
      Number(y.mine) - Number(x.mine) ||
      (cloths.length > 1 ? x.name.localeCompare(y.name) || x.cloth - y.cloth : 0) ||
      y.score - x.score || x.name.localeCompare(y.name));
  };
  const avatarFor = (ownerName: string): string | null => {
    const id = Object.keys(rosterNames).find((k) => rosterNames[k] === ownerName);
    return id ? rosterFaces[id] ?? null : null;
  };

  // Initiates may not read individual ballots (#6): they load the aggregate
  // summary; full members derive the same stats from the ballots themselves.
  const loadStats = async (gatheringId: string): Promise<RevealStats> =>
    mode === "live" && role === "initiate"
      ? fetchRevealStats(gatheringId)
      : statsFromBallots(await fetchAllBallots(gatheringId));

  // Load the reveal stats + offerings, and any committed annal, for this gathering.
  useEffect(() => {
    if (!g) return;
    let active = true;
    (async () => {
      const [st, offs, annal] = await Promise.all([
        loadStats(g.id),
        // A failed first read is not "no claims": leave it empty and let the
        // poll below bring the claims in. Only the commit must refuse.
        fetchAllOfferings(g.id).catch(() => ({} as Record<string, Offering>)),
        fetchAnnal(g.id),
      ]);
      if (!active) return;
      setStats(st);
      setOfferings(offs);
      if (annal) {
        setRows(annal.rows.map((r, i) => ({ cloth: r.cloth ?? i + 1, title: r.title, owner: r.owner, score: r.score, votes: r.votes, dq: r.dq, spoiled: !!r.spoiled, bind: r.bind ?? null, rawScore: r.raw_score ?? r.score, rawVotes: r.raw_votes ?? r.votes, varietals: r.varietals, price: r.price })));
        setCommitted(true);
      } else {
        setRows(Array.from({ length: wineCount }, (_, i) => i + 1).map((cloth) => ({
          cloth, title: "", owner: "",
          score: st.totals[cloth]?.avg || 0, votes: st.totals[cloth]?.votes || 0, dq: false, spoiled: false, bind: null,
        })));
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, wineCount, mode, role]);

  // The reveal opens only when the rite itself is open AND every attendee has
  // sealed — or once committed. Before the rite there is nothing to reveal.
  const riteOpen = useRiteOpen(g);
  const sealedCount = stats.sealedIds.filter((id) => awaited.includes(id)).length;
  const locked = !committed && (!riteOpen || awaited.length === 0 || sealedCount < awaited.length);
  // Who, not just how many: the souls whose ballots the night is still waiting
  // on. A soul whose name has not loaded yet is still listed, unnamed, so the
  // count and the list can never disagree.
  const awaiting = awaited
    .filter((id) => !stats.sealedIds.includes(id))
    .map((id) => (id === meId ? `${rosterNames[id] || myName || "You"} (you)` : rosterNames[id] || "A soul yet unnamed"))
    .sort((a, b) => a.localeCompare(b));

  // While still sealed, poll for newly-sealed ballots so the reveal unlocks and
  // tallies live — no refresh needed. The tally poll stops the moment it opens
  // (so it never clobbers the Keiser's disqualifications, which only happen
  // after), but the OFFERINGS keep being read until the night is committed:
  // every claim lands on the claimant's own offering row, and the whole table,
  // the Keiser above all, must see each name arrive without a refresh.
  // Every read of the offerings goes through here, numbered: a slow poll that
  // set out BEFORE a tap and lands AFTER it must not paint the pre-tap claims
  // over the fresh ones (which, for the five seconds until the next poll,
  // looked exactly like "my claim did not take" and offered every bottle
  // again). Only the latest read issued may land. A failed read leaves the
  // last good claims on screen.
  const offSeq = useRef(0);
  const refreshOfferings = async (gatheringId: string) => {
    const n = ++offSeq.current;
    try {
      const offs = await fetchAllOfferings(gatheringId);
      if (n === offSeq.current) setOfferings(offs);
    } catch (e) {
      console.error((e as Error).message);
    }
  };
  useEffect(() => {
    if (!g || committed) return;
    const iv = setInterval(async () => {
      if (locked) {
        const st = await loadStats(g.id);
        setStats(st);
        setRows(Array.from({ length: wineCount }, (_, i) => i + 1).map((cloth) => ({
          cloth, title: "", owner: "", score: st.totals[cloth]?.avg || 0, votes: st.totals[cloth]?.votes || 0, dq: false, spoiled: false, bind: null,
        })));
      }
      // A member's page that was open when the Keiser committed must learn
      // of it, or its claim buttons stay live and a late tap lands on an
      // offering the record no longer reads: accepted on screen, lost in
      // the annals. Once the night is in the annals, the annals are drawn.
      const annal = await fetchAnnal(g.id);
      if (annal) {
        setRows(annal.rows.map((r, i) => ({ cloth: r.cloth ?? i + 1, title: r.title, owner: r.owner, score: r.score, votes: r.votes, dq: r.dq, spoiled: !!r.spoiled, bind: r.bind ?? null, rawScore: r.raw_score ?? r.score, rawVotes: r.raw_votes ?? r.votes, varietals: r.varietals, price: r.price })));
        setCommitted(true);
        return;
      }
      await refreshOfferings(g.id);
    }, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, committed, locked, wineCount, mode, role]);

  // The rows as the table sees them. Before the commit, the claims are laid
  // over the tallies here (owner, and the wine the owner logged); after it,
  // the annals are the record and carry their own owners.
  const view = committed ? rows : applyClaims(rows, offerings, rosterNames);

  // Ranking is computed, never stored. Ties share a rank (competition style:
  // two 2nds, then a 4th), a tie for the top score crowns co-champions, bound
  // cloths are one wine with one standing, and a spoiled bottle takes none.
  // The arithmetic lives in src/lib/tally.ts, proved by scripts/verify-tally.ts.
  const asTally = (r: RevealRow): TallyRow => ({
    // RAW, never the shared figure: feeding a group's mean back through the
    // binding would re-average an average on every amendment.
    cloth: r.cloth, title: r.title, owner: r.owner,
    score: r.rawScore ?? r.score, votes: r.rawVotes ?? r.votes,
    dq: r.dq, spoiled: !!r.spoiled, bind: r.bind ?? null,
  });
  const boundView = bindRows(view.map(asTally));
  // The Keiser's cards are still the physical cloths, one per bottle carried,
  // so each row is placed by the standing of the group it belongs to.
  const groupOf = (row: RevealRow) => boundView.find((b) => b.cloths.includes(row.cloth));
  const rankOf = (row: RevealRow) => { const g2 = groupOf(row); return g2 ? rankIn(boundView, g2) ?? 0 : 0; };
  const championGroups = championsIn(boundView);
  const champions = view.filter((r) => championGroups.some((b) => b.cloths.includes(r.cloth)));
  const dqRows = view.filter((r) => r.dq || r.spoiled);
  const qualified = [...view].filter((r) => !r.dq && !r.spoiled).sort((a, b) => b.score - a.score || a.cloth - b.cloth);
  const rest = [...qualified.filter((r) => !champions.includes(r)), ...dqRows];
  const canAct = !committed || isKeiser; // once in the Annals, only the Keiser may touch it

  useEffect(() => {
    if (!flipped || shown >= rest.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 900 : 850);
    return () => clearTimeout(t);
  }, [flipped, shown, rest.length]);

  // Keiser amendments after committing flow straight back into the Annals.
  const persist = (next: RevealRow[]) => {
    setRows(next);
    if (committed && isKeiser) writeAnnal(next).catch((e) => alert(`Could not amend the Annals: ${e.message}`));
  };

  const writeAnnal = async (data: RevealRow[]) => {
    // The record stays one line per bottle actually carried, because chalices
    // and victories are counted per soul. Bound cloths each take the group's
    // score and standing, which is exactly what makes their bearers
    // co-champions; a spoiled cloth takes neither.
    const placed = annalScores(data.map(asTally));
    await commitAnnal({
      gatheringId: g!.id,
      number: g!.number,
      theme: g!.theme_title,
      date: g!.gather_date,
      committed_at: new Date().toISOString(),
      rows: data.map((r): AnnalRow => {
        const p = placed.get(r.cloth);
        return {
          cloth: r.cloth, owner: r.owner, title: r.title,
          score: p?.score ?? r.score, votes: p?.votes ?? r.votes,
          raw_score: p?.rawScore ?? r.rawScore ?? r.score,
          raw_votes: p?.rawVotes ?? r.rawVotes ?? r.votes,
          dq: r.dq, rank: r.dq ? null : p?.rank ?? null,
          spoiled: r.spoiled ? true : undefined,
          bind: r.bind ?? undefined,
          varietals: r.varietals?.length ? r.varietals : undefined,
          price: r.price ?? undefined,
        };
      }),
    });
  };

  const commit = async () => {
    if (!isKeiser) return;
    try {
      // Read the claims AND the roll once more, right now: a name that landed
      // between the last poll and this tap must not be missed on the one
      // write that counts, and a claimant whose name never loaded must stop
      // the commit rather than enter the record as "A soul yet unnamed".
      // fetchAllOfferings THROWS on a failed read (it once returned {}, which
      // would have committed every bottle as unclaimed); the catch below then
      // reports it and nothing is written.
      const fresh = await fetchAllOfferings(g!.id);
      offSeq.current++;
      setOfferings(fresh);
      let names = rosterNames;
      if (mode === "live" && supabase) {
        const { data, error } = await supabase.from("members").select("id,cult_name");
        if (error || !data) throw new Error(`The roll would not open: ${error?.message || "no answer"}. Nothing was written; try again.`);
        names = Object.fromEntries(data.map((m: { id: string; cult_name: string | null }) => [m.id, m.cult_name || ""]));
        setRosterNames(names);
      }
      const unnamed = unnamedClaimants(fresh, names);
      if (unnamed.length) throw new Error(`${unnamed.length} claim${unnamed.length > 1 ? "s" : ""} could not be matched to a name on the roll. Nothing was written; try again.`);
      const applied = applyClaims(rows, fresh, names);
      await writeAnnal(applied);
      // The Reckoning drawn right after the commit reads `rows`: hand it the
      // rows as written, names and all, not the bare tallies.
      setRows(applied);
      setCommitted(true);
    } catch (e) {
      alert(`Could not commit to the Annals: ${(e as Error).message}`);
    }
  };

  const patch = (cloth: number, p: Partial<RevealRow>) =>
    persist(rows.map((r) => (r.cloth === cloth ? { ...r, ...p } : r)));

  // Bind the ticked cloths into one wine. The key is the lowest cloth in the
  // set, so the binding is stable however it is read back, and any cloth
  // already bound to one of them is drawn in too rather than left orphaned.
  const bindTicked = () => bindCloths(binding);
  const bindCloths = (chosen: number[]) => {
    if (chosen.length < 2) return;
    const existing = new Set(chosen);
    for (const r of rows) if (r.bind != null && existing.has(r.bind)) existing.add(r.cloth);
    const all = [...existing].sort((a, b) => a - b);
    const key = all[0];
    persist(rows.map((r) => (all.includes(r.cloth) ? { ...r, bind: key } : r)));
    setBinding([]);
    setBindMode(false);
  };
  // Loosen a binding: every cloth in that group stands alone again.
  const unbind = (key: number) =>
    persist(rows.map((r) => ((r.bind ?? r.cloth) === key ? { ...r, bind: null } : r)));

  // A claim is a number on your own offering row, written to the vault the
  // moment you tap, and read back by every soul at the table. It was once a
  // change to this page's local state alone, which no other browser ever
  // saw: every hand but the Keiser's came up unclaimed at the commit, on two
  // gatherings running. These only run before the commit: once the night is
  // in the annals this page draws the Reckoning, and amendments, the Keiser's
  // by hand and a member's late claim through claim_bottle, live in the codex.
  const myClaim = claimedCloth(offerings, meId) != null;
  const reread = () => { if (g) return refreshOfferings(g.id); };
  const claim = (cloth: number) => {
    if (!meId || myClaim || committed) return;
    claimCloth(g!.id, meId, cloth).then(reread).catch((e) => { reread(); alert(`The claim would not hold: ${(e as Error).message}`); });
  };
  const release = (cloth: number) => {
    if (!meId || committed) return;
    if (claimedCloth(offerings, meId) !== cloth) return;
    claimCloth(g!.id, meId, null).then(reread).catch((e) => alert(`The release would not hold: ${(e as Error).message}`));
  };

  if (!ready) return <section />;

  if (windowClosed) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-eye-off" style={{ fontSize: 30, color: "var(--gold)" }} aria-hidden="true" />
        <p className="whisper" style={{ fontSize: 16, marginTop: 12 }}>
          The reveal has passed beyond the veil. The codex remembers what the table decided.
        </p>
      </section>
    );
  }

  if (!g) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-eye-off" style={{ fontSize: 30, color: "var(--gold)" }} aria-hidden="true" />
        <p className="whisper" style={{ fontSize: 16, marginTop: 12 }}>
          No gathering is scheduled. There is nothing to reveal.
        </p>
      </section>
    );
  }

  if (committed && g) {
    return (
      <ReckoningView g={g} rows={rows} stats={stats} email={mode === "live" ? email : null}
        verdictsFor={verdictsFor} avatarFor={avatarFor} canReadVerdicts={canReadVerdicts}
        canAmend={isKeiser && !sleeping}
        onPatch={patch} onBind={bindCloths} onUnbind={unbind}
        onPhotos={(next) => { updateGathering(g.id, { reveal_photos: next }).then(() => setG({ ...g, reveal_photos: next })).catch((e) => alert(`Could not save the photos: ${e.message}`)); }} />
    );
  }

  if (locked) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-lock" style={{ fontSize: 34, color: "var(--gold)" }} aria-hidden="true" />
        <h1 className="disp" style={{ fontSize: 18, fontWeight: 500, marginTop: 12 }}>The reckoning stays sealed</h1>
        <p className="whisper" style={{ fontSize: 16, maxWidth: 380, margin: "10px auto 0" }}>
          {!riteOpen
            ? "The rite has not yet begun. The cloths stay on until every soul has judged."
            : awaited.length === 0 && sleepingAmong > 0
            ? "Every soul who answered this call has since been sleeping. The night cannot be judged; the Keiser may record it by hand in the codex."
            : awaited.length === 0
            ? "No souls have answered the call. RSVP on the convening, then judge in the rite."
            : `${sealedCount} of ${awaited.length} ballots have been sealed. The cloths are not lifted until every soul has judged.`}
        </p>
        {riteOpen && awaited.length > 0 && awaiting.length > 0 && (
          <div style={{ maxWidth: 380, margin: "18px auto 0" }}>
            <p className="whisper" style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", margin: "0 0 8px" }}>
              Still to judge
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {awaiting.map((name, i) => (
                <li key={`${name}-${i}`} style={{
                  fontSize: 13, color: "var(--gold2)", border: "1px solid var(--line)",
                  borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap",
                }}>
                  <i className="ti ti-hourglass" style={{ fontSize: 11, marginRight: 6, color: "var(--faint)" }} aria-hidden="true" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  if (champions.length === 0 && dqRows.length === 0) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <p className="whisper" style={{ fontSize: 16 }}>No verdicts have been cast. The rite must come first.</p>
      </section>
    );
  }

  const fmtScore = (r: RevealRow) => (r.votes > 0 ? r.score.toFixed(1) : "—");

  const renderRow = (w: RevealRow, rankIdx: number | null) => {
    const isDq = w.dq;
    const isSpoiled = !!w.spoiled;
    const color = isDq ? "var(--wine)" : isSpoiled ? "var(--spoiled)" : "var(--gold2)";
    const tone = isDq ? "wine" : isSpoiled ? "spoiled" : "gold";
    const group = groupOf(w);
    const twinned = (group?.cloths.length || 1) > 1;
    return (
      <div key={w.cloth} className="rk rise" style={{ opacity: isDq || isSpoiled ? 0.88 : 1 }}>
        <span className="disp" style={{ width: 26, fontSize: isDq || isSpoiled ? 11 : 14, color }}>
          {isDq ? "✕" : isSpoiled ? "—" : toRoman(rankIdx || 0)}
        </span>
        <div style={{ flex: 1 }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, verticalAlign: "-4px" }}>
              <span style={{ textDecoration: isDq ? "line-through" : "none" }}>Bottle</span>
              <Cloth n={w.cloth} tone={tone} />
            </span> ·{" "}
            <OwnerSlot owner={w.owner} mine={w.owner === myName && !!myName} canClaim={!!meId && !myClaim && !sleeping} canAct={canAct}
              onClaim={() => claim(w.cloth)} onRelease={() => release(w.cloth)}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: "var(--gold2)" }} />
            {isDq && <span className="tag" style={{ marginLeft: 8, color: "var(--wine)", borderColor: "var(--wine)" }}>off theme · disqualified</span>}
            {isSpoiled && <span className="tag" style={{ marginLeft: 8, color: "var(--spoiled)", borderColor: "#8a6c3a" }}>spoiled</span>}
            {twinned && (
              <span className="tag" style={{ marginLeft: 8, color: "var(--gold2)" }}>
                bound to {group!.cloths.filter((c) => c !== w.cloth).join(" and ")}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: "var(--parch)", marginTop: 2 }}>
            <Inline value={w.title} placeholder="name the wine…" canEdit={canAct} onChange={(v) => patch(w.cloth, { title: v })} />
          </div>
          {bindMode && isKeiser && canAct && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 13, color: "var(--gold2)", cursor: "pointer" }}>
              <input type="checkbox" checked={binding.includes(w.cloth)} style={{ width: "auto" }}
                onChange={(e) => setBinding((b) => (e.target.checked ? [...b, w.cloth] : b.filter((c) => c !== w.cloth)))} />
              the same wine
            </label>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="disp" style={{ color }}>{isSpoiled ? "—" : fmtScore(w)}</span>
          {isKeiser && canAct && !bindMode && (
            <>
              <button onClick={() => patch(w.cloth, { dq: !w.dq, ...(w.dq ? {} : { spoiled: false }) })} title={isDq ? "Restore to the ranking" : "Disqualify · off theme"} aria-label={isDq ? "Restore this wine" : "Disqualify this wine"}
                style={{ display: "block", width: "auto", background: "none", border: "none", cursor: "pointer", color: isDq ? "var(--gold2)" : "var(--wine)", padding: 0, marginTop: 2, marginLeft: "auto", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12 }}>
                <i className={`ti ti-${isDq ? "arrow-back-up" : "ban"}`} style={{ fontSize: 11, marginRight: 3 }} />{isDq ? "restore" : "disqualify"}
              </button>
              {/* Spoiled is its own mark, never a disqualification: casting out
                  counts against a soul and five of them summon them to the
                  tribunal, and a bottle coming up bad is nobody's fault. */}
              <button onClick={() => patch(w.cloth, { spoiled: !w.spoiled, ...(w.spoiled ? {} : { dq: false }) })} title={isSpoiled ? "The bottle was sound after all" : "The bottle came up bad: recorded, never judged"} aria-label={isSpoiled ? "Mark this bottle sound" : "Mark this bottle spoiled"}
                style={{ display: "block", width: "auto", background: "none", border: "none", cursor: "pointer", color: isSpoiled ? "var(--gold2)" : "var(--spoiled)", padding: 0, marginTop: 1, marginLeft: "auto", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12 }}>
                <i className={`ti ti-${isSpoiled ? "arrow-back-up" : "alert-triangle"}`} style={{ fontSize: 11, marginRight: 3 }} />{isSpoiled ? "sound" : "spoiled"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The revelation</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>
        Gathering {toRoman(g?.number || 0)} ·{" "}
        {committed ? "sealed in the Annals" : "every ballot sealed · the cloths may lift"}
      </p>

      <div className={`flip${flipped ? " on" : ""}`} style={{ height: champions.length > 1 ? 340 : 300, margin: "14px 0" }}>
        <div className="flip-inner">
          <button
            className="flip-face"
            onClick={() => setFlipped(true)}
            aria-label="Turn the card and reveal the champion"
            style={{ width: "100%", background: "#000 url(/reveal-back.webp) center / contain no-repeat", border: "none", cursor: "pointer" }}
          />

          <div className="flip-face flip-front" style={{ background: "var(--ink2)", border: "1px solid var(--line2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16, overflowY: "auto" }}>
            <span className="tag">{champions.length > 1 ? `Champions · tied` : "Champion"}</span>
            {champions.length === 0 ? (
              <div className="whisper" style={{ marginTop: 10, fontSize: 15 }}>No champion this moon.</div>
            ) : champions.map((champ, idx) => (
              <div key={champ.cloth} style={{ marginTop: idx === 0 ? 8 : 10, ...(idx > 0 ? { borderTop: "1px solid var(--line)", paddingTop: 10, width: "100%" } : {}) }}>
                <div className="disp" style={{ fontSize: champions.length > 1 ? 17 : 19, margin: "0 0 2px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  Bottle <Cloth n={champ.cloth} size={champions.length > 1 ? 22 : 25} />
                </div>
                <div style={{ color: "var(--parch)", fontSize: 14 }}>
                  <OwnerSlot owner={champ.owner} mine={champ.owner === myName && !!myName} canClaim={!!meId && !myClaim && !sleeping} canAct={canAct}
                    onClaim={() => claim(champ.cloth)} onRelease={() => release(champ.cloth)}
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 16, color: "var(--gold2)" }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 14 }}>
                  <Inline value={champ.title} placeholder="name the wine…" canEdit={canAct} onChange={(v) => patch(champ.cloth, { title: v })} />
                </div>
                <div className="disp" style={{ fontSize: champions.length > 1 ? 22 : 26, marginTop: 4 }}>{fmtScore(champ)}</div>
                {isKeiser && canAct && (
                  <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
                    <button onClick={() => patch(champ.cloth, { dq: true, spoiled: false })} title="Disqualify · off theme" aria-label="Disqualify this wine"
                      style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--wine)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12 }}>
                      <i className="ti ti-ban" style={{ fontSize: 11, marginRight: 3 }} />disqualify
                    </button>
                    <button onClick={() => patch(champ.cloth, { spoiled: true, dq: false })} title="The bottle came up bad: recorded, never judged" aria-label="Mark this bottle spoiled"
                      style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--spoiled)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12 }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize: 11, marginRight: 3 }} />spoiled
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {flipped && rest.slice(0, shown).map((w) => renderRow(w, w.dq || w.spoiled ? null : rankOf(w)))}

      {/* THE KEISER'S HAND: binding the cloths that are one and the same wine.
          Each poured into a cloth of its own, so the table scored one wine
          twice and it took two places; bound, they become a single entry with
          the mean of every verdict and one standing. */}
      {flipped && isKeiser && canAct && shown >= rest.length && (
        <div style={{ marginTop: 18, border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}>
          {!bindMode ? (
            <>
              <button className="btn" style={{ width: "auto", padding: "8px 16px", fontSize: 13 }} onClick={() => { setBindMode(true); setBinding([]); }}>
                <i className="ti ti-link" style={{ marginRight: 6 }} />Bind the cloths
              </button>
              <p className="whisper" style={{ fontSize: 13, margin: "8px 0 0" }}>
                Two souls brought the same wine? Bind their cloths and the table judges it once.
              </p>
              {boundView.filter((b) => b.cloths.length > 1).map((b) => (
                <div key={b.cloth} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14 }}>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    {b.title || "One wine"} <span className="whisper" style={{ fontSize: 13 }}>· cloths {b.cloths.join(", ")}</span>
                  </span>
                  <button onClick={() => unbind(b.cloth)} aria-label="Loosen this binding"
                    style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13 }}>
                    <i className="ti ti-unlink" style={{ fontSize: 11, marginRight: 3 }} />loosen
                  </button>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="whisper" style={{ fontSize: 14, margin: "0 0 4px" }}>
                Tick every cloth that is the same wine, then seal it.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn gold" style={{ flex: 1, fontSize: 13 }} disabled={binding.length < 2} onClick={bindTicked}>
                  {binding.length < 2 ? "Tick two or more" : `Bind these ${binding.length}`}
                </button>
                <button className="btn" style={{ width: "auto", padding: "8px 16px", fontSize: 13 }} onClick={() => { setBindMode(false); setBinding([]); }}>
                  Undo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {flipped && shown >= rest.length && (
        <>
          <div style={{ marginTop: 20 }}>
            {committed ? (
              <p className="whisper" style={{ fontSize: 15, textAlign: "center", margin: 0 }}>
                <i className="ti ti-book" style={{ marginRight: 6 }} />
                Committed to the Annals{isKeiser ? ": only your hand may amend it." : ": only the Keiser may amend it."}
              </p>
            ) : (
              <>
                <button className="btn gold" style={{ fontSize: 14 }} onClick={commit} disabled={!isKeiser}>
                  <i className="ti ti-book" style={{ marginRight: 6 }} /> Commit it to the Annals
                </button>
                {!isKeiser && (
                  <p className="whisper" style={{ fontSize: 13, textAlign: "center", margin: "6px 0 0" }}>
                    The Keiser alone may seal the record.
                  </p>
                )}
              </>
            )}
          </div>
          <BottleReveal
            photos={g?.reveal_photos || []}
            gatheringId={g?.id}
            onPhotos={(next) => { if (g) updateGathering(g.id, { reveal_photos: next }).catch((e) => alert(`Could not save the photos: ${e.message}`)); }}
          />
        </>
      )}
    </section>
  );
}
