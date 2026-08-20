"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { seedMembers } from "@/lib/seed";
import { loadMembers, saveMember, removeMember, rosterOrder } from "@/lib/members";
import { deleteApplicationsByEmail } from "@/lib/applications";
import { fetchCurrentGathering } from "@/lib/gatherings";
import { fetchDqCounts, DQ_THRESHOLD } from "@/lib/annals";
import { sendEmail } from "@/lib/sendEmail";
import { supabase } from "@/lib/supabase";
import { sunSign, DEFAULT_TZ, curatedTimezones } from "@/lib/astrology";
import { geocodePlace, type GeoHit } from "@/lib/geo";
import { toRoman } from "@/lib/util";
import AvatarCropper from "@/components/AvatarCropper";
import { chartReady, AstralShell } from "@/components/NatalChart";
import HeavensFace from "@/components/Heavens";
import type { CardMember } from "@/components/MemberCard";
import MemberCard from "@/components/MemberCard";
import Loading from "@/components/Loading";
import { uploadAvatar } from "@/lib/photos";
import { assertWrite } from "@/lib/writeLock";
import { swr } from "@/lib/swr";
import type { Role, Member, Gathering } from "@/lib/types";

const fmtGDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "";

const DEMO_NAMES: Record<Role, string> = {
  initiate: "Cassian Vale",
  member: "Priestess Larissa",
  keiser: "The Keiser",
};
const ROLES: Role[] = ["initiate", "member", "keiser"];

function InfoTip({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const tipRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  // Only one tooltip open anywhere (shared signal with the card's tooltips).
  const me = useRef({});
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("lcv-tip-open", { detail: me.current }));
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== me.current) setOpen(false);
    };
    // Any tap outside the tip (not just on another tip) dismisses it.
    const onDoc = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("lcv-tip-open", onOther);
    document.addEventListener("pointerdown", onDoc, true);
    return () => {
      window.removeEventListener("lcv-tip-open", onOther);
      document.removeEventListener("pointerdown", onDoc, true);
    };
  }, [open]);
  // Keep the tooltip on-screen: measure once shown and nudge it back inside
  // the viewport, so tips near either edge never bleed off on mobile.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!open || !el) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let dx = 0;
    if (r.left < 8) dx = 8 - r.left;
    else if (r.right > vw - 8) dx = vw - 8 - r.right;
    if (dx) el.style.transform = `translateX(${dx}px)`;
  }, [open]);
  // Hover-open only where hover exists; on touch the synthetic mouseenter
  // fought the click-toggle and tooltips appeared not to open at all.
  const hoverable = typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", marginLeft: 5 }}>
      <button
        type="button"
        aria-label="More"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={hoverable ? () => setOpen(true) : undefined}
        onMouseLeave={hoverable ? () => setOpen(false) : undefined}
        style={{ background: "none", border: "none", padding: 5, margin: -3, cursor: "pointer", color: "var(--dim)", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "auto", minWidth: 24, minHeight: 24 }}
      >
        <i className="ti ti-info-circle" style={{ fontSize: 14 }} />
      </button>
      {open && (
        <span
          ref={tipRef}
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 6px)", [align]: 0, zIndex: 30,
            width: 220, background: "#0d0b0a", border: "1px solid var(--line2)", borderRadius: 8,
            padding: "9px 11px", color: "var(--parch)", fontSize: 12.5, lineHeight: 1.5,
            fontFamily: "'EB Garamond', serif", fontStyle: "normal", textTransform: "none",
            letterSpacing: "normal", boxShadow: "0 6px 20px rgba(0,0,0,0.55)",
          } as React.CSSProperties}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function Row({ label, tip, value, valueTip, hint }: { label: string; tip?: string; value: string; valueTip?: string; hint?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center" }}>
        {label}{tip && <InfoTip text={tip} />}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", color: hint ? "var(--faint)" : "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontStyle: hint ? "italic" : "normal", fontSize: 16 }}>
        {hint || value}{valueTip && !hint && <InfoTip text={valueTip} align="right" />}
      </span>
    </div>
  );
}

const ALL_ROLES: Role[] = ["initiate", "member", "keiser"];

// The full roster. Every soul sees the roll (avatars open their cards);
// only the Keiser may expand a row to amend the account, or elevate.
function RosterEditor() {
  const { mode, role, sleeping } = useAuth();
  const isKeiser = role === "keiser";
  const [members, setMembers] = useState<Member[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  // Open by default (the roll is daily reading), but it can be folded away.
  const [unfolded, setUnfolded] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  // Keiser editing a member's portrait: pick a file for a member, then crop it.
  const photoRef = useRef<HTMLInputElement>(null);
  const [pickId, setPickId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !pickId) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setCropId(pickId); };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  useEffect(() => {
    // Live: the roster is the Supabase members table (so anointed initiates
    // appear here to be elevated). Demo: the local seed + overrides. (Supabase
    // may be connected with the login wall off — that still counts as demo.)
    if (mode === "live" && supabase) {
      swr("members", async () => {
        const { data, error } = await supabase!.from("members").select("*");
        if (error) throw new Error(error.message);
        return (data || []) as Member[];
      }, (list) => { setMembers(rosterOrder(list)); setRosterLoaded(true); });
    } else {
      setMembers(rosterOrder(loadMembers()));
      setRosterLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const edit = async (id: string, patch: Partial<Member>) => {
    try { assertWrite(); } catch (e) { alert((e as Error).message); return; }
    const before = members.find((m) => m.id === id);
    if (mode === "live" && supabase) {
      const { error } = await supabase.from("members").update(patch).eq("id", id);
      if (error) { alert(`Could not save the change: ${error.message}`); return; }
    } else {
      saveMember(id, patch);
    }
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    // Email on a genuine elevation (initiate → member). No-ops until Resend set.
    if (patch.role === "member" && before?.role === "initiate" && before.email) {
      sendEmail("elevate", [before.email], { name: before.cult_name }).catch(() => {});
    }
  };

  const remove = async (m: Member) => {
    try { assertWrite(); } catch (e) { alert((e as Error).message); return; }
    if (!window.confirm(`Cast ${m.cult_name} from the Council? This erases their account.`)) return;
    if (mode === "live" && supabase) {
      const { error } = await supabase.from("members").delete().eq("id", m.id);
      if (error) { alert(`Could not cast ${m.cult_name} out: ${error.message}`); return; }
    } else {
      removeMember(m.id);
    }
    // Also drop their petition so they don't linger on the tribunal's list.
    if (m.email) deleteApplicationsByEmail(m.email).catch(() => {});
    setMembers((ms) => ms.filter((x) => x.id !== m.id));
    setOpenId(null);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setUnfolded((o) => !o)}
        aria-expanded={unfolded}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}
      >
        <i className={`ti ti-chevron-${unfolded ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />
        <span style={{ flex: 1 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: unfolded ? 4 : 0 }}>The council roster</span>
          {unfolded && (
            <span className="whisper" style={{ display: "block", fontSize: 13 }}>
              {isKeiser
                ? "Every soul's account. Yours to amend, Keiser."
                : "Every soul of the Council. Touch a portrait to know them."}
            </span>
          )}
        </span>
      </button>
      {unfolded && (
      <>
      <div style={{ height: 10 }} />
      <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickPhoto} />
      {!rosterLoaded && <Loading text="Summoning the roster…" />}
      {members.map((m) => {
        const open = openId === m.id;
        return (
          <div key={m.id} style={{ borderTop: "1px solid var(--line)", padding: "9px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", flex: "none", filter: m.active === false ? "grayscale(1) brightness(0.6)" : "none" }}>
                <MemberCard member={m} size={30} />
              </span>
              <button
                onClick={() => isKeiser && setOpenId(open ? null : m.id)}
                style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: isKeiser ? "pointer" : "default", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}
              >
                {/* No email on the roll — the Keiser finds and amends it
                    inside the expanded row. minWidth:0 + ellipsis so a long
                    name truncates rather than squashing the portrait. */}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: m.active === false ? "#8d8b85" : "var(--gold2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.cult_name}</span>
                  {m.active === false && (
                    <span className="eyebrow" style={{ display: "block", fontSize: 8.5, color: "var(--faint)", marginTop: 1 }}>
                      <i className="ti ti-zzz" style={{ fontSize: 10, marginRight: 3 }} />sleeping
                    </span>
                  )}
                </span>
                {isKeiser && <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />}
              </button>
              {isKeiser && m.role === "initiate" ? (
                // The Elevate button says "initiate" by existing — no tag needed,
                // and together they pushed each other off the mobile edge.
                <button onClick={() => edit(m.id, { role: "member" })} title="Elevate to full member"
                  style={{ width: "auto", flex: "none", background: "none", border: "1px solid var(--line2)", borderRadius: 14, color: "var(--gold2)", padding: "4px 12px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  <i className="ti ti-arrow-big-up-lines" style={{ fontSize: 12, marginRight: 4 }} />Elevate
                </button>
              ) : (
                <span className="tag" style={{ opacity: m.active ? 1 : 0.4, flex: "none" }}>{m.role}</span>
              )}
            </div>
            {isKeiser && open && (
              <div style={{ paddingLeft: 40, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {cropId === m.id && cropSrc ? (
                  <div>
                    <label className="field" style={{ marginTop: 0 }}>Frame their portrait</label>
                    <AvatarCropper
                      src={cropSrc}
                      onSave={async (url) => {
                        try {
                          edit(m.id, { avatar_url: await uploadAvatar(m.id, url) });
                        } catch (e) { alert(`The portrait would not take: ${(e as Error).message}`); }
                        setCropSrc(null); setCropId(null);
                      }}
                      onCancel={() => { setCropSrc(null); setCropId(null); }}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="field" style={{ marginTop: 0 }}>Portrait</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line2)", flex: "none" }} />
                      ) : (
                        <span className="av" style={{ width: 48, height: 48, fontSize: 15, flex: "none" }}>{m.short_name || (m.cult_name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                      )}
                      <button className="btn" style={{ width: "auto", padding: "6px 14px" }} onClick={() => { setPickId(m.id); photoRef.current?.click(); }}>
                        <i className="ti ti-camera" style={{ fontSize: 13, marginRight: 6 }} />{m.avatar_url ? "Change photo" : "Add photo"}
                      </button>
                      {m.avatar_url && (
                        <button className="btn" style={{ width: "auto", padding: "6px 12px", color: "var(--wine)" }} onClick={() => edit(m.id, { avatar_url: null })}>Remove</button>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="field" style={{ marginTop: 0 }}>Cult name</label>
                  <input value={m.cult_name} onChange={(e) => edit(m.id, { cult_name: e.target.value })}
                    onBlur={(e) => { const t = e.target.value.trim(); if (t !== e.target.value) edit(m.id, { cult_name: t }); }} />
                </div>
                <div>
                  <label className="field" style={{ marginTop: 0 }}>Title</label>
                  <input value={m.title || ""} onChange={(e) => edit(m.id, { title: e.target.value.slice(0, 60) || null })} placeholder="Optional honorific" />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: "1 1 60%" }}>
                    <label className="field" style={{ marginTop: 0 }}>Email</label>
                    <input value={m.email} onChange={(e) => edit(m.id, { email: e.target.value })}
                      onBlur={(e) => { const t = e.target.value.trim().toLowerCase(); if (t !== e.target.value) edit(m.id, { email: t }); }} />
                  </div>
                  <div style={{ flex: "1 1 40%" }}>
                    <label className="field" style={{ marginTop: 0 }}>Initials</label>
                    <input value={m.short_name} maxLength={2} onChange={(e) => edit(m.id, { short_name: e.target.value.toUpperCase() })} />
                  </div>
                </div>
                <div>
                  <label className="field" style={{ marginTop: 0 }}>Rank</label>
                  <div className="pills">
                    {ALL_ROLES.map((r) => (
                      <span key={r} className={`pill${m.role === r ? " on" : ""}`} onClick={() => edit(m.id, { role: r })}>{r}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field" style={{ marginTop: 0 }}>Venue instructions</label>
                  <textarea value={m.venue_instructions || ""} onChange={(e) => edit(m.id, { venue_instructions: e.target.value || null })} placeholder="Gate codes, parking, the dog…" />
                </div>
                {/* Sleep and waking: the whole of it. A sleeping member keeps
                    every door their rank opens and writes nothing anywhere. */}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div className="eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>{m.active === false ? "This seat sleeps" : "This seat is awake"}</div>
                  <p className="whisper" style={{ margin: "0 0 8px", fontSize: 13 }}>
                    {m.active === false
                      ? "They read every chamber their rank opens, but write nothing. Wake them and their hand is returned."
                      : "Put a seat to sleep and they may still read all their rank allows, but may edit nothing, anywhere. Their record stands untouched."}
                  </p>
                  <button
                    onClick={() => {
                      const sleep = m.active !== false;
                      if (!window.confirm(sleep ? `Put ${m.cult_name} to sleep? They will read on, but write nothing.` : `Wake ${m.cult_name}? Their hand is returned to them.`)) return;
                      edit(m.id, { active: !sleep });
                    }}
                    className="btn"
                    style={{ width: "auto", padding: "8px 16px", borderColor: m.active === false ? "var(--line2)" : "rgba(140,138,130,0.45)", color: m.active === false ? "var(--gold2)" : "#8d8b85" }}
                  >
                    <i className={`ti ti-${m.active === false ? "sun" : "zzz"}`} style={{ fontSize: 14, marginRight: 6 }} />
                    {m.active === false ? "Wake the seat" : "Put the seat to sleep"}
                  </button>
                </div>
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 10 }}>
                  {m.role === "keiser" ? (
                    <p className="whisper" style={{ margin: 0, fontSize: 13 }}>
                      A Keiser cannot be erased. Demote them to member first, then cast them out.
                    </p>
                  ) : (
                    <button className="btn danger" style={{ width: "auto", padding: "8px 16px" }} onClick={() => remove(m)}>
                      <i className="ti ti-trash" style={{ fontSize: 14, marginRight: 6 }} />Cast from the Council
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      </>
      )}
    </div>
  );
}

// An editable list of recipient emails — chips you can delete, plus an add box.
function RecipientChips({ list, onRemove, addValue, onAddChange, onAdd }: {
  list: string[]; onRemove: (e: string) => void; addValue: string; onAddChange: (v: string) => void; onAdd: () => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {list.length === 0 && <span className="whisper" style={{ fontSize: 13 }}>No recipients.</span>}
        {list.map((e) => (
          <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#080706", border: "1px solid var(--line2)", borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 13, color: "var(--parch)" }}>
            {e}
            <button onClick={() => onRemove(e)} aria-label={`Remove ${e}`} style={{ width: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--faint)", padding: 0, display: "flex" }}>
              <i className="ti ti-x" style={{ fontSize: 12 }} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="email" value={addValue} onChange={(e) => onAddChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())} placeholder="add an email…" style={{ flex: 1 }} />
        <button className="btn" style={{ width: "auto", padding: "0 14px" }} onClick={onAdd} disabled={!addValue.trim()}>Add</button>
      </div>
    </div>
  );
}

// Keiser-only: manually send the invite (a new gathering) and the tribunal
// summons. Nothing here fires automatically; recipients are editable per send.
function HeraldsEditor() {
  const { mode, email: myEmail, member: self } = useAuth();
  const myName = self?.cult_name || null;
  // Folded by default: the Heralds are an occasional instrument, not daily
  // reading. Nothing inside is fetched until the card is opened.
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [gathering, setGathering] = useState<Gathering | null>(null);
  const [dq, setDq] = useState<Record<string, number>>({});
  const [inviteTo, setInviteTo] = useState<string[]>([]);
  const [inviteAdd, setInviteAdd] = useState("");
  const [expelPick, setExpelPick] = useState<string>("");
  const [expelTo, setExpelTo] = useState<string[]>([]);
  const [expelAdd, setExpelAdd] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const mem = mode === "live" && supabase ? ((await supabase.from("members").select("*")).data as Member[] || []) : loadMembers();
      setMembers(mem);
      setInviteTo(mem.filter((m) => m.active !== false).map((m) => m.email).filter(Boolean));
      setGathering(await fetchCurrentGathering());
      setDq(await fetchDqCounts());
    })();
  }, [mode, open]);

  const add = (list: string[], value: string, setList: (v: string[]) => void, clear: () => void) => {
    const v = value.trim().toLowerCase();
    if (v && !list.includes(v)) setList([...list, v]);
    clear();
  };

  const summonedMembers = members.filter((m) => (dq[m.cult_name] || 0) >= DQ_THRESHOLD);
  const pickExpel = (id: string) => {
    setExpelPick(id);
    const m = members.find((x) => x.id === id);
    setExpelTo(m?.email ? [m.email] : []);
  };

  const inviteParams = gathering ? {
    number: toRoman(gathering.number),
    theme: gathering.theme_title,
    date: fmtGDate(gathering.gather_date),
    time: gathering.gather_time || "19:00",
    host: gathering.host_name || "",
    venue: gathering.venue_instructions || null,
  } : {};

  // The summons can only ever be posted to the caller's own address (the route
  // enforces it), so this proves the true path end to end without troubling a
  // single member.
  const sendSummonsTest = async () => {
    if (!gathering) return;
    if (!myEmail) { setMsg("No address on your own record to send to."); return; }
    setBusy("summons"); setMsg(null);
    const res = await sendEmail("summons", [myEmail], {
      gatheringId: gathering.id,
      number: gathering.number,
      numberRoman: toRoman(gathering.number),
      theme: gathering.theme_title || "",
      date: gathering.gather_date,
      time: gathering.gather_time || null,
      dateLabel: fmtGDate(gathering.gather_date),
      timeLabel: gathering.gather_time || "19:00",
      host: [gathering.host_name, gathering.host2_name].filter(Boolean).join(" & "),
      venue: gathering.venue_instructions || null,
      name: myName || null,
    });
    setBusy(null);
    if (res.skipped) setMsg("Email isn't configured yet: set RESEND_API_KEY + NOTIFY_FROM in Netlify.");
    else if (res.ok) setMsg(`The summons flies to ${myEmail}. Open it and look for the event.`);
    else setMsg(res.error || "It would not send.");
  };

  const send = async (kind: string, type: "invite" | "expulsion", to: string[], params: Record<string, unknown>) => {
    if (!to.length) { setMsg("Add at least one recipient."); return; }
    if (!window.confirm(`Send to ${to.length} recipient${to.length === 1 ? "" : "s"}?`)) return;
    setBusy(kind); setMsg(null);
    const res = await sendEmail(type, to, params);
    setBusy(null);
    if (res.skipped) setMsg("Email isn't configured yet: set RESEND_API_KEY + NOTIFY_FROM in Netlify.");
    else if (res.ok) setMsg(`Sent to ${res.sent}.`);
    else setMsg(res.error || `Sent ${res.sent || 0}; ${res.failed || 0} failed.`);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}
      >
        <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />
        <span style={{ flex: 1 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: open ? 4 : 0 }}>Heralds</span>
          {open && (
            <span className="whisper" style={{ display: "block", fontSize: 13 }}>Send the Council&rsquo;s branded emails by hand; nothing here fires automatically.</span>
          )}
        </span>
      </button>
      {open && (
      <>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 10 }}>
        <div className="scr" style={{ fontSize: 16 }}>Summon the Council</div>
        <p className="whisper" style={{ margin: "2px 0 8px", fontSize: 13 }}>
          {gathering ? `The invite for Gathering ${toRoman(gathering.number)} · ${gathering.theme_title}.` : "No gathering scheduled: summon one on Convene first."}
        </p>
        <RecipientChips list={inviteTo} onRemove={(e) => setInviteTo(inviteTo.filter((x) => x !== e))} addValue={inviteAdd} onAddChange={setInviteAdd} onAdd={() => add(inviteTo, inviteAdd, setInviteTo, () => setInviteAdd(""))} />
        <button className="btn gold" style={{ marginTop: 10, width: "auto", padding: "10px 20px" }} disabled={!gathering || busy !== null} onClick={() => send("invite", "invite", inviteTo, inviteParams)}>
          {busy === "invite" ? "Sending…" : "Send the summons"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
        <div className="scr" style={{ fontSize: 16 }}>Prove the calendar summons</div>
        <p className="whisper" style={{ margin: "2px 0 8px", fontSize: 13 }}>
          {gathering
            ? `Sends the real summons for Gathering ${toRoman(gathering.number)} to your own inbox, the very letter a member receives on answering a call. Open it on the vessel you wish to prove: the night should offer itself to your calendar, at ${gathering.gather_time || "19:00"} on ${fmtGDate(gathering.gather_date)}.`
            : "No gathering scheduled: summon one on Convene first."}
        </p>
        <button className="btn gold" style={{ width: "auto", padding: "10px 20px" }} disabled={!gathering || busy !== null}
          onClick={sendSummonsTest}>
          {busy === "summons" ? "Sending…" : "Send me the summons"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
        <div className="scr" style={{ fontSize: 16, color: "var(--wine)" }}>Call before the Tribunal</div>
        <p className="whisper" style={{ margin: "2px 0 8px", fontSize: 13 }}>Summon a member who has reached {DQ_THRESHOLD} disqualifications.</p>
        {summonedMembers.length === 0 ? (
          <p className="whisper" style={{ margin: 0, fontSize: 13 }}>No souls have reached the threshold.</p>
        ) : (
          <>
            <div className="pills" style={{ marginBottom: 8 }}>
              {summonedMembers.map((m) => (
                <span key={m.id} className={`pill${expelPick === m.id ? " on" : ""}`} onClick={() => pickExpel(m.id)}>{m.cult_name}</span>
              ))}
            </div>
            <RecipientChips list={expelTo} onRemove={(e) => setExpelTo(expelTo.filter((x) => x !== e))} addValue={expelAdd} onAddChange={setExpelAdd} onAdd={() => add(expelTo, expelAdd, setExpelTo, () => setExpelAdd(""))} />
            <button className="btn danger" style={{ marginTop: 10, width: "auto", padding: "10px 20px" }} disabled={!expelPick || busy !== null}
              onClick={() => { const m = members.find((x) => x.id === expelPick); send("expel", "expulsion", expelTo, { name: m?.cult_name, count: dq[m?.cult_name || ""] }); }}>
              {busy === "expel" ? "Sending…" : "Send the summons"}
            </button>
          </>
        )}
      </div>

      {msg && <p className="scr" style={{ marginTop: 12, fontSize: 15 }}>{msg}</p>}
      </>
      )}
    </div>
  );
}

// The snapshot the dirty-state bar compares against: what the record last
// held (loaded or saved). Any field drifting from it raises the bar.
interface ProfileSnapshot {
  name: string;
  dob: string;
  tob: string;
  tz: string;
  place: string;
  lat: number | null;
  lon: number | null;
  venue: string;
  title: string;
  avatar: string | null;
}

// Keiser-only: the gate ledger (ticket #12) — who entered, when, and from
// what vessel. Reads login_events, which RLS opens to the Keiser alone.
interface LoginEvent {
  id: string;
  email: string;
  at: string;
  user_agent: string | null;
  ip: string | null;
  member: { cult_name: string } | null;
}

const deviceOf = (ua: string | null): string => {
  if (!ua) return "an unknown vessel";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const platform = ua.match(/\(([^)]*)\)/)?.[1].split(";")[0].trim() || "";
  return [browser, platform].filter(Boolean).join(" · ") || ua.slice(0, 40);
};

function GateLedger() {
  // Folded by default, like the Heralds: nothing is fetched until opened.
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<LoginEvent[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !supabase) return;
    supabase
      .from("login_events")
      .select("id,email,at,user_agent,ip,member:members(cult_name)")
      .order("at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setFailed(error.message);
        else setEvents((data as unknown as LoginEvent[]) || []);
      });
  }, [open]);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}
      >
        <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />
        <span style={{ flex: 1 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: open ? 4 : 0 }}>The gate ledger</span>
          {open && (
            <span className="whisper" style={{ display: "block", fontSize: 13 }}>Every entry through the gate: who, when, and from what vessel. Your eyes alone, Keiser.</span>
          )}
        </span>
      </button>
      {open && (
      <>
      <div style={{ height: 10 }} />
      {failed ? (
        <p className="whisper" style={{ margin: 0, fontSize: 13, color: "#c98" }}>
          The ledger would not open: {failed}. (Has the login_events table been created?)
        </p>
      ) : !events ? (
        <Loading text="Opening the ledger…" />
      ) : events.length === 0 ? (
        <p className="whisper" style={{ margin: 0, fontSize: 14 }}>No entries yet. The gate has been quiet.</p>
      ) : (
        events.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 10, borderTop: "1px solid var(--line)", padding: "7px 0" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: "var(--gold2)" }}>
                {e.member?.cult_name || e.email}
              </span>
              <span className="whisper" style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {deviceOf(e.user_agent)}{e.ip ? ` · ${e.ip}` : ""}
              </span>
            </span>
            <span className="whisper" style={{ fontSize: 12, flex: "none" }}>
              {new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))
      )}
      </>
      )}
    </div>
  );
}

export default function Profile() {
  const { mode, role, member, email, setRole, signOut, sleeping } = useAuth();
  const self = mode === "demo" ? seedMembers.find((m) => m.role === role) : member;

  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [place, setPlace] = useState("");
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLon, setPlaceLon] = useState<number | null>(null);
  const [placeHits, setPlaceHits] = useState<GeoHit[] | null>(null); // null = not searched
  const [placeError, setPlaceError] = useState<string | null>(null); // the lookup itself failed
  const [seeking, setSeeking] = useState(false);
  const [venue, setVenue] = useState("");
  // Open by default, but it can be folded away.
  const [venueOpen, setVenueOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<ProfileSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const storeKey = `lcv_profile_${mode === "demo" ? role : email || "me"}`;

  useEffect(() => {
    const base: ProfileSnapshot = {
      name: mode === "demo" ? DEMO_NAMES[role] : self?.cult_name || email || "",
      dob: self?.date_of_birth || "",
      tob: self?.time_of_birth || "",
      tz: self?.birth_tz || DEFAULT_TZ,
      place: self?.birth_place || "",
      lat: self?.birth_lat ?? null,
      lon: self?.birth_lon ?? null,
      venue: self?.venue_instructions || "",
      title: self?.title || "",
      avatar: (self?.avatar_url as string | null) || null,
    };
    // Live: the Supabase member row is the source of truth. Demo: local storage.
    // (Overlaying local over the DB row was wiping saved details on reload.)
    if (mode === "demo") {
      try {
        const raw = localStorage.getItem(storeKey);
        if (raw) Object.assign(base, JSON.parse(raw));
      } catch {}
    }
    base.tz = base.tz || DEFAULT_TZ;
    setName(base.name);
    setDob(base.dob);
    setTob(base.tob);
    setTz(base.tz);
    setPlace(base.place);
    setPlaceLat(base.lat);
    setPlaceLon(base.lon);
    setPlaceHits(null);
    setPlaceError(null);
    setVenue(base.venue);
    setTitle(base.title);
    setAvatar(base.avatar);
    setBaseline(base);
    setEditingName(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, mode, self]);

  // Sun + element still computed silently: the members row keeps its zodiac
  // and element columns fresh for anything that reads them.
  const sun = dob ? sunSign(dob, tob || undefined, tz) : null;
  const element = sun?.element ?? null;
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // The dirty ledger: which fields have drifted from the last kept record.
  // Named, so the bar can say WHAT is unsaved — no silent losses (ticket #1).
  const dirtyFields = baseline
    ? ([
        name !== baseline.name && "Name",
        title !== baseline.title && "Title",
        dob !== baseline.dob && "Date of birth",
        tob !== baseline.tob && "Time of birth",
        tz !== baseline.tz && "Timezone",
        (place !== baseline.place || placeLat !== baseline.lat || placeLon !== baseline.lon) && "Place of birth",
        venue !== baseline.venue && "Venue instructions",
        avatar !== baseline.avatar && "Portrait",
      ].filter(Boolean) as string[])
    : [];

  const discard = () => {
    if (!baseline) return;
    setName(baseline.name);
    setDob(baseline.dob);
    setTob(baseline.tob);
    setTz(baseline.tz);
    setPlace(baseline.place);
    setPlaceLat(baseline.lat);
    setPlaceLon(baseline.lon);
    setPlaceHits(null);
    setPlaceError(null);
    setVenue(baseline.venue);
    setTitle(baseline.title);
    setAvatar(baseline.avatar);
    setEditingName(false);
  };

  // Look the birth town up in the atlas; picking a match pins its coordinates
  // and sets the timezone (which stays editable).
  const seekPlace = async () => {
    if (!place.trim()) return;
    setSeeking(true);
    const { hits, error } = await geocodePlace(place);
    setSeeking(false);
    setPlaceError(error);
    setPlaceHits(error ? null : hits);
    if (hits.length === 1) pickPlace(hits[0]);
  };
  const pickPlace = (h: GeoHit) => {
    setPlace(h.label);
    setPlaceLat(h.latitude);
    setPlaceLon(h.longitude);
    setTz(h.timezone);
    setPlaceHits([]);
    setPlaceError(null);
   
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRawFile(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const save = async () => {
    if (saving) return;
    // The seal throws; caught here it speaks through the toast the save bar
    // already uses, instead of dying as an unhandled rejection behind a
    // button that looks broken.
    try { assertWrite(); } catch (e) { setToast((e as Error).message); return; }
    setSaving(true);
    let keptAvatar = avatar;
    if (mode === "live" && supabase && email) {
      // Live: persist to the members row and surface any failure instead of
      // faking success (a swallowed error is why details kept vanishing).
      try {
        keptAvatar = avatar ? await uploadAvatar(email, avatar) : avatar;
      } catch (e) {
        alert(`Your portrait would not take: ${(e as Error).message}`);
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("members").update({
        cult_name: name.trim(),
        title: title.trim() || null,
        date_of_birth: dob || null,
        time_of_birth: tob || null,
        birth_place: place || null,
        birth_lat: placeLat,
        birth_lon: placeLon,
        birth_tz: tz || null,
        zodiac: sun?.name || null,
        element: element || null,
        venue_instructions: venue || null,
        avatar_url: keptAvatar,
      }).eq("email", email);
      if (error) { alert(`Could not save your profile: ${error.message}`); setSaving(false); return; }
    } else {
      try {
        localStorage.setItem(storeKey, JSON.stringify({ name, dob, tob, tz, place, lat: placeLat, lon: placeLon, venue, title, avatar }));
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("lcv-profile", { detail: { avatar: keptAvatar } }));
    // The kept record becomes the new baseline; the bar sinks away.
    setAvatar(keptAvatar);
    setBaseline({ name, dob, tob, tz, place, lat: placeLat, lon: placeLon, venue, title, avatar: keptAvatar });
    setSaving(false);
    setToast(`Saved: ${dirtyFields.join(", ")}. Your record is kept.`);
  };

  // The toast burns for a moment, then fades.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (rawFile) {
    return (
      <section>
        <h1 className="disp" style={{ fontSize: 18, fontWeight: 500, marginBottom: 14 }}>Frame your portrait</h1>
        <AvatarCropper src={rawFile} onSave={(url) => { setAvatar(url); setRawFile(null); }} onCancel={() => setRawFile(null)} />
      </section>
    );
  }

  return (
    <section style={{ paddingBottom: dirtyFields.length ? 96 : 0 }}>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>Your profile</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        Who the Council sees when you enter.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Change portrait"
            title="Change portrait"
            style={{ position: "relative", width: 64, height: 64, borderRadius: "50%", border: "none", padding: 0, background: "none", cursor: "pointer", flex: "none" }}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line2)", display: "block" }} />
            ) : (
              <span className="av" style={{ width: 64, height: 64, fontSize: 18 }}>{initials}</span>
            )}
            <span style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: "var(--gold2)", color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--ink)" }}>
              <i className="ti ti-camera" style={{ fontSize: 12 }} />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPick} />

          <div>
            {editingName ? (
              <input
                value={name}
                autoFocus
                onChange={(e) => { setName(e.target.value); }}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                style={{ maxWidth: 220 }}
              />
            ) : (
              <div className="scr" onClick={() => setEditingName(true)} title="Click to rename" style={{ fontSize: 20, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                {name || "Your name"}
                <i className="ti ti-pencil" style={{ fontSize: 12, color: "var(--dim)" }} aria-hidden="true" />
              </div>
            )}
            <div style={{ marginTop: 5 }}><span className="tag">{role}</span></div>
          </div>
        </div>
        <label className="field" style={{ marginTop: 12 }}>Title</label>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value.slice(0, 60)); }}
          placeholder="Warden of the Western Cellars… (optional)"
        />
        <p className="whisper" style={{ margin: "6px 0 0", fontSize: 13 }}>
          Neither as long as a bio nor as short as a salutation. Worn on your card in place of the moon phase.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>The stars that made you</div>
        <p className="whisper" style={{ margin: "0 0 8px", fontSize: 13 }}>
          Give your birth and your chart is drawn from it, never set by hand.
        </p>
        <div className="birth-fields">
          <div>
            <label className="field" style={{ marginTop: 8 }}>Date of birth</label>
            <input type="date" value={dob} onChange={(e) => { setDob(e.target.value); }} />
          </div>
          <div>
            <label className="field" style={{ marginTop: 8 }}>Time of birth</label>
            <input type="time" value={tob} onChange={(e) => { setTob(e.target.value); }} />
          </div>
        </div>

        <label className="field" style={{ marginTop: 10 }}>Timezone of birth</label>
        <select value={tz} onChange={(e) => { setTz(e.target.value); }} style={{ colorScheme: "dark" }}>
          {curatedTimezones(tz).map((z) => (
            <option key={z.tz} value={z.tz}>{z.label}</option>
          ))}
        </select>

        <label className="field" style={{ marginTop: 10 }}>Place of birth</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={place}
            onChange={(e) => { setPlace(e.target.value); setPlaceLat(null); setPlaceLon(null); setPlaceHits(null); setPlaceError(null); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), seekPlace())}
            placeholder="Cape Town"
            style={{ flex: 1 }}
          />
          <button className="btn" style={{ width: "auto", padding: "0 14px" }} onClick={seekPlace} disabled={seeking || !place.trim()}>
            {seeking ? "Seeking…" : "Mark it"}
          </button>
        </div>
        {placeLat != null && (
          <p className="whisper" style={{ margin: "6px 0 0", fontSize: 13 }}>
            <i className="ti ti-map-pin" style={{ fontSize: 12, marginRight: 4 }} />The atlas knows it. Your chart is drawn from this place.
          </p>
        )}
        {placeHits && placeHits.length > 1 && (
          <div className="pills" style={{ marginTop: 8 }}>
            {placeHits.map((h) => (
              <span key={h.label} className="pill" onClick={() => pickPlace(h)}>{h.label}</span>
            ))}
          </div>
        )}
        {placeHits && placeHits.length === 0 && placeLat == null && (
          <p className="whisper" style={{ margin: "6px 0 0", fontSize: 13 }}>The atlas does not know it. Try adding the region, or the nearest larger town.</p>
        )}
        {placeError && (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#c98" }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 12, marginRight: 4 }} />
            The lookup failed: {placeError}. Try again in a moment.
          </p>
        )}

        <p className="whisper" style={{ margin: "14px 0 0", fontSize: 13 }}>
          Your chart is drawn from these. Behold it, and all it derives, on your card and under Your sky below.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setVenueOpen((o) => !o)}
          aria-expanded={venueOpen}
          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}
        >
          <i className={`ti ti-chevron-${venueOpen ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />
          <span style={{ flex: 1 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: venueOpen ? 4 : 0 }}>Your venue instructions</span>
            {venueOpen && (
              <span className="whisper" style={{ display: "block", fontSize: 13 }}>Shared in the invite when you host.</span>
            )}
          </span>
        </button>
        {venueOpen && (
          <>
            <div style={{ height: 10 }} />
            <textarea value={venue} onChange={(e) => { setVenue(e.target.value); }} placeholder="Gate codes, parking, the dog…" />
          </>
        )}
      </div>

      {sleeping && <AskToWake />}

      <YourSky
        self={{ id: self?.id, cult_name: name || "You", avatar_url: avatar, role, date_of_birth: dob || null, time_of_birth: tob || null, birth_place: place || null, birth_lat: placeLat, birth_lon: placeLon, birth_tz: tz }}
        email={email}
      />

      <RosterEditor />
      {role === "keiser" && <HeraldsEditor />}
      {role === "keiser" && mode === "live" && <GateLedger />}

      <FeatureWish />

      {mode === "demo" ? (
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 6 }}>View as</div>
          <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
            A preview aid while access isn&rsquo;t enforced: walk the tiers to see what each rank sees.
          </p>
          <div className="pills">
            {ROLES.map((r) => (
              <span key={r} className={`pill${role === r ? " on" : ""}`} onClick={() => setRole(r)}>{r}</span>
            ))}
          </div>
        </div>
      ) : (
        <button className="btn" style={{ maxWidth: 220 }} onClick={signOut}>
          <i className="ti ti-logout" style={{ marginRight: 6 }} /> Depart the Council
        </button>
      )}

      {/* The dirty-state bar (ticket #1, Option II): rises only while fields
          have drifted from the kept record, names them, and offers the only
          Save. Nothing can be edited and silently lost — the bar stands until
          the change is kept or discarded. */}
      {dirtyFields.length > 0 && (
        <div
          className="lcv-riseup"
          role="status"
          style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, background: "#0d0b0a", borderTop: "1px solid var(--line2)", boxShadow: "0 -12px 34px rgba(0,0,0,0.6)" }}
        >
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "12px 18px calc(12px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 200px", minWidth: 0 }}>
              <span className="disp" style={{ fontSize: 13, display: "block" }}>
                {dirtyFields.length} unsaved change{dirtyFields.length === 1 ? "" : "s"}
              </span>
              <span className="whisper" style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {dirtyFields.join(", ")}
              </span>
            </span>
            <button className="btn" style={{ width: "auto", padding: "9px 16px", flex: "none" }} onClick={discard} disabled={saving}>
              Discard
            </button>
            <button className="btn gold" style={{ width: "auto", padding: "9px 20px", flex: "none" }} onClick={save} disabled={saving || sleeping}>
              {saving ? "Sealing…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation toast: what was saved, in so many words. */}
      {toast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 22, zIndex: 70, display: "flex", justifyContent: "center", pointerEvents: "none", padding: "0 18px" }}>
          <div className="lcv-riseup" role="status" style={{ background: "#0d0b0a", border: "1px solid var(--gold)", borderRadius: 12, padding: "10px 18px", color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, boxShadow: "0 14px 44px rgba(0,0,0,0.65)", maxWidth: 480 }}>
            <i className="ti ti-check" style={{ fontSize: 13, marginRight: 7 }} />
            {toast}
          </div>
        </div>
      )}
    </section>
  );
}


// The two doors to your own sky, each with an envelope that emails it to
// your own inbox. The send route only ever accepts your own address.
// Ask the builders: a member's feature wish, relayed to the Keiser's inbox.
// Folded by default, like the Heralds: an occasional instrument.
function FeatureWish() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const submit = async () => {
    const t = text.trim();
    if (!t || state === "sending") return;
    setState("sending");
    const res = await sendEmail("feature", ["keiser"], { text: t });
    if (res.ok) { setState("sent"); setText(""); }
    else { setState("failed"); alert(`The wish would not carry: ${res.error || res.skipped || "unknown"}`); }
  };
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}
      >
        <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />
        <span style={{ flex: 1 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: open ? 4 : 0, fontSize: 14 }}>Feature request</span>
          {open && (
            <span className="whisper" style={{ display: "block", fontSize: 13 }}>Something the Council should be able to do? Whisper it here and it is carried to the Keiser.</span>
          )}
        </span>
      </button>
      {open && (
      <>
      <div style={{ height: 10 }} />
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); if (state === "sent") setState("idle"); }}
        placeholder="I wish the Council could…"
        maxLength={2000}
        rows={3}
        style={{ width: "100%", resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <button className="btn gold" style={{ width: "auto", padding: "10px 22px" }} onClick={submit} disabled={!text.trim() || state === "sending"}>
          {state === "sending" ? "Carrying…" : "Send the wish"}
        </button>
        {state === "sent" && <span className="scr" style={{ fontSize: 15 }}>The Keiser will hear of it.</span>}
      </div>
      </>
      )}
    </div>
  );
}

// The one word left to a sleeping seat: a plea carried to the Keiser by hand.
// It writes NOTHING to the Council's records (the seal holds); it only asks,
// which is why the send-email route lets this one type through while asleep.
function AskToWake() {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const ask = async () => {
    if (state === "sending") return;
    setState("sending");
    const res = await sendEmail("wake", ["keiser"], { text: text.trim() });
    if (res.ok) { setState("sent"); setText(""); }
    else { setState("idle"); alert(`The word would not carry: ${res.error || res.skipped || "unknown"}`); }
  };
  return (
    <div className="card" data-sleep-ok style={{ marginBottom: 16, borderColor: "rgba(140,138,130,0.45)" }}>
      <div className="eyebrow" style={{ marginBottom: 4, fontSize: 12, color: "#8d8b85" }}>The one word left to you</div>
      <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
        A plea to wake is carried to the Keiser by hand. It writes nothing; it only asks.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); if (state === "sent") setState("idle"); }}
        placeholder="A word with your asking, if you wish…"
        maxLength={2000}
        rows={2}
        style={{ width: "100%", resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <button className="btn" style={{ width: "auto", padding: "10px 22px" }} onClick={ask} disabled={state === "sending"}>
          <i className="ti ti-bell" style={{ fontSize: 14, marginRight: 6 }} />
          {state === "sending" ? "Carrying…" : "Ask to wake"}
        </button>
        {state === "sent" && <span className="scr" style={{ fontSize: 15 }}>The Keiser will hear of it.</span>}
      </div>
    </div>
  );
}

function YourSky({ self, email }: { self: CardMember; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(t);
  }, [open]);
  const close = () => { setShown(false); setTimeout(() => setOpen(false), 240); };
  void email; // the envelope lives inside the Heavens now
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 10, textAlign: "center", fontSize: 12 }}>Your sky</div>
      <button className="btn gold" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setOpen(true)}>
        <i className="ti ti-moon-stars" />The Heavens
      </button>
      <p className="whisper" style={{ textAlign: "center", margin: "12px 0 0", fontSize: 13 }}>
        the wheel, the foretelling, and the kundli behind one door; every view carries its own envelope
      </p>
      {open && (
        <AstralShell shown={shown} onClose={close}>
          <HeavensFace member={self} isSelf onGo={close} />
        </AstralShell>
      )}
    </div>
  );
}
