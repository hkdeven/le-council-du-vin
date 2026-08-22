"use client";

import { useState, useEffect, useRef } from "react";
import { toRoman } from "@/lib/util";
import { fetchAnnals, fetchDqCounts, commitAnnal, deleteAnnal, DQ_THRESHOLD, AnnalEntry, type AnnalRow, championsOf, victoriesFrom, claimBottle } from "@/lib/annals";
import { validateMeetingDraft, reckonRows, type DraftRowInput } from "@/lib/meeting-entry";
import { fetchBallotHistory, type HistoryBallot } from "@/lib/ballots";
import { fetchGatherings, createGathering, updateGathering, deleteGathering, gatheringsLive } from "@/lib/gatherings";
import { prophecyRecord } from "@/lib/prophecy";
import { fetchAllOfferings } from "@/lib/bottles";
import { loadMembers } from "@/lib/members";
import { uploadRevealPhoto, attachRevealPhoto, removeRevealPhoto } from "@/lib/photos";
import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/sendEmail";
import { useAuth } from "@/components/AuthProvider";
import Avatar from "@/components/Avatar";
import Loading from "@/components/Loading";
import Tip from "@/components/Tip";
import GrapePicker from "@/components/GrapePicker";
import { detectVarietals, GRAPES } from "@/lib/varietals";
import { swr, writeSwr } from "@/lib/swr";
import type { Gathering, Member } from "@/lib/types";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// Roster rows as the codex needs them: names for the records, portraits for
// the per-member score breakdowns.
type RosterLite = Pick<Member, "id" | "cult_name"> & Partial<Pick<Member, "short_name" | "avatar_url">>;

// The inline caret (tickets #5/#6): sits ON the existing line — never its own
// row — and rotates to show state. One pattern for the grapes line and the
// per-bottle breakdowns.
function Caret({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--gold)", padding: "2px 4px", display: "inline-flex", alignItems: "center", flex: "none" }}
    >
      <i className="ti ti-chevron-down" style={{ fontSize: 14, display: "inline-block", transform: open ? "rotate(-180deg)" : "none", transition: "transform 0.25s ease" }} />
    </button>
  );
}

// Ten pips, one per point: a member's verdict at a glance.
function ScorePips({ score }: { score: number }) {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", gap: 2, flex: "none" }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} style={{ width: 4, height: 4, borderRadius: 2, background: i < Math.round(score) ? "var(--gold2)" : "rgba(160,150,120,0.22)" }} />
      ))}
    </span>
  );
}

// A gathering under the Keiser's pen: everything editable, ranks recomputed
// from the scores on save (ties share rank 1, DQs unranked) exactly as the
// reveal would have judged it. The row shape lives in meeting-entry.ts so
// the verify suite exercises the same validation and reckoning this page runs.
type DraftRow = DraftRowInput;
interface Draft {
  gatheringId?: string;
  number: number;
  theme: string;
  date: string;
  host_id: string | null;
  host_name: string;
  host2_id: string | null;
  host2_name: string;
  rows: DraftRow[];
}

function draftFrom(a: AnnalEntry, g?: Gathering): Draft {
  return {
    gatheringId: a.gatheringId,
    number: a.number,
    theme: a.theme,
    date: a.date,
    host_id: g?.host_id || null,
    host_name: g?.host_name || "",
    host2_id: g?.host2_id || null,
    host2_name: g?.host2_name || "",
    rows: a.rows.map((r) => ({ cloth: r.cloth != null ? String(r.cloth) : "", title: r.title || "", owner: r.owner || "", score: r.votes > 0 || r.score > 0 ? String(r.score) : "", dq: r.dq, votes: r.votes, varietals: r.varietals || [], price: r.price != null ? String(r.price) : "" })),
  };
}

function GatheringEditor({ draft: initial, members, offerings, onCancel, onSave, onErase }: {
  draft: Draft;
  members: Pick<Member, "id" | "cult_name">[];
  // What each soul logged before the night: their wine, its price, its grapes.
  offerings: Record<string, { title: string; price: number | null; varietals: string[] }>;
  onCancel: () => void;
  onSave: (d: Draft) => Promise<void>;
  onErase?: () => Promise<void>;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setRow = (i: number, patch: Partial<DraftRow>) =>
    setD((x) => ({ ...x, rows: x.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addRow = () =>
    setD((x) => ({ ...x, rows: [...x.rows, { cloth: "", title: "", owner: "", score: "", dq: false, votes: 1, varietals: [], price: "" }] }));
  const dropRow = (i: number) => setD((x) => ({ ...x, rows: x.rows.filter((_, j) => j !== i) }));

  // Hosts from imported history may be a bare name with no member id; keep
  // that name selectable so sealing does not silently unhost the night.
  const hostSelect = (id: string | null, name: string, onPick: (id: string | null, name: string) => void, none: string) => {
    const nameOnly = !id && !!name;
    return (
      <select value={id || (nameOnly ? "__name" : "")} onChange={(e) => {
        const v = e.target.value;
        if (v === "__name") { onPick(null, name); return; }
        const m = members.find((x) => x.id === v);
        onPick(m?.id || null, m?.cult_name || "");
      }} style={{ colorScheme: "dark" }}>
        <option value="">{none}</option>
        {nameOnly && <option value="__name">{name}</option>}
        {members.map((m) => <option key={m.id} value={m.id}>{m.cult_name}</option>)}
      </select>
    );
  };

  // Who brought a wine: a dropdown of the roster, not free text. Imported
  // history may credit souls no longer on the roster (departed members,
  // guests) — their names stay selectable, and "Another name…" lets the
  // Keiser credit a new one.
  const ownerSelect = (i: number, r: DraftRow) => {
    const onRoster = members.some((m) => m.cult_name === r.owner);
    return (
      <select
        value={r.owner}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__other") {
            const name = window.prompt("Name the soul who brought it (a departed member or a guest):");
            if (name?.trim()) setRow(i, { owner: name.trim() });
            return;
          }
          setRow(i, { owner: v });
          // Their sealed offering fills what is still blank: the wine, its
          // price, its grapes. Never overwrites the Keiser's own hand.
          const m = members.find((x) => x.cult_name === v);
          const off = m ? offerings[m.id] : undefined;
          if (off) {
            setRow(i, {
              owner: v,
              title: r.title.trim() ? r.title : off.title || "",
              price: r.price !== "" ? r.price : (off.price != null ? String(off.price) : ""),
              varietals: r.varietals.length ? r.varietals : (off.varietals || []),
            });
          }
        }}
        style={{ flex: 1, colorScheme: "dark" }}
      >
        <option value="">Unclaimed</option>
        {!onRoster && r.owner && <option value={r.owner}>{r.owner}</option>}
        {members.map((m) => <option key={m.id} value={m.cult_name}>{m.cult_name}</option>)}
        <option value="__other">Another name…</option>
      </select>
    );
  };

  return (
    <div style={{ marginTop: 8, paddingLeft: 24 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 60%" }}>
          <label className="field" style={{ marginTop: 0 }}>Theme</label>
          <input value={d.theme} onChange={(e) => set({ theme: e.target.value })} placeholder="The theme…" />
        </div>
        <div style={{ flex: "1 1 30%" }}>
          <label className="field" style={{ marginTop: 0 }}>Gathering no.</label>
          <input type="number" value={d.number} onChange={(e) => set({ number: Number(e.target.value) || 0 })} />
        </div>
      </div>
      <label className="field">Date</label>
      <input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} style={{ colorScheme: "dark" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 45%" }}>
          <label className="field">Host</label>
          {hostSelect(d.host_id, d.host_name, (id, name) => set({ host_id: id, host_name: name }), "Unrecorded")}
        </div>
        <div style={{ flex: "1 1 45%" }}>
          <label className="field">Co-host</label>
          {hostSelect(d.host2_id, d.host2_name, (id, name) => set({ host2_id: id, host2_name: name }), "No co-host")}
        </div>
      </div>

      <label className="field">The wines</label>
      {d.rows.map((r, i) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span className="eyebrow" style={{ flex: "none" }}>Cloth</span>
            <input type="number" min="1" inputMode="numeric" value={r.cloth} onChange={(e) => setRow(i, { cloth: e.target.value })}
              placeholder="?" title="The pour number, when known; leave blank if the pouring order was never recorded"
              style={{ width: 58, padding: "4px 8px", flex: "none" }} />
            <span style={{ flex: 1 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: r.dq ? "var(--wine)" : "var(--dim)", cursor: "pointer" }}>
              <input type="checkbox" checked={r.dq} onChange={(e) => setRow(i, { dq: e.target.checked })} style={{ width: "auto" }} />
              off theme · DQ
            </label>
            <button onClick={() => dropRow(i)} aria-label="Remove wine" style={{ width: "auto", background: "none", border: "none", color: "var(--wine)", cursor: "pointer", padding: 2 }}>
              <i className="ti ti-trash" style={{ fontSize: 14 }} />
            </button>
          </div>
          <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })}
            onBlur={() => { const hits = detectVarietals(r.title); if (hits.length) setRow(i, { varietals: [...new Set([...r.varietals, ...hits])] }); }}
            placeholder="The wine…" style={{ marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            {ownerSelect(i, r)}
            <input type="number" step="0.1" min="0" max="10" value={r.score} onChange={(e) => setRow(i, { score: e.target.value })} placeholder="Score" style={{ width: 84 }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <GrapePicker value={r.varietals} onChange={(v) => setRow(i, { varietals: v })} listId={`grapes-${i}`} />
            </div>
            <input type="number" min="0" inputMode="numeric" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} placeholder="Price · R" style={{ width: 104 }} />
          </div>
        </div>
      ))}
      <button className="btn" style={{ width: "auto", padding: "8px 14px" }} onClick={addRow}>
        <i className="ti ti-plus" style={{ fontSize: 13, marginRight: 5 }} />Add a wine
      </button>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn gold" style={{ flex: 1, minWidth: 130 }} disabled={busy || !d.theme.trim() || !d.date}
          onClick={async () => { setBusy(true); try { await onSave(d); } catch (e) { alert(`Could not seal the record: ${(e as Error).message}`); } setBusy(false); }}>
          {busy ? "Sealing…" : "Seal the record"}
        </button>
        <button className="btn" style={{ width: "auto", padding: "0 16px" }} onClick={onCancel}>Cancel</button>
        {onErase && (
          <button className="btn danger" style={{ width: "auto", padding: "0 14px" }}
            onClick={async () => { if (!window.confirm("Erase this gathering from the codex entirely?")) return; setBusy(true); try { await onErase(); } catch (e) { alert(`Could not erase it: ${(e as Error).message}`); } setBusy(false); }}>
            <i className="ti ti-trash" style={{ fontSize: 13 }} />
          </button>
        )}
      </div>
      <p className="whisper" style={{ margin: "8px 0 0", fontSize: 12 }}>
        Ranks are re-reckoned from the scores when sealed; ties share the crown.
      </p>
    </div>
  );
}

function AnnalCard({ a, g, isKeiser, members, myName, split, ballots, canSeeBreakdown, onSave, onErase, onClaim, onAddPhoto, onDropPhoto }: {
  a: AnnalEntry;
  g?: Gathering;
  isKeiser: boolean;
  members: RosterLite[];
  myName: string;
  split?: { cloth: number; min: number; max: number };
  ballots: HistoryBallot[]; // this gathering's sealed ballots (empty for initiates)
  canSeeBreakdown: boolean; // per-member scores: full members and the Keiser only (#6)
  onSave: (d: Draft) => Promise<void>;
  onErase: (gatheringId: string) => Promise<void>;
  onClaim: (a: AnnalEntry, rowIdx: number) => Promise<void>;
  onAddPhoto: (g: Gathering, file: File) => Promise<void>;
  onDropPhoto: (a: AnnalEntry, url: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  // What each soul logged before the night, so naming an owner can bring
  // their wine, price and grapes with it instead of the Keiser retyping them.
  const [offerings, setOfferings] = useState<Record<string, { title: string; price: number | null; varietals: string[] }>>({});
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    fetchAllOfferings(a.gatheringId)
      .then((o: Record<string, { title: string; price: number | null; varietals: string[] }>) => { if (alive) setOfferings(o); })
      .catch(() => {});
    return () => { alive = false; };
  }, [editing, a.gatheringId]);
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const { email: myEmail, mode: authMode } = useAuth();
  // "Email this to me" for a night long past: the Reckoning's own envelope,
  // reachable from the codex once the reveal has moved on to the next moon.
  const [mailState, setMailState] = useState<"idle" | "sending" | "sent">("idle");
  const mailNight = async () => {
    if (mailState === "sending") return;
    if (authMode !== "live" || !myEmail) { alert("The demo has no post office: sign in on the live Council and the record will fly."); return; }
    setMailState("sending");
    const champs = championsOf(a);
    const nameOf = (r: AnnalRow) => r.title || (r.cloth != null ? `Bottle ${toRoman(r.cloth)}` : "A bottle unrecorded");
    const res = await sendEmail("reckoning", [myEmail], {
      numberRoman: toRoman(a.number || 0),
      theme: a.theme || "",
      dateLabel: a.date ? fmtDate(a.date) : "",
      crowned: champs.map((c) => ({ title: nameOf(c), owner: c.owner, score: c.score })),
      ranked: [
        ...a.rows.filter((r) => !r.dq && !champs.includes(r)).sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99))
          .map((r) => ({ rank: toRoman(r.rank || 0), title: nameOf(r), owner: r.owner, score: r.votes > 0 ? r.score : null, dq: false })),
        ...a.rows.filter((r) => r.dq).map((r) => ({ rank: "✕", title: nameOf(r), owner: r.owner, score: null, dq: true })),
      ],
      split: split ? `${a.rows.find((r) => r.cloth === split.cloth)?.title || "A bottle"} divided the table, ${split.min} to ${split.max}` : undefined,
      value: (() => {
        // The ledger, reckoned the same way the reveal reckons it on the night.
        const priced = a.rows.filter((r) => !r.dq && r.votes > 0 && r.price);
        if (!priced.length) return undefined;
        const best = [...priced].sort((x, y) => y.score / y.price! - x.score / x.price!)[0];
        return `Best value of the night: ${nameOf(best)}, borne by ${best.owner || "an unclaimed hand"}, at R${best.price} · ${(best.score / best.price! * 100).toFixed(1)} points per hundred rand.`;
      })(),
    });
    if (res.ok) setMailState("sent");
    else { setMailState("idle"); alert(`The record would not send: ${res.error || res.skipped || "unknown"}`); }
  };
  // Which bottle's per-member scores are unfolded (keyed by row index).
  const [openScores, setOpenScores] = useState<number | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  // A bottle's individual verdicts, named and worn with a portrait.
  const memberById = new Map(members.map((m) => [m.id, m]));
  const scoresFor = (cloth: number | null) => {
    if (cloth == null || !canSeeBreakdown) return [];
    return ballots
      .map((b) => ({ member: memberById.get(b.memberId), score: b.scores[cloth], note: (b.notes || {})[cloth] || "" }))
      .filter((x): x is { member: RosterLite; score: number; note: string } => !!x.member && typeof x.score === "number" && x.score > 0)
      .sort((x, y) => y.score - x.score || x.member.cult_name.localeCompare(y.member.cult_name));
  };
  // One bottle per soul per night: no claiming if a wine is already yours here.
  const { sleeping } = useAuth();
  // Every write below is sealed three times over (the client Proxy, the lib
  // asserts, and the vault's RLS); this only keeps the instrument from
  // OFFERING what a sleeping hand cannot do.
  const canClaim = !!myName && !sleeping && !a.rows.some((r) => r.owner === myName);
  const photos = g?.reveal_photos || [];
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !g) return;
    setUploading(true);
    try { await onAddPhoto(g, f); } catch (err) { alert(`The image would not take: ${(err as Error).message}`); }
    setUploading(false);
  };
  const host = g ? [g.host_name, g.host2_name].filter(Boolean).join(" & ") : null;
  const champs = championsOf(a);
  const crowned = champs.map((c) => c.owner || (c.cloth != null ? `Bottle ${toRoman(c.cloth)}` : "A bottle unrecorded")).join(" & ");
  return (
    <div style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setOpen((o) => !o)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}>
          <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)" }} />
          <div style={{ flex: 1 }}>
            <div className="disp" style={{ fontSize: 15 }}>Gathering {toRoman(a.number)} · {a.theme}</div>
            <div className="whisper" style={{ fontSize: 13 }}>
              {fmtDate(a.date)}{crowned ? ` · crowned: ${crowned}` : ""}
            </div>
          </div>
        </button>
        {isKeiser && open && (
          <button onClick={() => setEditing((e) => !e)} title="Amend this record" aria-label="Amend this record"
            style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--gold2)", padding: "6px 9px", cursor: "pointer", display: "flex", alignItems: "center", flex: "none" }}>
            <i className={`ti ti-${editing ? "x" : "pencil"}`} style={{ fontSize: 14 }} />
          </button>
        )}
      </div>
      {open && editing && isKeiser ? (
        <GatheringEditor
          draft={draftFrom(a, g)}
          offerings={offerings}
          members={members}
          onCancel={() => setEditing(false)}
          onSave={async (d) => { await onSave(d); setEditing(false); }}
          onErase={async () => { await onErase(a.gatheringId); setEditing(false); }}
        />
      ) : open ? (
        <div style={{ marginTop: 8, paddingLeft: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginBottom: 8 }}>
            <span className="whisper" style={{ fontSize: 13 }}><span className="eyebrow" style={{ marginRight: 6 }}>Theme</span>{a.theme || "—"}</span>
            <span className="whisper" style={{ fontSize: 13 }}><span className="eyebrow" style={{ marginRight: 6 }}>Date</span>{fmtDate(a.date)}</span>
            <span className="whisper" style={{ fontSize: 13 }}><span className="eyebrow" style={{ marginRight: 6 }}>Host</span>{host || "unrecorded"}</span>
          </div>
          {a.rows.map((r, ri) => ({ r, ri })).sort((x, y) => (x.r.rank ?? 99) - (y.r.rank ?? 99)).map(({ r, ri }) => {
            const verdicts = scoresFor(r.cloth);
            const scoresOpen = openScores === ri;
            return (
            <div key={ri}>
            <div style={{ display: "flex", gap: 8, fontSize: 13, padding: "3px 0", color: r.dq ? "var(--wine)" : "var(--parch)", alignItems: "center" }}>
              <span className="disp" style={{ width: 24, fontSize: 11 }}>{r.dq ? "✕" : toRoman(r.rank || 0)}</span>
              <span style={{ flex: 1 }}>
                <span className="scr" style={{ fontSize: 14 }}>{r.title || (r.cloth != null ? `Bottle ${toRoman(r.cloth)}` : "A bottle unrecorded")}</span>
                {split?.cloth === r.cloth && <i className="ti ti-bolt" title="The split cloth" style={{ color: "var(--gold2)", fontSize: 12, marginLeft: 5 }} />}
                {r.owner ? <span style={{ color: "var(--dim)" }}> · {r.owner}</span> : null}
                {(r.varietals?.length || r.price != null) ? (
                  <span className="whisper" style={{ fontSize: 12 }}>
                    {" "}· {[r.varietals?.join(", "), r.price != null ? `R${r.price}` : null].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                {!r.owner && canClaim && (
                  <button
                    onClick={() => { if (window.confirm(`Claim ${r.title || (r.cloth != null ? `Bottle ${toRoman(r.cloth)}` : "A bottle unrecorded")} as your own pour?`)) onClaim(a, ri).catch((e) => alert(`The claim would not hold: ${(e as Error).message}`)); }}
                    style={{ width: "auto", marginLeft: 8, background: "none", border: "1px solid var(--line2)", borderRadius: 12, color: "var(--gold2)", padding: "1px 10px", cursor: "pointer", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13 }}>
                    <i className="ti ti-hand-grab" style={{ fontSize: 11, marginRight: 4 }} />claim it
                  </button>
                )}
                {!r.owner && !canClaim && <span className="whisper" style={{ fontSize: 12 }}> · unclaimed</span>}
                {r.dq && <span className="whisper" style={{ fontSize: 12, color: "var(--wine)" }}> · disqualified</span>}
              </span>
              <span className="disp" style={{ fontSize: 12 }}>{r.votes > 0 ? r.score.toFixed(1) : "—"}</span>
              {verdicts.length > 0 && (
                <Caret open={scoresOpen} onClick={() => setOpenScores(scoresOpen ? null : ri)} label={`Every member's score for ${r.title || "this bottle"}`} />
              )}
            </div>
            {scoresOpen && verdicts.length > 0 && (
              // Per-member scores (#6): full members and the Keiser only —
              // initiates get no caret, and the database gives them no rows.
              <div style={{ margin: "2px 0 8px 32px", borderLeft: "1px solid var(--line)", paddingLeft: 12 }}>
                {verdicts.map(({ member, score, note }) => (
                  <div key={member.id} style={{ padding: "3px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar src={member.avatar_url} initials={member.short_name || member.cult_name.slice(0, 2).toUpperCase()} size={22} />
                      <span style={{ flex: 1, minWidth: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: "var(--parch)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.cult_name}</span>
                      <ScorePips score={score} />
                      <span className="disp" style={{ fontSize: 12, width: 20, textAlign: "right", color: "var(--gold2)" }}>{score}</span>
                    </div>
                    {note && (
                      <p className="whisper" style={{ margin: "1px 0 5px 31px", fontSize: 13.5, lineHeight: 1.45, color: "var(--dim)" }}>
                        &ldquo;{note}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 0 1px", borderTop: "1px solid var(--line)", marginTop: 3 }}>
                  <span className="eyebrow" style={{ flex: 1, fontSize: 9.5 }}>Total</span>
                  <span className="disp" style={{ fontSize: 12, color: "var(--gold2)" }}>
                    {verdicts.reduce((s, v) => s + v.score, 0)}{r.votes > 0 ? ` · avg ${r.score.toFixed(1)}` : ""}
                  </span>
                </div>
              </div>
            )}
            </div>
            );
          })}

          {split && (() => {
            const w = a.rows.find((r) => r.cloth === split.cloth);
            return (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line2)", borderRadius: 12, color: "var(--gold2)", padding: "3px 10px", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, marginTop: 8 }}>
                <i className="ti ti-bolt" style={{ fontSize: 12 }} />
                The split cloth: {w?.title || `Bottle ${toRoman(split.cloth)}`} divided the table, {split.min} to {split.max}
              </div>
            );
          })()}

          <div style={{ marginTop: 12 }}>
            <button className="btn" style={{ width: "auto", padding: "8px 16px" }} onClick={mailNight} disabled={mailState === "sending"}>
              <i className="ti ti-mail" style={{ fontSize: 13, marginRight: 6 }} />
              {mailState === "sent" ? "It flies to your inbox" : mailState === "sending" ? "Sending…" : "Email this to me"}
            </button>
          </div>

          {g && (photos.length > 0 || !!myName) && (
            <div style={{ marginTop: 12 }}>
              <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>Look upon the wine</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {photos.map((url) => (
                  <span key={url} style={{ position: "relative", display: "inline-flex" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="A bottle from this night" onClick={() => setViewPhoto(url)}
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line2)", cursor: "zoom-in" }} />
                    {isKeiser && (
                      <button
                        onClick={() => onDropPhoto(a, url)}
                        aria-label="Take this photograph down"
                        title="Take this photograph down"
                        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, padding: 0, borderRadius: 10, background: "#0d0b0a", border: "1px solid var(--wine)", color: "#c98", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                      >
                        <i className="ti ti-x" style={{ fontSize: 11 }} />
                      </button>
                    )}
                  </span>
                ))}
                {!!myName && (
                  <button onClick={() => photoRef.current?.click()} disabled={uploading} aria-label="Add a photo of this night"
                    style={{ width: 64, height: 64, background: "none", border: "1px dashed var(--line2)", borderRadius: 8, color: "var(--gold2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`ti ti-${uploading ? "loader-2" : "camera-plus"}`} style={{ fontSize: 18 }} />
                  </button>
                )}
              </div>
              <input ref={photoRef} data-sleep-ok type="file" accept="image/*" style={{ display: "none" }} onChange={pickPhoto} />
            </div>
          )}
          {viewPhoto && (
            <div onClick={() => setViewPhoto(null)}
              style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewPhoto} alt="A bottle from this night" style={{ maxWidth: "90vw", maxHeight: "82vh", borderRadius: 12, border: "1px solid var(--gold)", boxShadow: "0 24px 70px rgba(0,0,0,0.8)" }} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function Codex() {
  const { role, mode, member, sleeping } = useAuth();
  const isKeiser = role === "keiser";
  // Who is looking: claims and photos are open to every signed-in soul.
  const myName = mode === "live"
    ? member?.cult_name || ""
    : role === "keiser" ? "The Keiser" : role === "member" ? "Priestess Larissa" : "";
  const [annals, setAnnals] = useState<AnnalEntry[]>([]);
  const [dq, setDq] = useState<Record<string, number>>({});
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [members, setMembers] = useState<RosterLite[]>([]);
  const [adding, setAdding] = useState(false);
  // Until the first fetch lands, show the waiting mark — zeros everywhere
  // read as "no history" and send souls away before the annals arrive.
  const [loaded, setLoaded] = useState(false);
  // Sealed ballots power the split-cloth markers and the Reliquary.
  const [history, setHistory] = useState<HistoryBallot[]>([]);

  // After an edit: fetch fresh and keep the snapshots honest.
  const refresh = async () => {
    const annalsFresh = await fetchAnnals();
    const gatheringsFresh = await fetchGatherings().catch(() => [] as Gathering[]);
    const dqFresh = await fetchDqCounts();
    setAnnals(annalsFresh); writeSwr("annals", annalsFresh);
    setGatherings(gatheringsFresh); writeSwr("gatherings", gatheringsFresh);
    setDq(dqFresh); writeSwr("dq", dqFresh);
    setLoaded(true);
  };

  useEffect(() => {
    // First load: last snapshot instantly, fresh truth right behind it.
    swr("annals", fetchAnnals, (d) => { setAnnals(d); setLoaded(true); });
    swr("gatherings", () => fetchGatherings().catch(() => [] as Gathering[]), setGatherings);
    swr("dq", fetchDqCounts, setDq);
    if (mode === "live" && supabase) {
      swr("members-brief", async () => {
        const { data } = await supabase!.from("members").select("id,cult_name,short_name,avatar_url").order("cult_name");
        return (data || []) as Member[];
      }, setMembers);
    } else {
      setMembers(loadMembers());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // One pass over the sealed ballots once the annals + roster are known.
  // Initiates never load them: individual scores are full-member reading
  // (#6; the database refuses them the rows regardless).
  useEffect(() => {
    if (!annals.length || !members.length || role === "initiate") return;
    fetchBallotHistory(annals.map((a) => a.gatheringId), members.map((m) => m.id))
      .then((h) => setHistory(h.filter((b) => b.sealed)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annals.length, members.length, role]);

  // The split cloth per night: the widest score gap on any wine, when wide
  // enough (>= 5) to count as a genuine schism.
  const splits = (() => {
    const out: Record<string, { cloth: number; min: number; max: number }> = {};
    const byG = new Map<string, HistoryBallot[]>();
    for (const b of history) {
      const list = byG.get(b.gatheringId) || [];
      list.push(b); byG.set(b.gatheringId, list);
    }
    for (const [gid, list] of byG) {
      let best: { cloth: number; min: number; max: number } | null = null;
      const cloths = new Set<number>();
      list.forEach((b) => Object.keys(b.scores).forEach((c) => cloths.add(Number(c))));
      for (const cloth of cloths) {
        const scores = list.map((b) => b.scores[cloth]).filter((v) => typeof v === "number");
        if (scores.length < 3) continue;
        const min = Math.min(...scores), max = Math.max(...scores);
        if (max - min >= 5 && (!best || max - min > best.max - best.min)) best = { cloth, min, max };
      }
      if (best) out[gid] = best;
    }
    return out;
  })();

  // Seal an amended or newly recorded gathering: validation first (blank or
  // malformed required data blocks the seal, loudly — ticket #4), then ranks
  // recomputed from scores (competition style, ties share, DQs unranked),
  // gathering + annal in step.
  const saveDraft = async (d: Draft) => {
    const faults = validateMeetingDraft(d);
    if (faults.length) throw new Error(`the record refuses it:\n• ${faults.join("\n• ")}`);
    const rows = reckonRows(d.rows);
    const gpatch: Partial<Gathering> = {
      number: d.number, theme_title: d.theme, gather_date: d.date, status: "revealed",
      host_id: d.host_id, host_name: d.host_name || null, host2_id: d.host2_id, host2_name: d.host2_name || null,
      wine_count: rows.length,
    };
    let gid = d.gatheringId;
    if (gid && gatherings.some((g) => g.id === gid)) {
      await updateGathering(gid, gpatch);
    } else if (!gid) {
      const created = await createGathering({
        id: `g-${d.date}-${d.number}`, moon_label: "A moon remembered", theme_description: null,
        gather_time: "19:00", reveal_photos: null, rules_text: null, threat_text: null,
        venue_instructions: null, attendees: [],
        ...gpatch,
      } as Gathering);
      gid = created.id;
    }
    await commitAnnal({ gatheringId: gid!, number: d.number, theme: d.theme, date: d.date, rows, committed_at: new Date().toISOString() });
    await refresh();
  };

  // Gathering first, and loudly: if the live DB refuses the delete (e.g. a
  // missing policy), the error surfaces in the editor's alert BEFORE the annal
  // is touched — a silently surviving gathering would keep resurfacing (it was
  // exactly what left an erased night haunting the convene page).
  const eraseGathering = async (gatheringId: string) => {
    if (gatherings.some((g) => g.id === gatheringId)) await deleteGathering(gatheringId);
    await deleteAnnal(gatheringId);
    await refresh();
  };

  // Claim an unowned bottle as your own (one per soul per night; the
  // AnnalCard hides the button once a wine that night is already yours).
  const claimWine = async (a: AnnalEntry, rowIdx: number) => {
    if (!myName || a.rows.some((r) => r.owner === myName)) return;
    if (gatheringsLive()) {
      // The annals are the Keiser's to write; a member claims through the
      // narrow door instead (see claimBottle).
      await claimBottle(a.gatheringId, rowIdx);
    } else {
      const rows = a.rows.map((r, i) => (i === rowIdx && !r.owner ? { ...r, owner: myName } : r));
      await commitAnnal({ ...a, rows });
    }
    await refresh();
  };

  // Any soul may add a photo of the night to the gathering's gallery.
  // The Keiser alone may take a photograph down, and is asked first: a
  // photograph erased by a slip cannot be got back.
  const dropPhoto = async (a: AnnalEntry, url: string) => {
    const g = gatherings.find((x) => x.id === a.gatheringId);
    if (!g) return;
    if (!window.confirm("Take this photograph down for good?")) return;
    const keep = (g.reveal_photos || []).filter((u) => u !== url);
    try {
      if (gatheringsLive()) await removeRevealPhoto(g.id, url, keep);
      else await updateGathering(g.id, { reveal_photos: keep });
      await refresh();
    } catch (e) {
      alert(`The photograph would not come down: ${(e as Error).message}`);
    }
  };

  const addPhoto = async (g: Gathering, file: File) => {
    const url = await uploadRevealPhoto(g.id, file);
    // The RPC appends; a plain gatherings update would be refused for a
    // sleeping member, who is allowed to hang photographs by decree.
    if (gatheringsLive()) await attachRevealPhoto(g.id, url);
    else await updateGathering(g.id, { reveal_photos: [...(g.reveal_photos || []), url] });
    await refresh();
  };

  const dqList = Object.entries(dq).sort((a, b) => b[1] - a[1]);
  const dqMax = Math.max(DQ_THRESHOLD, ...dqList.map(([, n]) => n));

  // Everything below is derived from committed reckonings only.
  // A bottle counts as judged when it was scored or cast out; a night
  // recorded without scores poured bottles that were never judged.
  const bottlesJudged = annals.reduce((n, a) => n + a.rows.filter((r) => r.votes > 0 || r.dq).length, 0);
  const victoryList = Object.entries(victoriesFrom(annals)).sort((a, b) => b[1] - a[1]);
  // The vine's foresight: the Prophecy's lifetime record, graded crowning by
  // crowning; silent until at least one prophecy has been judged.
  const foresight = prophecyRecord(gatherings, annals);
  // Coin poured: every recorded rand across the codex, shown compactly.
  const coinTotal = annals.reduce((n, a) => n + a.rows.reduce((m, r) => m + (r.price || 0), 0), 0);
  const coinLabel = coinTotal >= 1000 ? `R${(coinTotal / 1000).toFixed(1)}K` : `R${Math.round(coinTotal)}`;
  // Grapes tasted: distinct varietals ever recorded, against the full ledger.
  const grapeList = [...new Set(annals.flatMap((a) => a.rows.flatMap((r) => r.varietals || [])))].sort((x, y) => x.localeCompare(y));
  const grapesTasted = grapeList.length;
  const [grapesOpen, setGrapesOpen] = useState(false);
  const winsMax = Math.max(1, ...victoryList.map(([, n]) => n));
  // The most frequent winner holds the chalice.
  // The Reliquary: all-time records, reckoned fresh from the annals + ballots.
  const relics = (() => {
    if (!annals.length) return null;
    let pour: { title: string; score: number; date: string } | null = null;
    for (const a of annals) for (const r of a.rows) {
      if (!r.dq && r.votes > 0 && (!pour || r.score > pour.score)) pour = { title: r.title || (r.cloth != null ? `Bottle ${toRoman(r.cloth)}` : "A bottle unrecorded"), score: r.score, date: a.date };
    }
    let schism: { title: string; min: number; max: number } | null = null;
    {
      const byG = new Map<string, HistoryBallot[]>();
      for (const b of history) { const l = byG.get(b.gatheringId) || []; l.push(b); byG.set(b.gatheringId, l); }
      for (const [gid, list] of byG) {
        const cloths = new Set<number>();
        list.forEach((b) => Object.keys(b.scores).forEach((c) => cloths.add(Number(c))));
        for (const cloth of cloths) {
          const scores = list.map((b) => b.scores[cloth]).filter((v) => typeof v === "number");
          if (scores.length < 3) continue;
          const min = Math.min(...scores), max = Math.max(...scores);
          if (!schism || max - min > schism.max - schism.min) {
            const night = annals.find((a) => a.gatheringId === gid);
            const w = night?.rows.find((r) => r.cloth === cloth);
            schism = { title: w?.title || `Bottle ${toRoman(cloth)}`, min, max };
          }
        }
      }
    }
    // Temper: each soul's mean given vs the table's mean, over 20+ verdicts.
    const nameOf = new Map(members.map((m) => [m.id, m.cult_name]));
    const all: number[] = [];
    const per = new Map<string, number[]>();
    for (const b of history) {
      const vals = Object.values(b.scores).filter((v) => typeof v === "number");
      all.push(...vals);
      const l = per.get(b.memberId) || []; l.push(...vals); per.set(b.memberId, l);
    }
    const tableMean = all.length ? all.reduce((x, y) => x + y, 0) / all.length : 0;
    let iron: { name: string; delta: number } | null = null;
    let gentle: { name: string; delta: number } | null = null;
    for (const [mid, vals] of per) {
      if (vals.length < 20) continue;
      const name = nameOf.get(mid);
      if (!name) continue;
      const delta = vals.reduce((x, y) => x + y, 0) / vals.length - tableMean;
      if (!iron || delta < iron.delta) iron = { name, delta };
      if (!gentle || delta > gentle.delta) gentle = { name, delta };
    }
    // The crown's habits: the most-crowned grape, and what a crown costs.
    const grapeCrowns = new Map<string, number>();
    const crownPrices: number[] = [];
    for (const a of annals) for (const c of championsOf(a)) {
      for (const g of c.varietals || []) grapeCrowns.set(g, (grapeCrowns.get(g) || 0) + 1);
      if (c.price) crownPrices.push(c.price);
    }
    const crownedGrape = [...grapeCrowns.entries()].sort((x, y) => y[1] - x[1])[0] || null;
    const allPrices = annals.flatMap((a) => a.rows.filter((r) => !r.dq && r.price)).map((r) => r.price!);
    const victoryPrice = crownPrices.length
      ? { crown: crownPrices.reduce((x, y) => x + y, 0) / crownPrices.length, table: allPrices.reduce((x, y) => x + y, 0) / allPrices.length }
      : null;
    return { pour, schism, iron, gentle, crownedGrape, victoryPrice };
  })();

  // The curse of the first cloth: the average verdict by pouring order,
  // counted only where a wine knows its cloth AND was truly scored. Positions
  // must be represented on enough nights to mean anything (at least two, and
  // at least half the scored nights once the codex grows).
  const clothCurse = (() => {
    const byCloth = new Map<number, number[]>();
    const scoredNights = new Set<string>();
    for (const a of annals) for (const r of a.rows) {
      if (r.dq || r.votes === 0 || r.cloth == null) continue;
      scoredNights.add(a.gatheringId);
      const l = byCloth.get(r.cloth) || []; l.push(r.score); byCloth.set(r.cloth, l);
    }
    const need = Math.max(2, scoredNights.size / 2);
    const bars = [...byCloth.entries()]
      .filter(([, xs]) => xs.length >= need)
      .sort((x, y) => x[0] - y[0])
      .map(([cloth, xs]) => ({ cloth, avg: xs.reduce((a2, b) => a2 + b, 0) / xs.length }));
    return bars.length >= 3 ? bars : null;
  })();

  const themeAvgs = annals
    .map((a) => {
      const scored = a.rows.filter((r) => !r.dq && r.votes > 0);
      return { theme: a.theme, avg: scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : null };
    })
    .filter((t): t is { theme: string; avg: number } => t.avg != null)
    .sort((a, b) => b.avg - a.avg);

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The codex</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        The annals of the Council: all that has been poured, remembered. Nothing is
        written here until the Keiser commits it.
      </p>

      {!loaded ? (
        <div className="card"><Loading text="Consulting the annals…" /></div>
      ) : (
      <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Metric value={String(annals.length)} label="gatherings" />
        <Metric value={String(bottlesJudged)} label="bottles judged" />
        {coinTotal > 0 && <Metric value={coinLabel} label="coin poured" />}
        <Metric value={foresight.total > 0 ? `${Math.round((foresight.right / foresight.total) * 100)}%` : "NA"} label="prophecies fulfilled" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Grapes tasted</div>
        {/* The caret rides the existing line (ticket #5) — no row of its own. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 6, background: "rgba(160,150,120,0.14)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (grapesTasted / GRAPES.length) * 100)}%`, height: "100%", background: "linear-gradient(90deg, var(--gold), var(--gold2))", borderRadius: 3 }} />
          </div>
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: 13, color: "var(--gold2)", whiteSpace: "nowrap" }}>{grapesTasted} of {GRAPES.length}</span>
          {grapesTasted > 0 && (
            <Caret open={grapesOpen} onClick={() => setGrapesOpen((o) => !o)} label="Every grape tasted so far" />
          )}
        </div>
        {grapesOpen && grapesTasted > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {grapeList.map((gr) => (
              <span key={gr} className="tag" style={{ textTransform: "none", letterSpacing: "0.04em" }}>{gr}</span>
            ))}
          </div>
        )}
      </div>

      {relics && (relics.pour || relics.schism || relics.iron || relics.crownedGrape || relics.victoryPrice) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>The Reliquary · records of the Council</div>
          {relics.pour && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span className="eyebrow" style={{ fontSize: 10 }}>Highest pour ever</span>
              <span className="scr" style={{ color: "var(--gold2)", fontSize: 15, textAlign: "right" }}>{relics.pour.title} · {relics.pour.score.toFixed(1)}</span>
            </div>
          )}
          {relics.schism && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span className="eyebrow" style={{ fontSize: 10, display: "inline-flex", alignItems: "center" }}>The great schism<Tip align="left" text="The single wine that split the table widest: the gap between its highest and lowest score across every night in the codex." /></span>
              <span className="scr" style={{ color: "var(--gold2)", fontSize: 15, textAlign: "right" }}>{relics.schism.title}, {relics.schism.min} to {relics.schism.max}</span>
            </div>
          )}
          {relics.iron && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span className="eyebrow" style={{ fontSize: 10, display: "inline-flex", alignItems: "center" }}>The iron palate<Tip align="left" text="The harshest judge: the member whose average verdict sits furthest below the table's average, over at least twenty scores." /></span>
              <span className="scr" style={{ color: "var(--gold2)", fontSize: 15, textAlign: "right" }}>{relics.iron.name}, {relics.iron.delta.toFixed(1)}</span>
            </div>
          )}
          {relics.gentle && relics.gentle.name !== relics.iron?.name && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span className="eyebrow" style={{ fontSize: 10, display: "inline-flex", alignItems: "center" }}>The gentle hand<Tip align="left" text="The kindest judge: the member whose average verdict sits furthest above the table's average, over at least twenty scores." /></span>
              <span className="scr" style={{ color: "var(--gold2)", fontSize: 15, textAlign: "right" }}>{relics.gentle.name}, +{relics.gentle.delta.toFixed(1)}</span>
            </div>
          )}
          {relics.crownedGrape && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span className="eyebrow" style={{ fontSize: 10, display: "inline-flex", alignItems: "center" }}>The crowned grape<Tip align="left" text="The varietal that has taken the most crowns across every night in the codex." /></span>
              <span className="scr" style={{ color: "var(--gold2)", fontSize: 15, textAlign: "right" }}>{relics.crownedGrape[0]} · {relics.crownedGrape[1]} {relics.crownedGrape[1] === 1 ? "crown" : "crowns"}</span>
            </div>
          )}
          {relics.victoryPrice && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span className="eyebrow" style={{ fontSize: 10, display: "inline-flex", alignItems: "center" }}>The price of victory<Tip align="left" text={`What a crown costs on average, where the coin was recorded. The table's average bottle sits at R${Math.round(relics.victoryPrice.table)}.`} /></span>
              <span className="scr" style={{ color: "var(--gold2)", fontSize: 15, textAlign: "right" }}>crowns average R{Math.round(relics.victoryPrice.crown)}</span>
            </div>
          )}
        </div>
      )}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Victories by member</div>
        {victoryList.length === 0 ? (
          <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No champions crowned yet.</p>
        ) : (
          victoryList.map(([name, wins]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 110, fontSize: 13, color: "var(--dim)" }}>{name}</span>
              <div className="bar" style={{ flex: 1, margin: 0 }}>
                <i style={{ width: `${(wins / winsMax) * 100}%` }} />
              </div>
              <span className="disp" style={{ fontSize: 13 }}>{wins}</span>
            </div>
          ))
        )}
      </div>

      {themeAvgs.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Average score by theme</div>
          {themeAvgs.map((r) => (
            <div key={r.theme} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 130, fontSize: 13, color: "var(--dim)" }}>{r.theme}</span>
              <div className="bar" style={{ flex: 1, margin: 0 }}>
                <i style={{ width: `${(r.avg / 10) * 100}%` }} />
              </div>
              <span className="disp" style={{ fontSize: 13 }}>{r.avg.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}


      {clothCurse && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>The curse of the first cloth</div>
          <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
            The average verdict by pouring order, counted only where the pour was recorded.
          </p>
          {(() => {
            const W = 360, H = 120, base = 96;
            const bw = Math.min(34, (W - 40) / clothCurse.length - 8);
            const step = (W - 30) / clothCurse.length;
            const lo = Math.min(...clothCurse.map((b) => b.avg));
            const hi = Math.max(...clothCurse.map((b) => b.avg));
            const hOf = (v: number) => 24 + (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * 48;
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} role="img" aria-label="Average score by pouring position">
                <line x1={15} y1={base} x2={W - 10} y2={base} stroke="rgba(160,150,120,0.25)" />
                {clothCurse.map((b, i) => {
                  const h = hOf(b.avg);
                  const x = 15 + step * i + (step - bw) / 2;
                  return (
                    <g key={b.cloth}>
                      <rect x={x} y={base - h} width={bw} height={h} fill="#cbbd93" opacity={0.45 + (hi === lo ? 0.5 : (b.avg - lo) / (hi - lo)) * 0.55} />
                      <text x={x + bw / 2} y={base - h - 6} textAnchor="middle" fontSize={10} fill="#cbbd93" fontFamily="'Cinzel',serif">{b.avg.toFixed(1)}</text>
                      <text x={x + bw / 2} y={base + 14} textAnchor="middle" fontSize={9} fill="#7c766a" fontFamily="'Cinzel',serif">{toRoman(b.cloth)}</text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </div>
      )}

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Past gatherings</div>
        <p className="whisper" style={{ margin: "0 0 8px", fontSize: 13 }}>
          Every committed night, most recent first. Open one to see the table as it stood.
          {isKeiser ? " Yours to amend, Keiser." : ""}
        </p>
        {annals.length === 0 && !adding ? (
          <p className="whisper" style={{ margin: 0, fontSize: 14 }}>Nothing committed yet. The Keiser seals each reveal into the codex.</p>
        ) : (
          [...annals]
            .sort((x, y) => (y.date || "").localeCompare(x.date || ""))
            .map((a) => (
              <AnnalCard
                key={a.gatheringId}
                a={a}
                g={gatherings.find((gg) => gg.id === a.gatheringId)}
                isKeiser={isKeiser}
                members={members}
                myName={myName}
                split={splits[a.gatheringId]}
                ballots={history.filter((b) => b.gatheringId === a.gatheringId)}
                canSeeBreakdown={role !== "initiate"}
                onSave={saveDraft}
                onErase={eraseGathering}
                onClaim={claimWine}
                onAddPhoto={addPhoto}
                onDropPhoto={dropPhoto}
              />
            ))
        )}
        {isKeiser && (adding ? (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Record a past gathering</div>
            <GatheringEditor
              offerings={{}}
              draft={{
                number: Math.max(0, ...annals.map((a) => a.number), ...gatherings.map((g) => g.number || 0)) + 1,
                theme: "", date: "", host_id: null, host_name: "", host2_id: null, host2_name: "",
                rows: [{ cloth: "", title: "", owner: "", score: "", dq: false, votes: 1, varietals: [], price: "" }],
              }}
              members={members}
              onCancel={() => setAdding(false)}
              onSave={async (d) => { await saveDraft(d); setAdding(false); }}
            />
          </div>
        ) : (
          <button className="btn" style={{ width: "auto", padding: "9px 16px", marginTop: 10 }} onClick={() => setAdding(true)}>
            <i className="ti ti-plus" style={{ fontSize: 13, marginRight: 6 }} />Record a past gathering
          </button>
        ))}
      </div>

      <div className="card" style={{ margin: "16px 0 0" }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Disqualifications</div>
        <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
          Wines cast out for breaking theme. At {DQ_THRESHOLD}, the offender is summoned before the tribunal.
        </p>
        {dqList.length === 0 ? (
          <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No wine has yet strayed. The Council is watching.</p>
        ) : (
          dqList.map(([name, n]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 110, fontSize: 13, color: n >= DQ_THRESHOLD ? "var(--wine)" : "var(--dim)" }}>{name}</span>
              <div className="bar" style={{ flex: 1, margin: 0 }}>
                <i style={{ width: `${(n / dqMax) * 100}%`, background: n >= DQ_THRESHOLD ? "var(--wine)" : "var(--gold)" }} />
              </div>
              <span className="disp" style={{ fontSize: 13, color: n >= DQ_THRESHOLD ? "var(--wine)" : "var(--gold2)" }}>
                {n}{n >= DQ_THRESHOLD ? " · summoned" : ""}
              </span>
            </div>
          ))
        )}
      </div>

      </>
      )}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
