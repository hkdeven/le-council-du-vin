"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { fetchDqCounts, DQ_THRESHOLD } from "@/lib/annals";
import { loadApplications, updateApplication } from "@/lib/applications";
import { addMember, loadMembers } from "@/lib/members";
import { sunSign } from "@/lib/astrology";
import { sendEmail } from "@/lib/sendEmail";
import { useAuth } from "@/components/AuthProvider";
import MoonDivider from "@/components/MoonDivider";
import MemberCard from "@/components/MemberCard";
import Avatar from "@/components/Avatar";
import PortraitLightbox from "@/components/PortraitLightbox";
import { useBodyLock } from "@/components/NatalChart";
import { castCounsel } from "@/lib/applications";
import { computeAugury } from "@/lib/augury";
import { seedMembers } from "@/lib/seed";
import type { Application, Member } from "@/lib/types";
import { useLayoutEffect, useMemo, useRef } from "react";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// An expulsion hearing: a member who has hit the disqualification threshold.
// Every member votes to keep or cast out; the Keiser decrees the end of it.
function ExpulsionCard({ name, count }: { name: string; count: number }) {
  const [votes, setVotes] = useState<{ keep: number; out: number }>({ keep: 0, out: 0 });
  const [myVote, setMyVote] = useState<"keep" | "out" | null>(null);
  const [verdict, setVerdict] = useState<"kept" | "expelled" | null>(null);

  const vote = (v: "keep" | "out") => {
    if (myVote === v) return;
    setVotes((x) => ({
      keep: x.keep + (v === "keep" ? 1 : 0) - (myVote === "keep" ? 1 : 0),
      out: x.out + (v === "out" ? 1 : 0) - (myVote === "out" ? 1 : 0),
    }));
    setMyVote(v);
  };

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: "var(--wine)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <MemberCard member={{ cult_name: name }} size={40} />
        <div>
          <div className="disp" style={{ fontSize: 16 }}>{name}</div>
          <div className="whisper" style={{ fontSize: 14, color: "var(--wine)" }}>
            {count} wines cast out for breaking theme · the threshold of {DQ_THRESHOLD} is met
          </div>
        </div>
      </div>
      {verdict ? (
        <p className="scr" style={{ margin: 0, fontSize: 16 }}>
          {verdict === "kept" ? "The Council shows mercy: they remain, on thinnest ice." : "The seat is forfeit. Their glass is emptied."}
        </p>
      ) : (
        <>
          <p className="whisper" style={{ margin: "0 0 10px", fontSize: 14 }}>
            All members must vote: keep them, or take them out.
          </p>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button className={`btn${myVote === "keep" ? " gold" : ""}`} style={{ flex: 1 }} onClick={() => vote("keep")}>
              Keep them · {votes.keep}
            </button>
            <button className="btn danger" style={{ flex: 1 }} onClick={() => vote("out")}>
              Take them out · {votes.out}
            </button>
          </div>
          <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>The decree is the Keiser&rsquo;s alone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setVerdict("kept")}>Decree: mercy</button>
            <button className="btn danger" style={{ flex: 1 }} onClick={() => setVerdict("expelled")}>Decree: expulsion</button>
          </div>
        </>
      )}
    </div>
  );
}

const initialsOf = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// The answers a petitioner gave at the gate — shown on the pending card and,
// once decided, when their row is expanded.
function PetitionAnswers({ a }: { a: Application }) {
  const block = (q: string, ans: string) => (
    <div style={{ textAlign: "left", background: "#0d0b0a", border: "1px solid var(--line)", borderRadius: 10, padding: "11px 14px", marginBottom: 8 }}>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 3 }}>{q}</div>
      <div style={{ fontSize: 14.5, color: "var(--parch)", lineHeight: 1.5 }}>{ans}</div>
    </div>
  );
  if (!a.wine_sin && !a.if_wine && !a.draw_reason) {
    return <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No answers were recorded with this petition.</p>;
  }
  return (
    <>
      {a.wine_sin && block("Their gravest wine sin", a.wine_sin)}
      {a.if_wine && block("If they were a wine", a.if_wine)}
      {a.draw_reason && block("What draws them to the Council", a.draw_reason)}
    </>
  );
}

const chartComplete = (x: { date_of_birth?: string | null; time_of_birth?: string | null; birth_lat?: number | null; birth_lon?: number | null }) =>
  !!x.date_of_birth && !!x.time_of_birth && x.birth_lat != null && x.birth_lon != null;

// The tally, derived from the kept votes (legacy seed tallies as fallback).
function tallyOf(a: Application): { anoint: number; cast_out: number; abstain: number } {
  const votes = Object.values(a.votes || {});
  if (!votes.length && a.tally) return a.tally;
  return {
    anoint: votes.filter((v) => v === "anoint").length,
    cast_out: votes.filter((v) => v === "cast_out").length,
    abstain: votes.filter((v) => v === "abstain").length,
  };
}

// The petitioner's card: rises animated; the Augury turns it over.
function PetitionerModal({ a, portrait, members, isKeiser, myId, onClose, onDecree, onCounsel, onSetDate }: {
  a: Application;
  portrait: string | null;
  members: Member[];
  isKeiser: boolean;
  myId: string | null;
  onClose: () => void;
  onDecree: (a: Application, status: "anointed" | "cast_out") => void;
  onCounsel: (a: Application, vote: "anoint" | "cast_out" | "abstain") => void;
  onSetDate: (a: Application, dateStr: string) => void;
}) {
  useBodyLock();
  const [shown, setShown] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [auguryOnce, setAuguryOnce] = useState(false);
  // Their portrait, enlarged — the same lightbox as the full member card (#9).
  // Escape closes the photo first, then the card.
  const [photoOpen, setPhotoOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (photoOpen ? setPhotoOpen(false) : close());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoOpen]);
  const close = () => { setShown(false); setTimeout(onClose, 240); };

  const overlayRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [faceHeight, setFaceHeight] = useState<number | undefined>(undefined);
  const flipTo = (to: boolean) => {
    if (to) setAuguryOnce(true);
    setFlipped(to);
    // Snap the overlay to the top at mid-flip, while the card is edge-on:
    // an instant jump the eye never sees. Smooth scrolling fired with the
    // flip was dropped on mobile (the height and rotate transitions run at
    // the same moment), which left the reader mid-card.
    setTimeout(() => { const el = overlayRef.current; if (el) el.scrollTop = 0; }, 330);
  };
  useLayoutEffect(() => {
    const active = flipped ? backRef.current : frontRef.current;
    if (!active) return;
    const sync = () => setFaceHeight(active.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(active);
    return () => ro.disconnect();
  }, [flipped, auguryOnce]);
  const faceStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, width: "100%",
    backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
    background: "linear-gradient(180deg,#12100e,#0a0908)", border: "1px solid var(--gold)", borderRadius: 14,
    boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 20px 60px rgba(0,0,0,0.7)", padding: "22px 18px 24px", textAlign: "center",
  };

  const augury = useMemo(
    () => (auguryOnce ? computeAugury(a, members, Date.now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auguryOnce, a.id]
  );
  const tally = tallyOf(a);
  const myVote = myId ? a.votes?.[myId] : undefined;
  const pending = a.status === "pending";
  const s = a.date_of_birth ? sunSign(a.date_of_birth) : null;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.cult_name || null;
  const votedNames = (v: "anoint" | "cast_out" | "abstain") =>
    Object.entries(a.votes || {}).filter(([, x]) => x === v).map(([id]) => nameOf(id)).filter(Boolean).join(", ") || "—";

  const counselBtn = (v: "anoint" | "cast_out" | "abstain", label: string, danger?: boolean) => (
    <button
      className={`btn${myVote === v ? " gold" : danger ? " danger" : ""}`}
      style={{ flex: 1 }}
      onClick={() => onCounsel(a, v)}
    >
      {label}
    </button>
  );

  return (
    <div ref={overlayRef} className="modal-scroll" onClick={close} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", overflowY: "auto", display: "flex", padding: 18, opacity: shown ? 1 : 0, transition: "opacity 0.22s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 340, margin: "auto", transformStyle: "preserve-3d", transform: `perspective(1500px) ${shown ? "scale(1)" : "scale(0.9)"} rotateY(${flipped ? 180 : 0}deg)`, transition: "transform 0.65s cubic-bezier(0.4,0.1,0.2,1), height 0.4s ease", transformOrigin: "center", height: faceHeight }}>

        {/* FRONT: the petition. */}
        <div ref={frontRef} style={{ ...faceStyle, pointerEvents: flipped ? "none" : undefined }}>
          <button onClick={close} aria-label="Close" style={{ position: "absolute", top: 8, right: 8, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 6, zIndex: 2 }}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            {portrait ? (
              <button onClick={() => setPhotoOpen(true)} aria-label="Enlarge their portrait"
                style={{ width: "auto", background: "none", border: "none", padding: 0, cursor: "zoom-in", display: "flex" }}>
                <Avatar src={portrait} initials={initialsOf(a.cult_name)} size={72} />
              </button>
            ) : (
              <Avatar src={portrait} initials={initialsOf(a.cult_name)} size={72} />
            )}
          </div>
          <div className="disp" style={{ fontSize: 19 }}>{a.cult_name}</div>
          {a.date_of_birth && (
            <p className="whisper" style={{ margin: "2px 0 0" }}>
              Born {fmtDate(a.date_of_birth)}{s ? ` · ${s.symbol} ${s.name}` : ""}
            </p>
          )}

          <div style={{ borderTop: "1px solid var(--line)", margin: "14px 0 12px" }} />
          <PetitionAnswers a={a} />

          <div style={{ display: "flex", gap: 12, margin: "14px 0", padding: "11px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
            <Tally n={tally.anoint} label="anoint" color="var(--gold2)" />
            <Tally n={tally.cast_out} label="cast out" color="var(--wine)" />
            <Tally n={tally.abstain} label="abstain" color="var(--dim)" />
          </div>

          {pending && myId && (
            <>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Your counsel</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {counselBtn("anoint", "Anoint")}
                {counselBtn("cast_out", "Cast out", true)}
                {counselBtn("abstain", "Abstain")}
              </div>
            </>
          )}

          {pending && isKeiser && (
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button className="btn gold" style={{ flex: 1 }} onClick={() => onDecree(a, "anointed")}>Anoint as initiate</button>
              <button className="btn danger" style={{ flex: 1 }} onClick={() => onDecree(a, "cast_out")}>Cast out</button>
            </div>
          )}

          {!pending && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, textAlign: "left", marginBottom: 12 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>How the Council counselled</div>
              {(["anoint", "cast_out", "abstain"] as const).map((v) => (
                <div key={v} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  <span style={{ flex: "none", width: 76, fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: v === "anoint" ? "var(--gold2)" : v === "cast_out" ? "#c17b80" : "var(--dim)" }}>{v.replace("_", " ")}</span>
                  <span style={{ flex: 1, fontFamily: "'Cormorant Garamond',serif", fontSize: 14, color: "var(--parch)" }}>{votedNames(v)}</span>
                </div>
              ))}
              <p className="whisper" style={{ margin: "6px 0 0", fontSize: 12 }}>the record is kept once the decree falls; the Council votes in the light</p>
            </div>
          )}

          {!pending && a.status === "anointed" && isKeiser && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, textAlign: "left", marginBottom: 12 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Date of anointment · Keiser only</div>
              <input type="date" value={(a.anointed_at || "").slice(0, 10)} onChange={(e) => onSetDate(a, e.target.value)} style={{ colorScheme: "dark", maxWidth: 220 }} />
            </div>
          )}

          <div style={{ borderTop: "2px solid var(--gold)", margin: "14px -18px 16px" }} />
          {chartComplete(a) ? (
            <button className="btn lcv-shimmer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => flipTo(true)}>
              <i className="ti ti-eye" style={{ fontSize: 15 }} />Consult the Augury
            </button>
          ) : (
            <p className="whisper" style={{ margin: 0, fontSize: 13 }}>the sky is veiled for this petition; the Augury needs a full birth record</p>
          )}
          {pending && <p className="whisper" style={{ margin: "10px 0 0", fontSize: 13 }}>the decree is the Keiser&rsquo;s alone</p>}
        </div>

        {/* BACK: the Augury. */}
        <div ref={backRef} style={{ ...faceStyle, transform: "rotateY(180deg)", pointerEvents: flipped ? undefined : "none" }}>
          <button onClick={() => flipTo(false)} aria-label="Back to the petition" title="Back to the petition" style={{ position: "absolute", top: 6, left: 6, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 12, zIndex: 2 }}>
            <i className="ti ti-arrow-back-up" style={{ fontSize: 18 }} />
          </button>
          <button onClick={close} aria-label="Close" style={{ position: "absolute", top: 8, right: 8, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 6, zIndex: 2 }}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
          <div className="disp" style={{ fontSize: 19, marginTop: 6 }}>The Augury</div>
          <p className="whisper" style={{ margin: "2px 0 12px" }}>what the sky says of {a.cult_name}, computed against the Council&rsquo;s</p>

          {!augury ? (
            <p className="whisper" style={{ margin: 0, fontSize: 14 }}>the sky is veiled; the Augury needs a full birth record</p>
          ) : (
            <>
              {augury.accord && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)" }}>Accord with the table</span>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", color: "var(--gold2)", fontSize: 15 }}>{augury.accord.total % 1 ? `${Math.floor(augury.accord.total)}½` : augury.accord.total} of 36 · {augury.accord.verdict}</span>
                </div>
              )}
              {augury.easiest && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)" }}>Sits easiest beside</span>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", color: "var(--gold2)", fontSize: 15 }}>{augury.easiest.name} · {augury.easiest.total % 1 ? `${Math.floor(augury.easiest.total)}½` : augury.easiest.total} of 36</span>
                </div>
              )}
              {augury.hardest && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", textAlign: "left" }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)" }}>Hardest beside</span>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", color: "var(--dim)", fontSize: 15 }}>{augury.hardest.name} · {augury.hardest.total % 1 ? `${Math.floor(augury.hardest.total)}½` : augury.hardest.total} of 36</span>
                </div>
              )}
              {!augury.accord && (
                <p className="whisper" style={{ margin: "0 0 4px", fontSize: 13 }}>no complete member charts to compare against yet</p>
              )}
              <MoonDivider />
              <p style={{ fontSize: 15, lineHeight: 1.58, textAlign: "left", color: "#ddd7c9", fontFamily: "'EB Garamond',serif", margin: "0 0 10px" }}>
                <span style={{ color: "var(--gold2)" }}>The palate omen:</span> {augury.palate}
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.58, textAlign: "left", color: "#ddd7c9", fontFamily: "'EB Garamond',serif", margin: 0 }}>
                <span style={{ color: "var(--gold2)" }}>The shadow:</span> {augury.shadow}
              </p>
            </>
          )}

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 10 }}>
            <button onClick={() => flipTo(false)} style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto", background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 10px" }}>
              <i className="ti ti-arrow-back-up" style={{ color: "var(--gold)", fontSize: 14 }} />Turn the card back
            </button>
          </div>
        </div>
      </div>
      {/* Sibling of the flipping card, never inside it (the transform would
          become the containing block for the fixed overlay). */}
      {photoOpen && portrait && (
        <PortraitLightbox src={portrait} alt={`${a.cult_name}'s portrait`} onClose={() => setPhotoOpen(false)} />
      )}
    </div>
  );
}

export default function Tribunal() {
  const { mode, role, member } = useAuth();
  const isKeiser = role === "keiser";
  const [apps, setApps] = useState<Application[]>([]);
  const [dq, setDq] = useState<Record<string, number>>({});
  // The roster, in full: names the vote record, feeds the Augury, and tells
  // us which anointed petitions still belong to living members.
  const [members, setMembers] = useState<Member[]>([]);
  const memberEmails = new Set(members.map((m) => m.email.toLowerCase()));
  const myId = mode === "live" ? member?.id || null : seedMembers.find((sm) => sm.role === role)?.id || null;
  // Which petitioner's card is risen.
  const [openApp, setOpenApp] = useState<string | null>(null);

  useEffect(() => {
    fetchDqCounts().then(setDq);
    // Live: petitions live in Supabase (submitted from anyone's browser).
    // Demo: they live in this browser's localStorage.
    if (mode === "live" && supabase) {
      supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error("Could not load petitions:", error.message);
          else if (data) setApps(data as Application[]);
        });
      supabase.from("members").select("id,email,cult_name,short_name,role,active,avatar_url,date_of_birth,time_of_birth,birth_place,birth_lat,birth_lon,birth_tz").then(({ data }) => {
        if (data) setMembers(data as Member[]);
      });
    } else {
      setApps(loadApplications());
      setMembers(loadMembers());
    }
  }, [mode]);

  // A member's counsel: optimistic locally, the RPC (or demo store) behind it.
  const counsel = async (a: Application, vote: "anoint" | "cast_out" | "abstain") => {
    if (!myId || a.status !== "pending") return;
    setApps((prev) => prev.map((x) => (x.id === a.id ? { ...x, votes: { ...(x.votes || {}), [myId]: vote } } : x)));
    const err = await castCounsel(a.id, myId, vote);
    if (err) alert(`The counsel would not take: ${err}`);
  };

  const decree = async (a: Application, status: "anointed" | "cast_out") => {
    // Anointing grants limited access: a new initiate joins the roster, whom the
    // Keiser can later elevate to full member from the profile roster.
    if (status === "anointed") {
      const member: Member = {
        id: `m-${a.id}`,
        email: a.email,
        cult_name: a.cult_name,
        short_name: initialsOf(a.cult_name),
        role: "initiate",
        date_of_birth: a.date_of_birth || null,
        time_of_birth: a.time_of_birth || null,
        birth_place: a.birth_place || null,
        birth_lat: a.birth_lat ?? null,
        birth_lon: a.birth_lon ?? null,
        birth_tz: a.birth_tz || null,
        active: true,
      };
      if (mode === "live" && supabase) {
        const { error } = await supabase.from("members").upsert(
          { email: member.email, cult_name: member.cult_name, short_name: member.short_name, role: "initiate", date_of_birth: member.date_of_birth, time_of_birth: member.time_of_birth, birth_place: member.birth_place, birth_lat: member.birth_lat, birth_lon: member.birth_lon, birth_tz: member.birth_tz, active: true },
          { onConflict: "email" }
        );
        // Surface the real reason instead of silently failing (e.g. an RLS
        // policy that won't let the Keiser create the member row).
        if (error) {
          alert(`Could not anoint ${a.cult_name}: ${error.message}`);
          return;
        }
      } else {
        addMember(member);
      }
    }
    // Stamp the moment of anointment so the record shows when they were raised.
    const patch: Partial<Application> = { status };
    if (status === "anointed") patch.anointed_at = new Date().toISOString();
    if (mode === "live" && supabase) {
      const { error } = await supabase.from("applications").update(patch).eq("id", a.id);
      if (error) {
        alert(`Could not record the decree: ${error.message}`);
        return;
      }
    } else {
      updateApplication(a.id, patch);
    }
    setApps((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    // The decided list filters anointed rows to current members; add the new
    // initiate locally so they appear at once, without a refresh.
    if (status === "anointed" && a.email) {
      setMembers((prev) => prev.some((m) => m.email.toLowerCase() === a.email.toLowerCase())
        ? prev
        : [...prev, { id: `pending-${a.id}`, email: a.email, cult_name: a.cult_name, short_name: "", role: "initiate", active: true } as Member]);
    }
    window.dispatchEvent(new Event("lcv-applications")); // refresh the nav badge
    // Welcome the newly anointed by email (no-ops until Resend is configured).
    if (status === "anointed" && a.email) {
      sendEmail("anoint", [a.email], { name: a.cult_name }).catch(() => {});
    }
  };

  // Set or amend an anointment date (e.g. backfill records anointed before it
  // was captured). Empty clears it.
  const setAnointDate = async (a: Application, dateStr: string) => {
    const anointed_at = dateStr || null;
    if (mode === "live" && supabase) {
      const { error } = await supabase.from("applications").update({ anointed_at }).eq("id", a.id);
      if (error) { alert(`Could not save the date: ${error.message}`); return; }
    } else {
      updateApplication(a.id, { anointed_at });
    }
    setApps((prev) => prev.map((x) => (x.id === a.id ? { ...x, anointed_at } : x)));
  };

  const pending = apps.filter((a) => a.status === "pending");
  // One row per soul: a petitioner who filed twice appears once, wearing the
  // anointed record if any, otherwise the most recent word on them.
  const decided = (() => {
    const best = new Map<string, Application>();
    for (const a of apps) {
      if (a.status === "pending") continue;
      if (a.status !== "cast_out" && !memberEmails.has(a.email.toLowerCase())) continue;
      const key = a.email.toLowerCase() || a.id;
      const prev = best.get(key);
      const wins = !prev
        || (a.status === "anointed" && prev.status !== "anointed")
        || (a.status === prev.status && (a.created_at || "") > (prev.created_at || ""));
      if (wins) best.set(key, a);
    }
    return [...best.values()];
  })();
  const summoned = Object.entries(dq).filter(([, n]) => n >= DQ_THRESHOLD);
  const opened = apps.find((a) => a.id === openApp) || null;
  // A petitioner who became (or already is) a member wears their portrait.
  const portraitOf = (a: Application) =>
    members.find((m) => m.email.toLowerCase() === a.email.toLowerCase())?.avatar_url || null;

  const row = (a: Application, sub: React.ReactNode, right: React.ReactNode) => (
    <button key={a.id} onClick={() => setOpenApp(a.id)}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "1px solid var(--line2)", borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left", color: "inherit" }}>
      <Avatar src={portraitOf(a)} initials={initialsOf(a.cult_name)} size={40} />
      <span style={{ flex: 1 }}>
        <span className="disp" style={{ fontSize: 15, display: "block" }}>{a.cult_name}</span>
        <span className="whisper" style={{ fontSize: 13 }}>{sub}</span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flex: "none" }}>
        {right}
        <i className="ti ti-chevron-right" style={{ color: "var(--gold)" }} />
      </span>
    </button>
  );

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The tribunal</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        Souls stand before the Council. Your vote counsels the Keiser; the decree is his alone.
      </p>

      <div className="eyebrow" style={{ marginBottom: 8 }}>Awaiting judgement</div>
      {pending.length === 0 && (
        <p className="whisper" style={{ fontSize: 15, marginTop: 0 }}>No souls await judgement. The gate is quiet.</p>
      )}
      {pending.map((a) => {
        const t = tallyOf(a);
        const n = t.anoint + t.cast_out + t.abstain;
        const s = a.date_of_birth ? sunSign(a.date_of_birth) : null;
        return row(
          a,
          <>{a.date_of_birth ? `Born ${fmtDate(a.date_of_birth)}${s ? ` · ${s.symbol} ${s.name}` : ""}` : "the sky unrecorded"}</>,
          <span className="tag">{n === 1 ? "1 vote in" : `${n} votes in`}</span>
        );
      })}

      <MoonDivider />
      <div className="eyebrow" style={{ marginBottom: 2 }}>Past petitioners</div>
      <p className="whisper" style={{ margin: "0 0 8px", fontSize: 13 }}>judged and recorded; tap to revisit their petition</p>
      {decided.length === 0 && (
        <p className="whisper" style={{ fontSize: 14, marginTop: 0 }}>None yet stand in the record.</p>
      )}
      {decided.map((a) =>
        row(
          a,
          a.status === "anointed" ? "welcomed as an initiate" : "turned from the gate",
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span className="tag" style={a.status === "cast_out" ? { color: "#c17b80", borderColor: "var(--wine)" } : undefined}>
              {a.status === "anointed" ? "anointed" : "cast out"}
            </span>
            {a.status === "anointed" && a.anointed_at && <span className="whisper" style={{ fontSize: 11 }}>{fmtDate(a.anointed_at)}</span>}
          </span>
        )
      )}

      {opened && (
        <PetitionerModal
          a={opened}
          portrait={portraitOf(opened)}
          members={members}
          isKeiser={isKeiser}
          myId={myId}
          onClose={() => setOpenApp(null)}
          onDecree={decree}
          onCounsel={counsel}
          onSetDate={setAnointDate}
        />
      )}

      {summoned.length > 0 && (
        <>
          <MoonDivider />
          <h2 className="disp" style={{ fontSize: 16, fontWeight: 500 }}>Expulsion hearings</h2>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 14 }}>
            Souls who have offended the theme {DQ_THRESHOLD} times stand before the Council.
          </p>
          {summoned.map(([name, count]) => (
            <ExpulsionCard key={name} name={name} count={count} />
          ))}
        </>
      )}
    </section>
  );
}

function Tally({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="disp" style={{ fontSize: 19, color }}>{n}</div>
      <span className="whisper" style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}
