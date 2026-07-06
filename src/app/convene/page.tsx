"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { seedMembers, DEFAULT_RULES, DEFAULT_THREAT } from "@/lib/seed";
import { loadMembers } from "@/lib/members";
import { fetchGatherings, createGathering, updateGathering, deleteGathering, toggleAttendee, pickCurrent } from "@/lib/gatherings";
import { supabase } from "@/lib/supabase";
import { toRoman } from "@/lib/util";
import { useAuth } from "@/components/AuthProvider";
import MoonDivider from "@/components/MoonDivider";
import { useWineCount } from "@/lib/useWineCount";
import { fetchOffering, saveOffering } from "@/lib/bottles";
import { shareToWhatsApp } from "@/lib/share";
import Avatar from "@/components/Avatar";
import type { Gathering, Member } from "@/lib/types";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });

const initialsOf = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Each member's private bottle registration for a gathering. Nobody else —
// not even the Keiser — can see it until the cloths are lifted. Once sealed,
// the wine's name is hidden from the screen too; the member can edit or erase.
function Offering({ gatheringId, meId }: { gatheringId: string; meId: string }) {
  const [title, setTitle] = useState("");
  const [sealed, setSealed] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOffering(gatheringId, meId).then((saved) => {
      if (!active) return;
      setTitle(saved || "");
      setSealed(!!saved);
      setEditing(false);
    });
    return () => { active = false; };
  }, [gatheringId, meId]);

  const seal = () => {
    if (!title.trim()) return;
    saveOffering(gatheringId, meId, title).catch((e) => alert(`Could not seal your offering: ${e.message}`));
    setSealed(true);
    setEditing(false);
  };
  const erase = () => {
    saveOffering(gatheringId, meId, "").catch(() => {});
    setTitle("");
    setSealed(false);
    setEditing(false);
  };

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12, textAlign: "left" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Your offering</div>
      {sealed && !editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="whisper" style={{ fontSize: 14, flex: 1, minWidth: 180 }}>
            <i className="ti ti-lock" style={{ fontSize: 12, marginRight: 5 }} />
            Your wine is sealed — known only to you, until the cloths are lifted.
          </span>
          <button onClick={() => setEditing(true)} aria-label="Edit your offering" title="Edit"
            style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--gold2)", padding: "6px 9px", cursor: "pointer", display: "flex" }}>
            <i className="ti ti-pencil" style={{ fontSize: 14 }} />
          </button>
          <button onClick={erase} aria-label="Erase your offering" title="Erase"
            style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--wine)", padding: "6px 9px", cursor: "pointer", display: "flex" }}>
            <i className="ti ti-trash" style={{ fontSize: 14 }} />
          </button>
        </div>
      ) : (
        <>
          <p className="whisper" style={{ margin: "0 0 8px", fontSize: 14 }}>
            Log the wine you shall bring. Hidden from every other soul — even the Keiser — until the reveal.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && seal()}
              placeholder="e.g. 2022 Alheit Cartology"
              style={{ flex: 1 }}
            />
            <button className="btn" style={{ width: "auto", padding: "0 16px" }} onClick={seal} disabled={!title.trim()}>
              Seal it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// A block of copy that the permitted user can edit inline.
function EditableText({ value, canEdit, onChange, muted }: { value: string; canEdit: boolean; onChange: (v: string) => void; muted?: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} autoFocus style={{ minHeight: 90 }} />
        <button className="btn" style={{ width: "auto", padding: "6px 14px", marginTop: 6 }} onClick={() => setEditing(false)}>Done</button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: muted ? "var(--dim)" : "var(--parch)" }}>{value}</p>
      {canEdit && (
        <button onClick={() => setEditing(true)} aria-label="Edit" style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--dim)", padding: 0, marginTop: 4, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14 }}>
          <i className="ti ti-pencil" style={{ fontSize: 12, marginRight: 4 }} />edit
        </button>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)" }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

function HostPicker({ value, members, onChange }: { value: string; members: Member[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "#080706", border: "1px solid var(--line)", borderRadius: 8, color: "var(--parch)", padding: "9px 11px", fontFamily: "'EB Garamond', serif", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{members.find((m) => m.id === value)?.cult_name || "Choose a host"}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ color: "var(--dim)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40, background: "#0e0d0c", border: "1px solid var(--line2)", borderRadius: 8, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
          {members.map((m) => (
            <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", background: m.id === value ? "rgba(160,150,120,0.12)" : "none", border: "none", color: m.id === value ? "var(--gold2)" : "var(--parch)", padding: "10px 12px", fontFamily: "'EB Garamond', serif", fontSize: 15, cursor: "pointer" }}>
              {m.cult_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingBody({
  m, isCurrent, isKeiser, meId, members, onUpdate, onAttendees, onDelete, count, setCount,
}: {
  m: Gathering; isCurrent: boolean; isKeiser: boolean; meId: string | null; members: Member[];
  onUpdate: (patch: Partial<Gathering>) => void; onAttendees: (next: string[]) => void;
  onDelete?: () => void; count?: number; setCount?: (n: number) => void;
}) {
  const [showGuests, setShowGuests] = useState(false);
  const [editing, setEditing] = useState(false);
  const host = members.find((x) => x.id === m.host_id);
  const attendees = m.attendees || [];
  const isHost = meId === m.host_id;
  const date = fmtDate(m.gather_date);
  const time = m.gather_time || "19:00";
  const todayISO = new Date().toISOString().slice(0, 10);
  const showRite = isCurrent && (m.status === "scoring" || todayISO === m.gather_date);

  // Refetch-before-write so two people RSVPing at once don't clobber each other.
  const toggleRsvp = (id: string) =>
    toggleAttendee(m.id, id).then(onAttendees).catch((e) => alert(`Could not update the RSVP: ${e.message}`));

  const share = () => {
    // WhatsApp markdown: *bold*
    const text =
      `*Gathering ${toRoman(m.number)}*\n\n` +
      `*Theme:* ${m.theme_title}\n` +
      `*Host:* ${m.host_name}\n` +
      `*When:* ${date} · from ${time}\n` +
      (m.venue_instructions ? `*Where:* ${m.venue_instructions}\n` : "") +
      (m.rules_text ? `\n${m.rules_text}\n` : "") +
      (m.threat_text ? `\n${m.threat_text}\n` : "") +
      `\nRSVP here: http://lecouncilduvin.co.za/`;
    shareToWhatsApp(text);
  };

  return (
    <>
      <div className="card" style={{ borderColor: isCurrent ? "var(--line2)" : "var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span className="tag">{isCurrent ? "This moon's theme" : `Gathering ${toRoman(m.number)}`}</span>
          <button onClick={share} title="Share to WhatsApp" aria-label="Share to WhatsApp"
            style={{ marginLeft: "auto", width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--gold2)", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            <i className="ti ti-brand-whatsapp" /> Share
          </button>
          {isKeiser && (
            <button onClick={() => setEditing((e) => !e)} title="Edit details" aria-label="Edit details"
              style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--gold2)", padding: "6px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <i className={`ti ti-${editing ? "check" : "pencil"}`} style={{ fontSize: 14 }} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} title="Cancel this gathering" aria-label="Cancel this gathering"
              style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--wine)", padding: "6px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <i className="ti ti-trash" style={{ fontSize: 14 }} />
            </button>
          )}
        </div>

        {editing ? (
          <div style={{ marginTop: 8 }}>
            <label className="field" style={{ marginTop: 8 }}>Theme</label>
            <input value={m.theme_title} onChange={(e) => onUpdate({ theme_title: e.target.value })} placeholder="The theme…" />
            <label className="field">Supporting line</label>
            <textarea value={m.theme_description || ""} onChange={(e) => onUpdate({ theme_description: e.target.value })} placeholder="A line beneath the theme…" style={{ minHeight: 60 }} />
            <label className="field">Host</label>
            {/* Choosing a host loads that host's own venue instructions (from
                their profile) into this meeting — editable here without syncing
                back. Switching hosts replaces the venue with the new host's. */}
            <HostPicker
              value={m.host_id || ""}
              members={members}
              onChange={(id) => {
                const h = members.find((x) => x.id === id);
                onUpdate({ host_id: id, host_name: h?.cult_name || "", venue_instructions: h?.venue_instructions || null });
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <div style={{ flex: "1 1 140px" }}>
                <label className="field" style={{ marginTop: 0 }}>Date</label>
                <input type="date" value={m.gather_date} onChange={(e) => onUpdate({ gather_date: e.target.value })} onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()} style={{ cursor: "pointer" }} />
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <label className="field" style={{ marginTop: 0 }}>Time</label>
                <input type="time" value={time} onChange={(e) => onUpdate({ gather_time: e.target.value })} onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()} style={{ cursor: "pointer" }} />
              </div>
            </div>
            <button className="btn gold" style={{ marginTop: 12 }} onClick={() => setEditing(false)}>Done</button>
          </div>
        ) : (
          <>
            <div className="disp" style={{ fontSize: 20, margin: "8px 0 4px" }}>{m.theme_title}</div>
            {m.theme_description && <p className="whisper" style={{ margin: 0, fontSize: 15 }}>{m.theme_description}</p>}
            {showRite && (
              <Link href="/rite" className="btn gold" style={{ display: "block", textDecoration: "none", fontSize: 16, textAlign: "center", margin: "16px 0 4px" }}>
                Enter the rite
              </Link>
            )}
            {meId && <Offering gatheringId={m.id} meId={meId} />}
            <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap" }}>
              <Detail label="Host" value={<span className="scr" style={{ fontSize: 16 }}>{m.host_name}</span>} />
              <Detail label="The night" value={<span style={{ color: "var(--parch)" }}>{date} · from {time}</span>} />
              <Detail label="Vessels" value={<span style={{ color: "var(--parch)" }}>{(isCurrent && count) || m.wine_count} cloaked</span>} />
            </div>
          </>
        )}

        <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>The observances</div>
          <EditableText value={m.rules_text || DEFAULT_RULES} canEdit={isKeiser} onChange={(v) => onUpdate({ rules_text: v })} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6, color: "var(--wine)" }}>By decree of the Keiser</div>
          <EditableText value={m.threat_text || DEFAULT_THREAT} canEdit={isKeiser} onChange={(v) => onUpdate({ threat_text: v })} muted />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Finding the host</div>
          {m.venue_instructions ? (
            <EditableText value={m.venue_instructions} canEdit={isKeiser || isHost} onChange={(v) => onUpdate({ venue_instructions: v })} />
          ) : (isKeiser || isHost) ? (
            <button className="btn" style={{ width: "auto", padding: "8px 16px" }} onClick={() => onUpdate({ venue_instructions: host?.venue_instructions || "Add the venue details…" })}>
              Add venue details
            </button>
          ) : (
            <p className="whisper" style={{ margin: 0, fontSize: 14 }}>The host has not yet marked the way.</p>
          )}
        </div>

        {/* RSVP — the last section of the card */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Who answers the call · {attendees.length}</div>
        {meId && (
          <button
            className={`btn${attendees.includes(meId) ? " gold" : ""}`}
            onClick={() => toggleRsvp(meId)}
          >
            {attendees.includes(meId) ? "You are attending — withdraw" : "I shall attend"}
          </button>
        )}
        <div style={{ display: "flex", gap: 8, margin: "12px 0 4px", flexWrap: "wrap", alignItems: "center" }}>
          {attendees.length === 0 && <span className="whisper" style={{ fontSize: 14 }}>No souls have answered yet.</span>}
          {attendees.map((id) => {
            const mem = members.find((x) => x.id === id);
            if (!mem) return null;
            return <Avatar key={id} src={mem.avatar_url} initials={mem.short_name || initialsOf(mem.cult_name)} size={30} />;
          })}
        </div>
        {isKeiser && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setShowGuests((s) => !s)} style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--dim)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14 }}>
              <i className="ti ti-users" style={{ marginRight: 5 }} />RSVP on their behalf {showGuests ? "▾" : "▸"}
            </button>
            {showGuests && (
              <div style={{ marginTop: 8 }}>
                {members.map((mem) => (
                  <div key={mem.id} className="rk" style={{ padding: "8px 0" }}>
                    <button onClick={() => toggleRsvp(mem.id)} aria-label="Toggle attendance"
                      style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: attendees.includes(mem.id) ? "var(--gold2)" : "var(--faint)", fontSize: 18, display: "flex" }}>
                      <i className={attendees.includes(mem.id) ? "ti ti-square-check" : "ti ti-square"} />
                    </button>
                    <Avatar src={mem.avatar_url} initials={mem.short_name || initialsOf(mem.cult_name)} size={26} />
                    <span style={{ flex: 1 }}>{mem.cult_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Count (keiser) — current meeting only */}
      {isCurrent && (
        <>
          {isKeiser && setCount && (
            <div className="card" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="eyebrow">Set the count · Keiser</div>
                <div className="whisper" style={{ fontSize: 14 }}>How many bottles convene tonight?</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                <button className="btn" style={{ width: 38, padding: "9px 0", textAlign: "center" }} onClick={() => setCount((count || 1) - 1)} disabled={(count || 1) <= 1} aria-label="One fewer bottle"><i className="ti ti-minus" /></button>
                <span className="disp" style={{ fontSize: 22, minWidth: 26, textAlign: "center" }}>{count}</span>
                <button className="btn" style={{ width: 38, padding: "9px 0", textAlign: "center" }} onClick={() => setCount((count || 1) + 1)} aria-label="One more bottle"><i className="ti ti-plus" /></button>
              </div>
            </div>
          )}

        </>
      )}
    </>
  );
}

function FutureCard({ m, isKeiser, meId, members, onUpdate, onAttendees, onDelete }: { m: Gathering; isKeiser: boolean; meId: string | null; members: Member[]; onUpdate: (patch: Partial<Gathering>) => void; onAttendees: (next: string[]) => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setOpen((o) => !o)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}>
          <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)" }} />
          <div style={{ flex: 1 }}>
            <div className="disp" style={{ fontSize: 16 }}>{m.theme_title}</div>
            <div className="whisper" style={{ fontSize: 14 }}>Gathering {toRoman(m.number)} · {fmtDate(m.gather_date)}</div>
          </div>
        </button>
        {onDelete && (
          <button onClick={onDelete} title="Cancel this gathering" aria-label="Cancel this gathering"
            style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--wine)", padding: "6px 9px", cursor: "pointer", flex: "none" }}>
            <i className="ti ti-trash" style={{ fontSize: 14 }} />
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <MeetingBody m={m} isCurrent={false} isKeiser={isKeiser} meId={meId} members={members} onUpdate={onUpdate} onAttendees={onAttendees} />
        </div>
      )}
    </div>
  );
}

export default function Convene() {
  const { mode, role, member } = useAuth();
  const isKeiser = role === "keiser";
  // Live: act as the real signed-in member. Demo: the role-mapped stand-in.
  const meId = mode === "live" ? member?.id ?? null : role === "keiser" ? "m-keiser" : role === "member" ? "m-larissa" : null;

  const [meetings, setMeetings] = useState<Gathering[]>([]);
  const [members, setMembers] = useState<Member[]>(seedMembers);
  const [newHost, setNewHost] = useState("");
  const [hostOpen, setHostOpen] = useState(false);

  useEffect(() => {
    fetchGatherings().then(setMeetings);
    if (mode === "live" && supabase) {
      supabase.from("members").select("*").order("role").then(({ data, error }) => {
        if (error) console.error("Could not load members:", error.message);
        else if (data) { setMembers(data as Member[]); setNewHost((h) => h || (data[0] as Member)?.id || ""); }
      });
    } else {
      const list = loadMembers();
      setMembers(list);
      setNewHost((h) => h || list[0]?.id || "");
    }
  }, [mode]);

  const current = pickCurrent(meetings);
  const future = meetings.filter((m) => m.id !== current?.id);
  const [count, setCount] = useWineCount(current);

  const [newTheme, setNewTheme] = useState("");
  const [newDate, setNewDate] = useState("");

  const updateMeeting = (id: string, patch: Partial<Gathering>) => {
    setMeetings((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    updateGathering(id, patch).catch((e) => alert(`Could not save the meeting: ${e.message}`));
  };

  // RSVP already persisted via toggleAttendee (refetch-before-write); this only
  // syncs the local view, so we don't re-write (and re-clobber) the array.
  const setAttendeesLocal = (id: string, next: string[]) =>
    setMeetings((ms) => ms.map((m) => (m.id === id ? { ...m, attendees: next } : m)));

  const deleteMeeting = (id: string) => {
    setMeetings((ms) => ms.filter((m) => m.id !== id));
    deleteGathering(id).catch((e) => alert(`Could not cancel the meeting: ${e.message}`));
  };

  const addMeeting = async () => {
    const title = newTheme.trim();
    if (!title || !newDate) return;
    const host = members.find((m) => m.id === newHost);
    const nextNum = Math.max(0, ...meetings.map((m) => m.number)) + 1;
    const draft: Gathering = {
      id: `g-${Date.now()}`, number: nextNum, moon_label: "A moon to come",
      theme_title: title, theme_description: null,
      host_id: host?.id || null, host_name: host?.cult_name || "", gather_date: newDate, gather_time: "19:00",
      status: "upcoming", wine_count: 11,
      rules_text: DEFAULT_RULES, threat_text: DEFAULT_THREAT,
      venue_instructions: host?.venue_instructions || null, attendees: [],
    };
    try {
      const saved = await createGathering(draft);
      setMeetings((ms) => [...ms, saved].sort((a, b) => a.gather_date.localeCompare(b.gather_date)));
      setNewTheme(""); setNewDate("");
    } catch (e) {
      alert(`Could not summon the gathering: ${(e as Error).message}`);
    }
  };

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The convening</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>
        {current ? `${current.moon_label} · gathering ${toRoman(current.number)}` : "No gathering is scheduled."}
      </p>
      <div className="moons" style={{ margin: "10px 0 6px" }} aria-hidden="true">
        <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle-dashed" />
      </div>

      {current ? (
        <MeetingBody m={current} isCurrent isKeiser={isKeiser} meId={meId} members={members} onUpdate={(p) => updateMeeting(current.id, p)} onAttendees={(next) => setAttendeesLocal(current.id, next)} onDelete={isKeiser ? () => deleteMeeting(current.id) : undefined} count={count} setCount={setCount} />
      ) : (
        <div className="card"><p className="whisper" style={{ margin: 0, fontSize: 15 }}>The table is bare. Summon a gathering below.</p></div>
      )}

      {isKeiser && (
        <>
          <MoonDivider />
          <div className="eyebrow" style={{ margin: "0 0 10px" }}>Gatherings to come</div>
          {future.map((m) => (
            <FutureCard key={m.id} m={m} isKeiser={isKeiser} meId={meId} members={members} onUpdate={(p) => updateMeeting(m.id, p)} onAttendees={(next) => setAttendeesLocal(m.id, next)} onDelete={() => deleteMeeting(m.id)} />
          ))}

          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Summon a new gathering · Keiser</div>
            <input value={newTheme} onChange={(e) => setNewTheme(e.target.value)} placeholder="The theme…" style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                style={{ flex: "1 1 150px", cursor: "pointer" }}
              />
              <div style={{ position: "relative", flex: "1 1 150px" }}>
                <button
                  onClick={() => setHostOpen((o) => !o)}
                  style={{ width: "100%", background: "#080706", border: "1px solid var(--line)", borderRadius: 8, color: "var(--parch)", padding: "9px 11px", fontFamily: "'EB Garamond', serif", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {members.find((m) => m.id === newHost)?.cult_name}
                  </span>
                  <i className={`ti ti-chevron-${hostOpen ? "up" : "down"}`} style={{ color: "var(--dim)" }} />
                </button>
                {hostOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40, background: "#0e0d0c", border: "1px solid var(--line2)", borderRadius: 8, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setNewHost(m.id); setHostOpen(false); }}
                        style={{ width: "100%", textAlign: "left", background: m.id === newHost ? "rgba(160,150,120,0.12)" : "none", border: "none", color: m.id === newHost ? "var(--gold2)" : "var(--parch)", padding: "10px 12px", fontFamily: "'EB Garamond', serif", fontSize: 15, cursor: "pointer" }}
                      >
                        {m.cult_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button className="btn gold" style={{ marginTop: 10 }} onClick={addMeeting} disabled={!newTheme.trim() || !newDate}>
              Summon it
            </button>
          </div>
        </>
      )}
    </section>
  );
}
