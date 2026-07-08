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
import type { Application, Member } from "@/lib/types";

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
          {verdict === "kept" ? "The Council shows mercy — they remain, on thinnest ice." : "The seat is forfeit. Their glass is emptied."}
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
  return (
    <>
      {a.wine_sin && (
        <p style={{ margin: "0 0 4px" }}>
          <span className="scr">Gravest wine sin:</span> &ldquo;{a.wine_sin}&rdquo;
        </p>
      )}
      {a.if_wine && (
        <p style={{ margin: 0 }}>
          <span className="scr">If a wine:</span> &ldquo;{a.if_wine}&rdquo;
        </p>
      )}
      {a.draw_reason && (
        <p style={{ margin: "4px 0 0" }}>
          <span className="scr">What draws them:</span> &ldquo;{a.draw_reason}&rdquo;
        </p>
      )}
    </>
  );
}

export default function Tribunal() {
  const { mode } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [dq, setDq] = useState<Record<string, number>>({});
  // Emails of members who still exist, so an anointed petition whose member has
  // since been cast from the Council no longer lingers on the decided list.
  const [memberEmails, setMemberEmails] = useState<Set<string>>(new Set());
  // Which decided petitioner's original answers are expanded.
  const [openDecided, setOpenDecided] = useState<string | null>(null);

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
      supabase.from("members").select("email").then(({ data }) => {
        if (data) setMemberEmails(new Set(data.map((m) => (m.email as string).toLowerCase())));
      });
    } else {
      setApps(loadApplications());
      setMemberEmails(new Set(loadMembers().map((m) => m.email.toLowerCase())));
    }
  }, [mode]);

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
    // initiate's email locally so they appear at once, without a refresh.
    if (status === "anointed" && a.email) {
      setMemberEmails((prev) => new Set(prev).add(a.email.toLowerCase()));
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
  const summoned = Object.entries(dq).filter(([, n]) => n >= DQ_THRESHOLD);

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The tribunal</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        A petitioner stands before the Council.{" "}
        <span className="tag" style={{ color: "var(--wine)", borderColor: "var(--wine)" }}>Keiser only</span>
      </p>

      {pending.length === 0 && (
        <p className="whisper" style={{ fontSize: 16 }}>No souls await judgement. The gate is quiet.</p>
      )}

      {pending.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <MemberCard member={{ cult_name: a.cult_name, date_of_birth: a.date_of_birth, time_of_birth: a.time_of_birth, birth_place: a.birth_place, birth_lat: a.birth_lat, birth_lon: a.birth_lon, birth_tz: a.birth_tz }} size={40} />
            <div>
              <div className="disp" style={{ fontSize: 16 }}>{a.cult_name}</div>
              <div className="whisper" style={{ fontSize: 14 }}>
                {a.date_of_birth ? (() => { const s = sunSign(a.date_of_birth!); return `Born ${fmtDate(a.date_of_birth!)}${s ? ` · ${s.symbol} ${s.name}` : ""}`; })() : a.email}
              </div>
            </div>
          </div>

          <PetitionAnswers a={a} />

          {a.tally && (
            <div style={{ display: "flex", gap: 16, margin: "16px 0", padding: "12px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <Tally n={a.tally.anoint} label="anoint" color="var(--gold2)" />
              <Tally n={a.tally.cast_out} label="cast out" color="var(--wine)" />
              <Tally n={a.tally.abstain} label="abstain" color="var(--dim)" />
            </div>
          )}

          <p className="whisper" style={{ margin: "0 0 12px", fontSize: 15 }}>
            The Council has spoken. The decree is yours alone, Keiser.
          </p>
          <p className="whisper" style={{ margin: "0 0 12px", fontSize: 13 }}>
            To anoint grants an <b style={{ color: "var(--gold2)" }}>initiate&rsquo;s</b> access — the gatherings, the rite, the reveal. Elevate them to full member later from your profile roster.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn gold" style={{ flex: 1 }} onClick={() => decree(a, "anointed")}>Anoint as initiate</button>
            <button className="btn danger" style={{ flex: 1 }} onClick={() => decree(a, "cast_out")}>Cast out</button>
          </div>
        </div>
      ))}

      {apps
        .filter((a) => a.status !== "pending")
        // Keep cast-out records; drop anointed ones whose member was later deleted.
        .filter((a) => a.status === "cast_out" || memberEmails.has(a.email.toLowerCase()))
        .map((a) => {
          const openD = openDecided === a.id;
          return (
            <div key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="rk" style={{ borderBottom: "none" }}>
                <MemberCard member={{ cult_name: a.cult_name, date_of_birth: a.date_of_birth, time_of_birth: a.time_of_birth, birth_place: a.birth_place, birth_lat: a.birth_lat, birth_lon: a.birth_lon, birth_tz: a.birth_tz }} size={34} />
                <button
                  onClick={() => setOpenDecided(openD ? null : a.id)}
                  style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0, color: "inherit" }}
                >
                  <span style={{ flex: 1 }}>{a.cult_name}</span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "none" }}>
                    <span className="tag" style={{ color: a.status === "anointed" ? "var(--gold2)" : "var(--wine)", borderColor: a.status === "anointed" ? "var(--line2)" : "var(--wine)" }}>
                      {a.status === "anointed" ? "anointed" : "cast out"}
                    </span>
                    {a.status === "anointed" && a.anointed_at && (
                      <span className="whisper" style={{ fontSize: 11 }}>{fmtDate(a.anointed_at)}</span>
                    )}
                  </span>
                  <i className={`ti ti-chevron-${openD ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />
                </button>
              </div>
              {openD && (
                <div style={{ paddingLeft: 46, paddingBottom: 12 }}>
                  {a.status === "anointed" && (
                    <div style={{ marginBottom: 8 }}>
                      <label className="field" style={{ marginTop: 0 }}>Date of anointment</label>
                      <input
                        type="date"
                        value={(a.anointed_at || "").slice(0, 10)}
                        onChange={(e) => setAnointDate(a, e.target.value)}
                        style={{ colorScheme: "dark", maxWidth: 220 }}
                      />
                    </div>
                  )}
                  <div className="whisper" style={{ fontSize: 13, marginBottom: 6 }}>
                    {a.date_of_birth ? (() => { const s = sunSign(a.date_of_birth!); return `Born ${fmtDate(a.date_of_birth!)}${s ? ` · ${s.symbol} ${s.name}` : ""}`; })() : null}
                    {a.email ? `${a.date_of_birth ? " · " : ""}${a.email}` : ""}
                  </div>
                  {(a.wine_sin || a.if_wine || a.draw_reason) ? (
                    <PetitionAnswers a={a} />
                  ) : (
                    <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No answers were recorded with this petition.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

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
