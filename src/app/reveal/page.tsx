"use client";

import { useState, useEffect } from "react";
import { seedMembers } from "@/lib/seed";
import { toRoman } from "@/lib/util";
import { fetchAllOfferings, type Offering } from "@/lib/bottles";
import { fetchAllBallots, statsFromBallots, fetchRevealStats, type RevealStats } from "@/lib/ballots";
import { fetchAnnal, commitAnnal, AnnalRow } from "@/lib/annals";
import { fetchCurrentGathering, updateGathering, revealWindowClosed } from "@/lib/gatherings";
import { useRiteOpen } from "@/lib/useRiteOpen";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { sendEmail } from "@/lib/sendEmail";
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
  varietals?: string[]; // carried from the claimed offering
  price?: number | null; // rand, when the owner logged it
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

// Once the night is sealed in the Annals, the reveal page becomes the
// Reckoning: the crowning, the table as it ranked, the split cloth, the
// whispers, and the ledger — with the whole thing sendable to your own inbox.
function ReckoningView({ g, rows, stats, email, onPhotos }: {
  g: Gathering;
  rows: RevealRow[];
  stats: RevealStats;
  email: string | null;
  onPhotos: (next: string[]) => void;
}) {
  const [mailState, setMailState] = useState<"idle" | "sending" | "sent">("idle");
  const qualified = [...rows].filter((r) => !r.dq && r.votes > 0).sort((a, b) => b.score - a.score || a.cloth - b.cloth);
  const dqRows = rows.filter((r) => r.dq);
  const rankOf = (r: RevealRow) => 1 + qualified.filter((x) => x.score > r.score).length;
  const top = qualified[0]?.score ?? 0;
  const champions = top > 0 ? qualified.filter((r) => r.score === top) : [];
  const name = (r: RevealRow) => r.title || `Bottle ${toRoman(r.cloth)}`;

  // The split cloth: widest gap on any wine, three votes or more, gap >= 5.
  const cloths = new Set(rows.map((r) => r.cloth));
  let split: { row: RevealRow; min: number; max: number } | null = null;
  for (const cloth of cloths) {
    const t = stats.totals[cloth];
    if (!t || t.votes < 3) continue;
    const row = rows.find((r) => r.cloth === cloth);
    if (row && t.max - t.min >= 5 && (!split || t.max - t.min > split.max - split.min)) split = { row, min: t.min, max: t.max };
  }
  const splitText = split ? `${name(split.row)} divided the table: one soul gave it a ${split.min}, another a ${split.max}.` : null;

  // The whispers: short, punchy notes from the night, anonymous, three at most.
  const quotes: { text: string; cloth: string }[] = [];
  for (const { cloth, note } of stats.notes) {
    if (!cloths.has(cloth)) continue;
    const t = note.trim();
    if (t.length >= 15 && t.length <= 140) quotes.push({ text: t, cloth: toRoman(cloth) });
  }
  quotes.sort((a, b) => a.text.length - b.text.length);
  const chosen = quotes.slice(0, 3);

  // The ledger: best score per hundred rand, when prices were confided.
  const priced = qualified.filter((r) => (r.price ?? 0) > 0);
  let value: string | null = null;
  if (priced.length >= 2) {
    const best = [...priced].sort((a, b) => b.score / b.price! - a.score / a.price!)[0];
    value = `Best value of the night: ${name(best)} at R${best.price} — ${(best.score / best.price! * 100).toFixed(1)} points per hundred rand.`;
  }

  const mailIt = async () => {
    if (!email || mailState === "sending") return;
    setMailState("sending");
    const res = await sendEmail("reckoning", [email], {
      numberRoman: toRoman(g.number || 0),
      theme: g.theme_title || "",
      dateLabel: g.gather_date ? new Date(g.gather_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "",
      crowned: champions.map((c) => ({ title: name(c), owner: c.owner, score: c.score })),
      ranked: [
        ...qualified.filter((r) => !champions.includes(r)).map((r) => ({ rank: toRoman(rankOf(r)), title: name(r), owner: r.owner, score: r.score, dq: false })),
        ...dqRows.map((r) => ({ rank: "✕", title: name(r), owner: r.owner, score: null, dq: true })),
      ],
      split: splitText || undefined,
      quotes: chosen,
      value: value || undefined,
    });
    if (res.ok) setMailState("sent");
    else { setMailState("idle"); alert(`The reckoning would not send: ${res.error || res.skipped || "unknown"}`); }
  };

  // Gold-ruled section band, echoing the email's design (the Keiser's pick).
  const Band = ({ children }: { children: React.ReactNode }) => (
    <div style={{ borderTop: "1px solid var(--gold)", borderBottom: "1px solid var(--gold)", padding: "8px 6px", margin: "20px 0 14px", textAlign: "center" }}>
      <span className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.2em" }}>{children}</span>
    </div>
  );

  return (
    <section style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
      <h1 className="disp" style={{ fontSize: 20, fontWeight: 500 }}>The Reckoning</h1>
      <p className="scr" style={{ color: "var(--gold)", fontStyle: "italic", fontSize: 15, marginTop: 2 }}>
        Gathering {toRoman(g.number || 0)} · {g.theme_title} · sealed in the Annals
      </p>

      <Band>The Crowning</Band>
      {champions.length === 0 ? (
        <p className="whisper" style={{ margin: 0, fontSize: 15 }}>No champion this moon.</p>
      ) : champions.map((c) => (
        <p key={c.cloth} style={{ margin: "0 0 6px", fontSize: 16, color: "var(--parch)" }}>
          🏆 <span className="scr" style={{ fontSize: 18, color: "var(--gold2)" }}>{name(c)}</span>
          {c.owner && <span className="whisper" style={{ fontSize: 14 }}> — borne by {c.owner}</span>}
          <span className="disp" style={{ fontSize: 14, marginLeft: 8 }}>{c.score.toFixed(1)}</span>
        </p>
      ))}

      {g.prophecy && champions.length > 0 && (() => {
        const right = champions.some((c) => c.owner === g.prophecy!.name);
        return (
          <p className="scr" style={{ fontStyle: "italic", fontSize: 14.5, color: right ? "var(--gold2)" : "var(--dim)", margin: "12px 0 0" }}>
            <i className="ti ti-crystal-ball" style={{ fontSize: 13, marginRight: 5 }} />
            {right
              ? `The vine foresaw it: ${g.prophecy.name} crowned, as prophesied.`
              : `The vine is humbled. It named ${g.prophecy.name}; the table crowned ${champions.map((c) => c.owner || "an unclaimed hand").join(" & ")}.`}
          </p>
        );
      })()}

      <Band>As the table ranked them</Band>
      <div style={{ textAlign: "left" }}>
        {[...qualified, ...dqRows].map((r) => (
          <div key={r.cloth} style={{ display: "flex", gap: 8, fontSize: 14, padding: "5px 0", alignItems: "center", color: r.dq ? "var(--wine)" : "var(--parch)", borderBottom: "1px solid var(--line)" }}>
            <span className="disp" style={{ width: 24, fontSize: 11, color: r.dq ? "var(--wine)" : "var(--gold2)" }}>{r.dq ? "✕" : toRoman(rankOf(r))}</span>
            <span style={{ flex: 1 }}>
              <span className="scr" style={{ fontSize: 15 }}>{name(r)}</span>
              {r.owner && <span style={{ color: "var(--dim)" }}> · {r.owner}</span>}
              {split?.row.cloth === r.cloth && <i className="ti ti-bolt" style={{ color: "var(--gold2)", fontSize: 12, marginLeft: 5 }} />}
              {r.dq && <span className="whisper" style={{ fontSize: 12, color: "var(--wine)" }}> · cast out</span>}
            </span>
            <span className="disp" style={{ fontSize: 12, color: "var(--gold2)" }}>{r.dq ? "—" : r.score.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {splitText && (
        <>
          <Band>The split cloth</Band>
          <p style={{ margin: 0, fontSize: 15, color: "var(--parch)" }}>⚡ {splitText}</p>
        </>
      )}

      {chosen.length > 0 && (
        <>
          <Band>The table&rsquo;s whispers</Band>
          <div style={{ textAlign: "left" }}>
            {chosen.map((q, i) => (
              <p key={i} className="scr" style={{ margin: "0 0 10px", fontSize: 16, fontStyle: "italic", color: "var(--parch)" }}>
                &ldquo;{q.text}&rdquo; <span className="whisper" style={{ fontSize: 13 }}>— on cloth {q.cloth}</span>
              </p>
            ))}
          </div>
        </>
      )}

      {value && (
        <>
          <Band>The ledger</Band>
          <p style={{ margin: 0, fontSize: 15, color: "var(--parch)" }}>{value}</p>
        </>
      )}

      <BottleReveal
        photos={g.reveal_photos || []}
        gatheringId={g.id}
        onPhotos={onPhotos}
      />

      <button className="btn" style={{ width: "auto", padding: "10px 22px", marginTop: 18 }}
        onClick={() => { if (!email) { alert("The demo has no post office: sign in on the live Council and the reckoning will fly."); return; } mailIt(); }}
        disabled={mailState === "sending"}>
        <i className="ti ti-mail" style={{ fontSize: 14, marginRight: 6 }} />
        {mailState === "sent" ? "It flies to your inbox" : mailState === "sending" ? "Sending…" : "Email this to me"}
      </button>
      <p className="whisper" style={{ margin: "14px 0 0", fontSize: 12 }}>the vine calculates, it does not flatter</p>
    </section>
  );
}

export default function Reveal() {
  const { mode, role, member, email } = useAuth();
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

  useEffect(() => {
    fetchCurrentGathering().then((cg) => {
      setG(cg);
      setReady(true);
    });
  }, []);
  const gid = g?.id ?? "none";
  const attendees = g?.attendees || [];

  // A week after the night ends, the reveal is gone entirely (#7): direct
  // links are turned away. The vote data itself stays in the database — the
  // codex and every tally still read it; only this page's presentation goes.
  const windowClosed = revealWindowClosed(g);
  useEffect(() => {
    if (ready && windowClosed) router.replace("/convene");
  }, [ready, windowClosed, router]);

  const [wineCount] = useWineCount(g);

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
        fetchAllOfferings(g.id),
        fetchAnnal(g.id),
      ]);
      if (!active) return;
      setStats(st);
      setOfferings(offs);
      if (annal) {
        setRows(annal.rows.map((r, i) => ({ cloth: r.cloth ?? i + 1, title: r.title, owner: r.owner, score: r.score, votes: r.votes, dq: r.dq, varietals: r.varietals, price: r.price })));
        setCommitted(true);
      } else {
        setRows(Array.from({ length: wineCount }, (_, i) => i + 1).map((cloth) => ({
          cloth, title: "", owner: "",
          score: st.totals[cloth]?.avg || 0, votes: st.totals[cloth]?.votes || 0, dq: false,
        })));
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, wineCount, mode, role]);

  // The reveal opens only when the rite itself is open AND every attendee has
  // sealed — or once committed. Before the rite there is nothing to reveal.
  const riteOpen = useRiteOpen(g);
  const sealedCount = stats.sealedIds.filter((id) => attendees.includes(id)).length;
  const locked = !committed && (!riteOpen || attendees.length === 0 || sealedCount < attendees.length);

  // While still sealed, poll for newly-sealed ballots so the reveal unlocks and
  // tallies live — no refresh needed. Stops the moment it opens (so it never
  // clobbers the Keiser's claims/disqualifications, which only happen after).
  useEffect(() => {
    if (!g || committed || !locked) return;
    const iv = setInterval(async () => {
      const st = await loadStats(g.id);
      setStats(st);
      setRows(Array.from({ length: wineCount }, (_, i) => i + 1).map((cloth) => ({
        cloth, title: "", owner: "", score: st.totals[cloth]?.avg || 0, votes: st.totals[cloth]?.votes || 0, dq: false,
      })));
    }, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, committed, locked, wineCount, mode, role]);

  // Ranking is computed, never stored. Ties share a rank (competition style:
  // two 2nds → next is 4th), and a tie for the top score crowns co-champions.
  const qualified = [...rows].filter((r) => !r.dq).sort((a, b) => b.score - a.score || a.cloth - b.cloth);
  const dqRows = rows.filter((r) => r.dq);
  const rankOf = (row: RevealRow) => 1 + qualified.filter((x) => x.score > row.score).length;
  const topScore = qualified[0]?.score ?? 0;
  const champions = topScore > 0 ? qualified.filter((r) => r.score === topScore) : [];
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
    const q = data.filter((r) => !r.dq);
    // Shared ranking, so co-champions both record rank 1 (each earns a chalice).
    const rank = (r: RevealRow) => 1 + q.filter((x) => x.score > r.score).length;
    await commitAnnal({
      gatheringId: g!.id,
      number: g!.number,
      theme: g!.theme_title,
      date: g!.gather_date,
      committed_at: new Date().toISOString(),
      rows: data.map((r): AnnalRow => ({
        cloth: r.cloth, owner: r.owner, title: r.title, score: r.score, votes: r.votes,
        dq: r.dq, rank: r.dq ? null : rank(r),
        varietals: r.varietals?.length ? r.varietals : undefined,
        price: r.price ?? undefined,
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
    const mine = offerings[meId];
    persist(rows.map((r) => (r.cloth === cloth ? {
      ...r,
      owner: myName,
      title: r.title || mine?.title || "",
      varietals: r.varietals?.length ? r.varietals : mine?.varietals,
      price: r.price ?? mine?.price ?? undefined,
    } : r)));
  };
  const release = (cloth: number) => {
    if (!meId) return;
    const mine = offerings[meId];
    persist(rows.map((r) => (r.cloth === cloth && r.owner === myName ? { ...r, owner: "", title: r.title === mine?.title ? "" : r.title, varietals: undefined, price: undefined } : r)));
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
            : attendees.length === 0
            ? "No souls have answered the call. RSVP on the convening, then judge in the rite."
            : `${sealedCount} of ${attendees.length} ballots have been sealed. The cloths are not lifted until every soul has judged.`}
        </p>
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

      <div className={`flip${flipped ? " on" : ""}`} style={{ height: champions.length > 1 ? 340 : 300, margin: "14px 0" }}>
        <div className="flip-inner">
          <button
            className="flip-face"
            onClick={() => setFlipped(true)}
            aria-label="Turn the card and reveal the champion"
            style={{ width: "100%", background: "#000 url(/reveal-back.webp) center / contain no-repeat", border: "none", cursor: "pointer" }}
          />

          <div className="flip-face flip-front" style={{ background: "var(--ink2)", border: "1px solid var(--line2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16, overflowY: "auto" }}>
            <span className="tag">{champions.length > 1 ? `Champions of the moon · tied` : "Champion of the moon"}</span>
            {champions.length === 0 ? (
              <div className="whisper" style={{ marginTop: 10, fontSize: 15 }}>No champion this moon.</div>
            ) : champions.map((champ, idx) => (
              <div key={champ.cloth} style={{ marginTop: idx === 0 ? 8 : 10, ...(idx > 0 ? { borderTop: "1px solid var(--line)", paddingTop: 10, width: "100%" } : {}) }}>
                <div className="disp" style={{ fontSize: champions.length > 1 ? 17 : 19, margin: "0 0 2px" }}>Bottle {toRoman(champ.cloth)}</div>
                <div style={{ color: "var(--parch)", fontSize: 14 }}>
                  <OwnerSlot owner={champ.owner} mine={champ.owner === myName && !!myName} canClaim={!!meId && !myClaim} canAct={canAct}
                    onClaim={() => claim(champ.cloth)} onRelease={() => release(champ.cloth)}
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 16, color: "var(--gold2)" }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 14 }}>
                  <Inline value={champ.title} placeholder="name the wine…" canEdit={canAct} onChange={(v) => patch(champ.cloth, { title: v })} />
                </div>
                <div className="disp" style={{ fontSize: champions.length > 1 ? 22 : 26, marginTop: 4 }}>{fmtScore(champ)}</div>
                {isKeiser && canAct && (
                  <button onClick={() => patch(champ.cloth, { dq: true })} title="Disqualify — off theme" aria-label="Disqualify this wine"
                    style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--wine)", padding: 0, marginTop: 4, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12 }}>
                    <i className="ti ti-ban" style={{ fontSize: 11, marginRight: 3 }} />disqualify
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {flipped && rest.slice(0, shown).map((w) => renderRow(w, w.dq ? null : rankOf(w)))}

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
