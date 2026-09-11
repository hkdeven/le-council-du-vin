"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toRoman } from "@/lib/util";
import { useAuth } from "@/components/AuthProvider";
import Loading from "@/components/Loading";
import { useWineCount } from "@/lib/useWineCount";
import { fetchBallot, saveBallot } from "@/lib/ballots";
import { fetchCurrentGathering, riteOpensAt } from "@/lib/gatherings";
import { useRiteOpen } from "@/lib/useRiteOpen";
import type { Gathering } from "@/lib/types";

export default function Rite() {
  const { mode, role, member, sleeping } = useAuth();
  const isKeiser = role === "keiser";
  const meId = mode === "live" ? member?.id ?? null : role === "keiser" ? "m-keiser" : role === "member" ? "m-larissa" : null;

  const [g, setG] = useState<Gathering | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetchCurrentGathering().then((cg) => {
      setG(cg);
      setReady(true);
    });
  }, []);
  // Never a placeholder id: a draft saved against "none" is silently discarded
  // (in live it is not even a uuid), so the orb fills and the verdict is lost.
  // The render guards below keep the card off the screen until `g` is real.
  const gid = g?.id ?? null;
  // Re-renders the moment the rite opens, so the gate below lifts without a refresh.
  const riteOpen = useRiteOpen(g);

  const [total, setTotal] = useWineCount(g);
  const wines = Array.from({ length: total }, (_, i) => i + 1);

  const [current, setCurrent] = useState(1);
  const [scores, setScores] = useState<Record<number, number>>({});
  // Mirrors `scores` so a burst of taps in one tick cannot read a stale copy.
  const scoresRef = useRef<Record<number, number>>({});
  // Kept though nothing writes it any more: ballots sealed before the aroma
  // input was retired still carry marked aromas, and the Nose still counts them.
  const [aromasByWine, setAromasByWine] = useState<Record<number, string[]>>({});
  const [notesByWine, setNotesByWine] = useState<Record<number, string>>({});
  const [sealed, setSealed] = useState(false);
  // Whether this member's ballot has come back. Until it has we know NOTHING
  // about their seal, and the scoring card must not be drawn: a single tap on
  // it wrote sealed:false over a sealed reckoning, wiping every verdict but
  // that one and re-locking the night for the whole table. That is the bug of
  // the first true gathering, reaching through the loading window.
  const [ballotReady, setBallotReady] = useState(false);
  // The last draft save that would not land, shown under the ballot so a
  // member never scores a whole night into a refusal they cannot see.
  const [draftError, setDraftError] = useState<string | null>(null);
  const router = useRouter();

  // Restore a previously sealed (or in-progress) ballot for this member.
  useEffect(() => {
    if (!g) return;
    // No member to load a ballot for: nothing is pending, so nothing is hidden.
    if (!meId) { setBallotReady(true); return; }
    let active = true;
    setBallotReady(false);
    fetchBallot(g.id, meId)
      .then((b) => {
        if (!active) return;
        if (b) {
          scoresRef.current = b.scores || {};
          setScores(b.scores || {});
          setSealed(!!b.sealed);
          if (b.aromas) setAromasByWine(b.aromas);
          if (b.notes) setNotesByWine(b.notes);
        }
        setBallotReady(true);
      })
      // A ballot that cannot be read is not a ballot that does not exist, but
      // holding the card back for ever helps no one: open it and let the seal,
      // which surfaces its errors, be the guard.
      .catch(() => { if (active) setBallotReady(true); });
    return () => { active = false; };
  }, [meId, g]);

  const score = scores[current] ?? 0;
  const notes = notesByWine[current] ?? "";
  const judged = wines.filter((w) => scores[w] != null).length;

  const addWine = () => setTotal(total + 1);
  const removeWine = () => {
    const n = total - 1;
    setTotal(n);
    if (current > n) setCurrent(n);
  };

  // Warm the browser cache for every cloth badge up front so moving between
  // wines is instant (they're otherwise fetched only when first shown).
  useEffect(() => {
    for (let i = 1; i <= Math.min(total, 20); i++) {
      const img = new window.Image();
      img.src = `/cloths/${i}.webp`;
    }
  }, [total]);

  // Set any wine's score — from the focused card or the ballot. Free to revise
  // an earlier wine while judging a later one (relative scoring). Revising a
  // sealed ballot breaks the seal until it is sealed again.
  const setScore = (wine: number, val: number) => {
    // The ref, not the render's `scores`, is the source of truth here. Two orbs
    // tapped in the same tick both close over the SAME stale `scores`, so the
    // second silently discards the first (three taps became one verdict). The
    // ref is moved forward synchronously, so rapid taps accumulate, and the
    // save still gets the whole ballot rather than a fragment of one.
    const next = { ...scoresRef.current, [wine]: val };
    scoresRef.current = next;
    setScores(next);
    // A sleeping hand judges nothing: the draft save was swallowed silently
    // (.catch(() => {})), so a sleeping member could score a whole night and
    // only learn at the seal that none of it was ever written. A refusal now
    // shows as a quiet line under the ballot rather than an alert on every orb.
    if (gid && meId && !sleeping) {
      saveBallot(gid, meId, { scores: next, sealed: false, aromas: aromasByWine, notes: notesByWine })
        .then(() => setDraftError(null))
        .catch((e) => setDraftError((e as Error).message));
    }
    setSealed(false);
  };

  const sealReckoning = async () => {
    if (gid && meId) {
      try {
        await saveBallot(gid, meId, { scores, sealed: true, aromas: aromasByWine, notes: notesByWine });
      } catch (e) {
        alert(`Could not seal your reckoning: ${(e as Error).message}`);
        return;
      }
    }
    setSealed(true);
    // One motion, not two: the seal carries them to the revelation. Going back
    // to score would UNSEAL the ballot (setScore writes sealed:false), which
    // drops the reveal's count and re-locks the night for the whole table.
    router.push("/reveal");
  };

  // Nothing is known until the gathering is: before this the page fell straight
  // through to the scoring card, showing a writable ballot to a member whose
  // rite may not be open, whose gathering may not exist, and whose reckoning may
  // already be sealed. Every guard below now stands on solid ground.
  if (!ready) {
    return <Loading text="Approaching the table…" />;
  }

  if (!g) {
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-glass-full" style={{ fontSize: 30, color: "var(--gold)" }} aria-hidden="true" />
        <p className="whisper" style={{ fontSize: 16, marginTop: 12 }}>
          No gathering is scheduled. The convening comes first.
        </p>
      </section>
    );
  }

  // The rite is sealed until 30 minutes after the gathering's scheduled start.
  if (!riteOpen) {
    const opens = riteOpensAt(g);
    const opensStr = opens.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    return (
      <section style={{ textAlign: "center", padding: "70px 0" }}>
        <i className="ti ti-lock-clock" style={{ fontSize: 32, color: "var(--gold)" }} aria-hidden="true" />
        <h1 className="disp" style={{ fontSize: 18, fontWeight: 500, marginTop: 12 }}>The rite is not yet open</h1>
        <p className="whisper" style={{ fontSize: 16, maxWidth: 380, margin: "10px auto 0" }}>
          Judgement begins half an hour after the gathering convenes. Return at{" "}
          <span className="scr" style={{ color: "var(--gold2)" }}>{opensStr}</span>.
        </p>
      </section>
    );
  }

  // A sealed reckoning is final. The scoring card is not merely disabled but
  // never drawn: touching a single orb would set sealed:false on the ballot,
  // and the table would wait on a member who believed they were done.
  // The seal is unknown until the ballot lands; drawing the card meanwhile is
  // exactly how a sealed reckoning got wiped by one tap.
  if (!ballotReady) {
    return <Loading text="Recalling your reckoning…" />;
  }

  if (sealed) {
    return (
      <section style={{ textAlign: "center", padding: "50px 0" }}>
        <i className="ti ti-lock-check" style={{ fontSize: 32, color: "var(--gold)" }} aria-hidden="true" />
        <h1 className="disp" style={{ fontSize: 18, fontWeight: 500, marginTop: 12 }}>Your reckoning is sealed</h1>
        <p className="whisper" style={{ fontSize: 16, maxWidth: 380, margin: "10px auto 0" }}>
          {judged} verdict{judged === 1 ? "" : "s"} cast, and they stand. No hand may revise them now, not even your own.
        </p>
        <div style={{ maxWidth: 330, margin: "18px auto 0", textAlign: "left" }}>
          {wines.map((w) => (
            <div key={w} className="rk" style={{ padding: "9px 8px" }}>
              <span style={{ width: 74, fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: "0.08em", color: "var(--dim)" }}>
                Wine {toRoman(w)}
              </span>
              <span style={{ flex: 1 }} />
              <span className="disp" style={{ fontSize: 15, color: "var(--gold2)" }}>{scores[w] ?? "—"}</span>
            </div>
          ))}
        </div>
        <Link href="/reveal" className="btn gold" style={{ display: "block", maxWidth: 330, margin: "20px auto 0", textDecoration: "none", textAlign: "center" }}>
          <i className="ti ti-eye" style={{ marginRight: 6 }} />To the revelation
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The rite of judgement</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>
            Judging wine {current} of {total} · {judged} verdict{judged === 1 ? "" : "s"} cast · revise any at will
          </p>
        </div>
        {isKeiser && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <span className="eyebrow" title="Only the Keiser may alter the count">Wines</span>
            <button className="btn" style={{ width: 34, padding: "8px 0", textAlign: "center" }} onClick={removeWine} disabled={total <= 1} aria-label="Remove a wine">
              <i className="ti ti-minus" />
            </button>
            <span className="disp" style={{ fontSize: 18, minWidth: 22, textAlign: "center" }}>{total}</span>
            <button className="btn" style={{ width: 34, padding: "8px 0", textAlign: "center" }} onClick={addWine} aria-label="Add a wine">
              <i className="ti ti-plus" />
            </button>
          </div>
        )}
      </div>

      {/* negative margin lets the card use most of the mobile width (breaks out of the page padding) */}
      <div style={{ margin: "14px -14px 0" }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          backgroundImage: "url(/card-frame.webp)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          paddingTop: "20%",
          paddingBottom: "calc(22% + 90px)",
          paddingLeft: "14%",
          paddingRight: "14%",
          textAlign: "center",
        }}
      >
        {current <= 20 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/cloths/${current}.webp`}
            alt={`Wine ${current}`}
            width={132}
            height={132}
            style={{ display: "block", margin: "0 auto 12px" }}
          />
        ) : (
          <div className="cloth" style={{ margin: "2px auto 16px" }}>{toRoman(current)}</div>
        )}

        <div style={{ textAlign: "center" }}>
          <label className="field" style={{ fontSize: 14, color: "#fff" }}>The verdict</label>
          <div className="orbs mid" style={{ justifyContent: "center" }} role="slider" aria-label={`Score for wine ${current}, out of ten`} aria-valuenow={score} aria-valuemin={1} aria-valuemax={10}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
              <span key={i} className={`orb${i <= score ? " f" : ""}`} onClick={() => setScore(current, i)}>
                {i === score ? i : ""}
              </span>
            ))}
          </div>

          <label className="field" style={{ fontSize: 14, color: "#fff" }}>Aromas</label>
          <textarea
            value={notes}
            disabled={sleeping}
            onChange={(e) => setNotesByWine((m) => ({ ...m, [current]: e.target.value }))}
            onBlur={() => { if (gid && meId && !sleeping) saveBallot(gid, meId, { scores, sealed, aromas: aromasByWine, notes: notesByWine }).then(() => setDraftError(null)).catch((e) => setDraftError((e as Error).message)); }}
            placeholder={sleeping ? "A sleeping hand writes no notes." : "What the wine confessed to you… your words become your Nose."}
          />
        </div>
      </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn" style={{ flex: 1 }} disabled={current <= 1} onClick={() => setCurrent((c) => Math.max(1, c - 1))}>
          <i className="ti ti-arrow-left" /> Wine {current > 1 ? toRoman(current - 1) : "—"}
        </button>
        <button className="btn" style={{ flex: 1 }} disabled={current >= total} onClick={() => setCurrent((c) => Math.min(total, c + 1))}>
          Wine {current < total ? toRoman(current + 1) : "—"} <i className="ti ti-arrow-right" />
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Your ballot</div>
        <p className="whisper" style={{ margin: "0 0 12px", fontSize: 14 }}>
          Tap any wine to revise it: later pours may unseat your earlier favourites.
        </p>
        {wines.map((w) => {
          const s = scores[w] ?? 0;
          const isCurrent = w === current;
          return (
            <div
              key={w}
              className="rk"
              style={{ background: isCurrent ? "rgba(160,150,120,0.08)" : "none", borderRadius: 8, padding: isCurrent ? "11px 8px" : "11px 8px" }}
            >
              <button
                onClick={() => setCurrent(w)}
                aria-label={`Focus wine ${w}`}
                style={{ width: 54, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: "0.08em", color: isCurrent ? "var(--gold2)" : "var(--dim)" }}
              >
                Wine {toRoman(w)}
              </button>
              <div className="orbs sm" style={{ flex: 1 }} role="slider" aria-label={`Score for wine ${w}`} aria-valuenow={s} aria-valuemin={1} aria-valuemax={10}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
                  <span key={i} className={`orb${i <= s ? " f" : ""}`} onClick={() => setScore(w, i)}>
                    {i === s ? i : ""}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {draftError && (
        <p className="whisper" style={{ fontSize: 13, color: "var(--gold2)", margin: "12px 0 0", textAlign: "center" }} role="alert">
          <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} aria-hidden="true" />
          Your last verdict would not be written: {draftError}
        </p>
      )}

      <button
        className="btn gold"
        style={{ marginTop: 14 }}
        disabled={judged < total || sealed || sleeping}
        onClick={sealReckoning}
      >
        {judged < total ? `Seal and continue · ${judged}/${total} judged` : "Seal and continue"}
      </button>
    </section>
  );
}
