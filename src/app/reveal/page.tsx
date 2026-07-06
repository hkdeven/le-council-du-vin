"use client";

import { useState, useEffect } from "react";
import { seedMembers } from "@/lib/seed";
import { toRoman } from "@/lib/util";
import { fetchAllOfferings } from "@/lib/bottles";
import { fetchAllBallots, tallyFromBallots, sealedAmong, MemberBallot } from "@/lib/ballots";
import { fetchAnnal, commitAnnal, AnnalRow } from "@/lib/annals";
import { fetchCurrentGathering } from "@/lib/gatherings";
import { useAuth } from "@/components/AuthProvider";
import { useWineCount } from "@/lib/useWineCount";
import BottleReveal from "@/components/BottleReveal";
import type { Gathering } from "@/lib/types";

interface RevealRow {
  cloth: number;
  title: string; // the wine itself — unknown until the cloth is lifted
  owner: string; // who brought it — claimed after the cloths come off
  score: number; // average of every sealed ballot
  votes: number;
  dq: boolean; // disqualified by the Keiser for breaking theme
}

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

export default function Reveal() {
  const { mode, role, member } = useAuth();
  const isKeiser = role === "keiser";
  const meId = mode === "live" ? member?.id ?? null : role === "keiser" ? "m-keiser" : role === "member" ? "m-larissa" : null;
  const myName = mode === "live" ? member?.cult_name || "" : seedMembers.find((m) => m.id === meId)?.cult_name || "";

  const [g, setG] = useState<Gathering | null>(null);
  const [ready, setReady] = useState(false);
  const [ballots, setBallots] = useState<MemberBallot[]>([]);
  const [offerings, setOfferings] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<RevealRow[]>([]);
  const [committed, setCommitted] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    fetchCurrentGathering().then((cg) => {
      setG(cg);
      setReady(true);
    });
  }, []);
  const gid = g?.id ?? "none";
  const attendees = g?.attendees || [];

  const [wineCount] = useWineCount(gid, g?.wine_count ?? 11);

  // Load every ballot + offering, and any committed annal, for this gathering.
  useEffect(() => {
    if (!g) return;
    let active = true;
    (async () => {
      const [bs, offs, annal] = await Promise.all([
        fetchAllBallots(g.id),
        fetchAllOfferings(g.id),
        fetchAnnal(g.id),
      ]);
      if (!active) return;
      setBallots(bs);
      setOfferings(offs);
      if (annal) {
        setRows(annal.rows.map((r) => ({ cloth: r.cloth, title: r.title, owner: r.owner, score: r.score, votes: r.votes, dq: r.dq })));
        setCommitted(true);
      } else {
        const tally = tallyFromBallots(bs, wineCount);
        setRows(Array.from({ length: wineCount }, (_, i) => i + 1).map((cloth) => ({
          cloth, title: "", owner: "",
          score: tally[cloth]?.avg || 0, votes: tally[cloth]?.votes || 0, dq: false,
        })));
      }
    })();
    return () => { active = false; };
  }, [g, wineCount]);

  // The reveal opens only when every attendee has sealed — or once committed.
  const sealedCount = sealedAmong(ballots, attendees);
  const locked = !committed && (attendees.length === 0 || sealedCount < attendees.length);

  // Ranking is computed, never stored: qualified bottles by score, the
  // disqualified banished to the bottom without a rank.
  const qualified = [...rows].filter((r) => !r.dq).sort((a, b) => b.score - a.score || a.cloth - b.cloth);
  const dqRows = rows.filter((r) => r.dq);
  const champion = qualified[0] ?? null;
  const rest = [...qualified.slice(1), ...dqRows];
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
    const q = [...data].filter((r) => !r.dq).sort((a, b) => b.score - a.score || a.cloth - b.cloth);
    await commitAnnal({
      gatheringId: g!.id,
      number: g!.number,
      theme: g!.theme_title,
      date: g!.gather_date,
      committed_at: new Date().toISOString(),
      rows: data.map((r): AnnalRow => ({
        cloth: r.cloth, owner: r.owner, title: r.title, score: r.score, votes: r.votes,
        dq: r.dq, rank: r.dq ? null : q.findIndex((x) => x.cloth === r.cloth) + 1,
      })),
    });
  };

  const commit = async () => {
    if (!isKeiser) return;
    try {
      await writeAnnal(rows);
      setCommitted(true);
    } catch (e) {
      alert(`Could not commit to the Annals: ${(e as Error).message}`);
    }
  };

  const patch = (cloth: number, p: Partial<RevealRow>) =>
    persist(rows.map((r) => (r.cloth === cloth ? { ...r, ...p } : r)));

  const myClaim = rows.find((r) => r.owner === myName) ?? null;
  const claim = (cloth: number) => {
    if (!meId || myClaim) return;
    const mine = offerings[meId] || "";
    persist(rows.map((r) => (r.cloth === cloth ? { ...r, owner: myName, title: r.title || mine } : r)));
  };
  const release = (cloth: number) => {
    if (!meId) return;
    const mine = offerings[meId] || "";
    persist(rows.map((r) => (r.cloth === cloth && r.owner === myName ? { ...r, owner: "", title: r.title === mine ? "" : r.title } : r)));
  };

  if (!ready) return <section />;

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

  if (locked) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-lock" style={{ fontSize: 34, color: "var(--gold)" }} aria-hidden="true" />
        <h1 className="disp" style={{ fontSize: 18, fontWeight: 500, marginTop: 12 }}>The reckoning stays sealed</h1>
        <p className="whisper" style={{ fontSize: 16, maxWidth: 380, margin: "10px auto 0" }}>
          {attendees.length === 0
            ? "No souls have answered the call. RSVP on the convening, then judge in the rite."
            : `${sealedCount} of ${attendees.length} ballots have been sealed. The cloths are not lifted until every soul has judged.`}
        </p>
      </section>
    );
  }

  if (!champion) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <p className="whisper" style={{ fontSize: 16 }}>No verdicts have been cast. The rite must come first.</p>
      </section>
    );
  }

  const fmtScore = (r: RevealRow) => (r.votes > 0 ? r.score.toFixed(1) : "—");

  const renderRow = (w: RevealRow, rankIdx: number | null) => {
    const isDq = w.dq;
    const color = isDq ? "var(--wine)" : "var(--gold2)";
    return (
      <div key={w.cloth} className="rk rise" style={{ opacity: isDq ? 0.85 : 1 }}>
        <span className="disp" style={{ width: 26, fontSize: isDq ? 11 : 14, color }}>
          {isDq ? "✕" : toRoman(rankIdx || 0)}
        </span>
        <div style={{ flex: 1 }}>
          <div>
            <span style={{ textDecoration: isDq ? "line-through" : "none" }}>Bottle {toRoman(w.cloth)}</span> —{" "}
            <OwnerSlot owner={w.owner} mine={w.owner === myName && !!myName} canClaim={!!meId && !myClaim} canAct={canAct}
              onClaim={() => claim(w.cloth)} onRelease={() => release(w.cloth)}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: "var(--gold2)" }} />
            {isDq && <span className="tag" style={{ marginLeft: 8, color: "var(--wine)", borderColor: "var(--wine)" }}>off theme · disqualified</span>}
          </div>
          <div style={{ fontSize: 14, color: "var(--parch)", marginTop: 2 }}>
            <Inline value={w.title} placeholder="name the wine…" canEdit={canAct} onChange={(v) => patch(w.cloth, { title: v })} />
          </div>
          <div className="bar">
            <i style={{ width: `${(w.score / 10) * 100}%`, background: isDq ? "var(--wine)" : "var(--gold)" }} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="disp" style={{ color }}>{fmtScore(w)}</span>
          {isKeiser && canAct && (
            <button onClick={() => patch(w.cloth, { dq: !w.dq })} title={isDq ? "Restore to the ranking" : "Disqualify — off theme"} aria-label={isDq ? "Restore this wine" : "Disqualify this wine"}
              style={{ display: "block", width: "auto", background: "none", border: "none", cursor: "pointer", color: isDq ? "var(--gold2)" : "var(--wine)", padding: 0, marginTop: 2, marginLeft: "auto", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12 }}>
              <i className={`ti ti-${isDq ? "arrow-back-up" : "ban"}`} style={{ fontSize: 11, marginRight: 3 }} />{isDq ? "restore" : "disqualify"}
            </button>
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

      <div className={`flip${flipped ? " on" : ""}`} style={{ height: 300, margin: "14px 0" }}>
        <div className="flip-inner">
          <button
            className="flip-face"
            onClick={() => setFlipped(true)}
            aria-label="Turn the card and reveal the champion"
            style={{ width: "100%", background: "#000 url(/reveal-back.webp) center / contain no-repeat", border: "none", cursor: "pointer" }}
          />

          <div className="flip-face flip-front" style={{ background: "var(--ink2)", border: "1px solid var(--line2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16 }}>
            <span className="tag">Champion of the moon</span>
            <div className="disp" style={{ fontSize: 19, margin: "8px 0 2px" }}>Bottle {toRoman(champion.cloth)}</div>
            <div style={{ color: "var(--parch)", fontSize: 14 }}>
              <OwnerSlot owner={champion.owner} mine={champion.owner === myName && !!myName} canClaim={!!meId && !myClaim} canAct={canAct}
                onClaim={() => claim(champion.cloth)} onRelease={() => release(champion.cloth)}
                style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 16, color: "var(--gold2)" }} />
            </div>
            <div style={{ marginTop: 4, fontSize: 14 }}>
              <Inline value={champion.title} placeholder="name the wine…" canEdit={canAct} onChange={(v) => patch(champion.cloth, { title: v })} />
            </div>
            <div className="disp" style={{ fontSize: 26, marginTop: 6 }}>{fmtScore(champion)}</div>
          </div>
        </div>
      </div>

      {flipped && rest.slice(0, shown).map((w) => renderRow(w, w.dq ? null : qualified.findIndex((x) => x.cloth === w.cloth) + 1))}

      {flipped && shown >= rest.length && (
        <>
          <div style={{ marginTop: 20 }}>
            {committed ? (
              <p className="whisper" style={{ fontSize: 15, textAlign: "center", margin: 0 }}>
                <i className="ti ti-book" style={{ marginRight: 6 }} />
                Committed to the Annals{isKeiser ? " — only your hand may amend it." : " — only the Keiser may amend it."}
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
          <BottleReveal photos={g?.reveal_photos || []} />
        </>
      )}
    </section>
  );
}
