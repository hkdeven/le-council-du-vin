"use client";

import { useState, useEffect } from "react";
import { seedMembers } from "@/lib/seed";
import { loadMembers } from "@/lib/members";
import { fetchThemes, proposeTheme, favourTheme, editTheme, removeTheme, PoolTheme } from "@/lib/themes";
import { fetchPolls, createPoll, updatePoll, toggleVote } from "@/lib/polls";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { shareToWhatsApp } from "@/lib/share";
import Avatar from "@/components/Avatar";
import MemberCard from "@/components/MemberCard";
import type { Poll, Member } from "@/lib/types";

const THEME_ICONS = ["ti-flame", "ti-hourglass", "ti-coin", "ti-grape", "ti-skull", "ti-star"];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
const initialsOf = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function MoonDivider() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "30px 0", color: "var(--gold)", opacity: 0.5, fontSize: 16 }} aria-hidden="true">
      <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
    </div>
  );
}

function PollCard({ poll, meId, members, onUpdate, onVoted, onArchive }: {
  poll: Poll; meId: string | null; members: Member[];
  onUpdate: (patch: Partial<Poll>) => void; onVoted: (options: Poll["options"]) => void; onArchive: () => void;
}) {
  const [newDate, setNewDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const options = [...poll.options].sort((a, b) => a.date.localeCompare(b.date));
  const lead = Math.max(0, ...poll.options.map((o) => o.voters.length));

  // Refetch-before-write so simultaneous voters don't overwrite each other.
  const vote = (id: string) => {
    if (!meId) return;
    toggleVote(poll.id, id, meId).then(onVoted).catch((e) => alert(`Could not record your vote: ${e.message}`));
  };
  const addDate = () => {
    if (!newDate) return;
    if (poll.options.some((o) => o.date === newDate)) { setNewDate(""); return; }
    onUpdate({ options: [...poll.options, { id: `o-${Date.now()}`, date: newDate, voters: [] }] });
    setNewDate("");
  };
  const share = () => {
    const text =
      "Choose the next council meeting:\n" +
      options.map((o) => `• ${fmtDate(o.date)}`).join("\n") +
      "\n\nCast your vote: http://lecouncilduvin.co.za//oracle";
    shareToWhatsApp(text);
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div className="eyebrow" style={{ flex: 1 }}>{poll.title}</div>
        <button onClick={share} title="Share to WhatsApp" aria-label="Share poll to WhatsApp"
          style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--gold2)", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <i className="ti ti-brand-whatsapp" /> Share
        </button>
        <button onClick={onArchive} title="Archive poll" aria-label="Archive poll"
          style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--dim)", padding: "6px 9px", cursor: "pointer", display: "flex" }}>
          <i className="ti ti-archive" style={{ fontSize: 14 }} />
        </button>
      </div>

      {options.length === 0 && <p className="whisper" style={{ margin: "0 0 8px", fontSize: 14 }}>No dates yet — add the first below.</p>}
      {options.map((o) => {
        const mine = meId ? o.voters.includes(meId) : false;
        const leading = o.voters.length === lead && lead > 0;
        const open = expanded === o.id;
        return (
          <div key={o.id}>
            <div className="rk" style={{ borderBottom: open ? "none" : undefined }}>
              <button onClick={() => vote(o.id)} disabled={!meId} aria-label={mine ? "Withdraw your vote" : "Vote for this date"}
                style={{ width: "auto", background: "none", border: "none", cursor: meId ? "pointer" : "default", color: mine ? "var(--gold2)" : "var(--faint)", fontSize: 20, display: "flex" }}>
                <i className={mine ? "ti ti-square-check" : "ti ti-square"} />
              </button>
              <div style={{ flex: 1 }}>
                {fmtDate(o.date)}{" "}
                {leading && <span className="tag" style={{ color: "var(--gold2)", borderColor: "var(--line2)" }}>leading</span>}
              </div>
              <button onClick={() => setExpanded(open ? null : o.id)}
                style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--dim)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                {o.voters.length} can attend <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 13 }} />
              </button>
            </div>
            {open && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "2px 0 12px 34px" }}>
                {o.voters.length === 0 ? (
                  <span className="whisper" style={{ fontSize: 14 }}>None have marked this night.</span>
                ) : (
                  o.voters.map((id) => {
                    const mem = members.find((x) => x.id === id);
                    return (
                      <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--parch)" }}>
                        {mem ? <MemberCard member={mem} size={22} /> : <Avatar initials="?" size={22} />}
                        {mem?.cult_name || id}
                      </span>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()} style={{ flex: 1, cursor: "pointer" }} />
        <button className="btn" style={{ width: "auto", padding: "0 16px" }} onClick={addDate} disabled={!newDate}>Add date</button>
      </div>
    </div>
  );
}

export default function Oracle() {
  const { mode, role, member } = useAuth();
  const isKeiser = role === "keiser";
  const meId = mode === "live" ? member?.id ?? null : role === "keiser" ? "m-keiser" : role === "member" ? "m-larissa" : null;

  const [polls, setPolls] = useState<Poll[]>([]);
  const [members, setMembers] = useState<Member[]>(seedMembers);
  const [themes, setThemes] = useState<PoolTheme[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [proposal, setProposal] = useState("");
  const [proposalDesc, setProposalDesc] = useState("");
  const [editingTheme, setEditingTheme] = useState<string | null>(null);

  const reloadThemes = () => fetchThemes(meId).then(setThemes);

  useEffect(() => {
    reloadThemes();
    fetchPolls().then(setPolls);
    if (mode === "live" && supabase) {
      supabase.from("members").select("*").order("role").then(({ data }) => { if (data) setMembers(data as Member[]); });
    } else {
      setMembers(loadMembers());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, meId]);

  const open = polls.filter((p) => p.status === "open");
  const archived = polls.filter((p) => p.status === "archived");

  const newPoll = async () => {
    try {
      const p = await createPoll("Choose the next council meeting");
      setPolls((ps) => [p, ...ps]);
    } catch (e) {
      alert(`Could not open a poll: ${(e as Error).message}`);
    }
  };
  const changePoll = (id: string, patch: Partial<Poll>) => {
    setPolls((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    updatePoll(id, patch).catch((e) => alert(`Could not save the poll: ${e.message}`));
  };

  const favour = (id: string) => {
    const t = themes.find((x) => x.id === id);
    const on = !t?.favouredByMe;
    setThemes((ts) => ts.map((x) => (x.id === id ? { ...x, favouredByMe: on, favours: Math.max(0, x.favours + (on ? 1 : -1)) } : x)).sort((a, b) => b.favours - a.favours));
    favourTheme(id, meId, on).catch(() => reloadThemes());
  };
  const propose = async () => {
    const title = proposal.trim();
    if (!title) return;
    setProposal(""); setProposalDesc("");
    try {
      await proposeTheme(title, proposalDesc.trim() || null);
      reloadThemes();
    } catch (e) {
      alert(`Could not add the theme: ${(e as Error).message}`);
    }
  };
  const remove = (id: string) => {
    setThemes((ts) => ts.filter((t) => t.id !== id));
    removeTheme(id).catch(() => reloadThemes());
  };
  const edit = (id: string, patch: { title?: string; description?: string | null }) => {
    setThemes((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    editTheme(id, patch).catch(() => reloadThemes());
  };

  const wheel = [...members].filter((m) => m.active).sort((a, b) => (a.last_hosted || "").localeCompare(b.last_hosted || ""));

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>The oracle</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        What the moons ahead will bring — dates, themes, and the turning of the host.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div className="eyebrow" style={{ flex: 1 }}>Date polls · mark every night you can make</div>
        <button className="btn" style={{ width: "auto", padding: "8px 14px" }} onClick={newPoll}>
          <i className="ti ti-plus" style={{ marginRight: 5 }} /> New poll
        </button>
      </div>

      {open.length === 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="whisper" style={{ margin: 0, fontSize: 15 }}>No polls are open. Cast the first with “New poll”.</p>
        </div>
      )}
      {open.map((p) => (
        <PollCard key={p.id} poll={p} meId={meId} members={members} onUpdate={(patch) => changePoll(p.id, patch)} onVoted={(options) => setPolls((ps) => ps.map((x) => (x.id === p.id ? { ...x, options } : x)))} onArchive={() => changePoll(p.id, { status: "archived" })} />
      ))}

      {archived.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setShowArchived((s) => !s)} style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--dim)", padding: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14 }}>
            <i className="ti ti-archive" style={{ marginRight: 5 }} />Archived polls ({archived.length}) {showArchived ? "▾" : "▸"}
          </button>
          {showArchived && archived.map((p) => (
            <div key={p.id} className="rk" style={{ opacity: 0.6 }}>
              <i className="ti ti-archive" style={{ color: "var(--dim)" }} />
              <div style={{ flex: 1 }}>{p.title} <span className="whisper" style={{ fontSize: 13 }}>· {p.options.length} dates</span></div>
              <button onClick={() => changePoll(p.id, { status: "open" })} style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14 }}>restore</button>
            </div>
          ))}
        </div>
      )}

      <MoonDivider />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Theme pool — cast your favour</div>
        {themes.map((t, i) => (
          <div key={t.id} className="rk" style={{ alignItems: editingTheme === t.id ? "flex-start" : "center" }}>
            <i className={`ti ${THEME_ICONS[i % THEME_ICONS.length]}`} style={{ color: "var(--gold2)" }} aria-hidden="true" />
            {editingTheme === t.id ? (
              <div style={{ flex: 1 }}>
                <input value={t.title} onChange={(e) => edit(t.id, { title: e.target.value })} placeholder="The theme…" />
                <input value={t.description || ""} onChange={(e) => edit(t.id, { description: e.target.value || null })} placeholder="A supporting line (optional)…" style={{ marginTop: 6 }} />
                <button className="btn" style={{ width: "auto", padding: "6px 14px", marginTop: 6 }} onClick={() => setEditingTheme(null)}>Done</button>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <div>{t.title}</div>
                {t.description && <div className="whisper" style={{ fontSize: 13 }}>{t.description}</div>}
              </div>
            )}
            <button onClick={() => favour(t.id)} aria-label="Cast favour"
              style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: t.favouredByMe ? "var(--gold2)" : "var(--faint)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-flame" />{t.favours} favours
            </button>
            {isKeiser && editingTheme !== t.id && (
              <button onClick={() => setEditingTheme(t.id)} aria-label="Amend this theme" title="Edit"
                style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", display: "flex", alignItems: "center", paddingLeft: 10 }}>
                <i className="ti ti-pencil" style={{ fontSize: 15 }} />
              </button>
            )}
            {isKeiser && (
              <button onClick={() => remove(t.id)} aria-label="Cast this theme from the pool" title="Cast out"
                style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", display: "flex", alignItems: "center", paddingLeft: 10 }}>
                <i className="ti ti-trash" style={{ fontSize: 15 }} />
              </button>
            )}
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <input value={proposal} onChange={(e) => setProposal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && propose()} placeholder="Propose a new theme…" style={{ width: "100%" }} />
          <input value={proposalDesc} onChange={(e) => setProposalDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && propose()} placeholder="A supporting line (optional)…" style={{ width: "100%", marginTop: 8 }} />
          <button className="btn" style={{ marginTop: 8 }} onClick={propose} disabled={!proposal.trim()}>Add to the pool</button>
        </div>
      </div>

      <MoonDivider />

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>The hosting wheel</div>
        {wheel.map((m, i) => {
          const hostingNow = m.id === "m-matthew";
          const upNext = i === 0 && !hostingNow;
          const when = m.last_hosted ? new Date(m.last_hosted).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "never";
          return (
            <div key={m.id} className="rk" style={{ opacity: hostingNow || upNext ? 1 : 0.6 }}>
              <MemberCard member={m} size={30} />
              <div style={{ flex: 1 }}>
                {m.cult_name}{" "}
                {hostingNow && <span className="tag" style={{ color: "var(--gold2)", borderColor: "var(--line2)" }}>hosting now</span>}
              </div>
              <span className="whisper" style={{ fontSize: 14 }}>
                {hostingNow ? "this moon" : upNext ? "up next" : `last hosted · ${when}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
