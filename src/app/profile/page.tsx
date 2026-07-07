"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { seedMembers } from "@/lib/seed";
import { loadMembers, saveMember, removeMember } from "@/lib/members";
import { deleteApplicationsByEmail } from "@/lib/applications";
import { fetchCurrentGathering } from "@/lib/gatherings";
import { fetchDqCounts, DQ_THRESHOLD } from "@/lib/annals";
import { sendEmail } from "@/lib/sendEmail";
import { supabase } from "@/lib/supabase";
import { sunSign, moonSign, risingSign, shengxiao, wuXing } from "@/lib/astrology";
import { toRoman } from "@/lib/util";
import AvatarCropper from "@/components/AvatarCropper";
import MemberCard from "@/components/MemberCard";
import type { Role, Member, Gathering } from "@/lib/types";

const fmtGDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "";

const DEMO_NAMES: Record<Role, string> = {
  initiate: "Cassian Vale",
  member: "Priestess Larissa",
  keiser: "The Keiser",
};
const ROLES: Role[] = ["initiate", "member", "keiser"];

const SUN_TIP = 'Your core identity, ego, and life purpose (what most people call their "star sign").';
const MOON_TIP = "Your inner emotions, subconscious, and private self.";
const ASC_TIP = "The sign that was rising on the eastern horizon at your exact birth time. It represents your outward personality, first impressions, and how others perceive you.";
const SX_TIP = "The Chinese zodiac is a 12-year cycle where each year is represented by a specific animal.";
const WX_TIP = "The five elements govern your deeper personality traits, destiny, and how you interact with the universe.";

function InfoTip({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 5 }}>
      <button
        type="button"
        aria-label="More"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--dim)", display: "inline-flex", width: "auto" }}
      >
        <i className="ti ti-info-circle" style={{ fontSize: 13 }} />
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 6px)", [align]: 0, zIndex: 30,
            width: 232, background: "#0d0b0a", border: "1px solid var(--line2)", borderRadius: 8,
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

// Keiser-only: the full roster, every account editable in place.
function RosterEditor() {
  const { mode } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
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
      supabase
        .from("members")
        .select("*")
        .order("role")
        .then(({ data, error }) => {
          if (error) console.error("Could not load roster:", error.message);
          else if (data) setMembers(data as Member[]);
        });
    } else {
      setMembers(loadMembers());
    }
  }, [mode]);

  const edit = async (id: string, patch: Partial<Member>) => {
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
      <div className="eyebrow" style={{ marginBottom: 4 }}>The council roster</div>
      <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
        Every soul&rsquo;s account. Yours to amend — the Keiser alone sees this.
      </p>
      <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickPhoto} />
      {members.map((m) => {
        const open = openId === m.id;
        return (
          <div key={m.id} style={{ borderTop: "1px solid var(--line)", padding: "9px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MemberCard member={m} size={30} />
              <button
                onClick={() => setOpenId(open ? null : m.id)}
                style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 0 }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: "var(--gold2)" }}>{m.cult_name}</span>
                  <span className="whisper" style={{ fontSize: 12, display: "block" }}>{m.email}</span>
                </span>
                <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ color: "var(--gold)", flex: "none" }} />
              </button>
              {m.role === "initiate" && (
                <button onClick={() => edit(m.id, { role: "member" })} title="Elevate to full member"
                  style={{ width: "auto", flex: "none", background: "none", border: "1px solid var(--line2)", borderRadius: 14, color: "var(--gold2)", padding: "4px 12px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  <i className="ti ti-arrow-big-up-lines" style={{ fontSize: 12, marginRight: 4 }} />Elevate
                </button>
              )}
              <span className="tag" style={{ opacity: m.active ? 1 : 0.4, flex: "none" }}>{m.role}</span>
            </div>
            {open && (
              <div style={{ paddingLeft: 40, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {cropId === m.id && cropSrc ? (
                  <div>
                    <label className="field" style={{ marginTop: 0 }}>Frame their portrait</label>
                    <AvatarCropper
                      src={cropSrc}
                      onSave={(url) => { edit(m.id, { avatar_url: url }); setCropSrc(null); setCropId(null); }}
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
                  <input value={m.cult_name} onChange={(e) => edit(m.id, { cult_name: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: "1 1 60%" }}>
                    <label className="field" style={{ marginTop: 0 }}>Email</label>
                    <input value={m.email} onChange={(e) => edit(m.id, { email: e.target.value })} />
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
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: "var(--parch)" }}>
                  <input type="checkbox" checked={m.active} onChange={(e) => edit(m.id, { active: e.target.checked })} style={{ width: "auto" }} />
                  Active in the Council
                </label>
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
  const { mode } = useAuth();
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
    (async () => {
      const mem = mode === "live" && supabase ? ((await supabase.from("members").select("*")).data as Member[] || []) : loadMembers();
      setMembers(mem);
      setInviteTo(mem.filter((m) => m.active !== false).map((m) => m.email).filter(Boolean));
      setGathering(await fetchCurrentGathering());
      setDq(await fetchDqCounts());
    })();
  }, [mode]);

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

  const send = async (kind: string, type: "invite" | "expulsion", to: string[], params: Record<string, unknown>) => {
    if (!to.length) { setMsg("Add at least one recipient."); return; }
    if (!window.confirm(`Send to ${to.length} recipient${to.length === 1 ? "" : "s"}?`)) return;
    setBusy(kind); setMsg(null);
    const res = await sendEmail(type, to, params);
    setBusy(null);
    if (res.skipped) setMsg("Email isn't configured yet — set RESEND_API_KEY + NOTIFY_FROM in Netlify.");
    else if (res.ok) setMsg(`Sent to ${res.sent}.`);
    else setMsg(res.error || `Sent ${res.sent || 0}; ${res.failed || 0} failed.`);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Heralds</div>
      <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>Send the Council&rsquo;s branded emails by hand — nothing here fires automatically.</p>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div className="scr" style={{ fontSize: 16 }}>Summon the Council</div>
        <p className="whisper" style={{ margin: "2px 0 8px", fontSize: 13 }}>
          {gathering ? `The invite for Gathering ${toRoman(gathering.number)} — ${gathering.theme_title}.` : "No gathering scheduled — summon one on Convene first."}
        </p>
        <RecipientChips list={inviteTo} onRemove={(e) => setInviteTo(inviteTo.filter((x) => x !== e))} addValue={inviteAdd} onAddChange={setInviteAdd} onAdd={() => add(inviteTo, inviteAdd, setInviteTo, () => setInviteAdd(""))} />
        <button className="btn gold" style={{ marginTop: 10, width: "auto", padding: "10px 20px" }} disabled={!gathering || busy !== null} onClick={() => send("invite", "invite", inviteTo, inviteParams)}>
          {busy === "invite" ? "Sending…" : "Send the summons"}
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
    </div>
  );
}

export default function Profile() {
  const { mode, role, member, email, setRole, signOut } = useAuth();
  const self = mode === "demo" ? seedMembers.find((m) => m.role === role) : member;

  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [venue, setVenue] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const storeKey = `lcv_profile_${mode === "demo" ? role : email || "me"}`;

  useEffect(() => {
    const base = {
      name: mode === "demo" ? DEMO_NAMES[role] : self?.cult_name || email || "",
      dob: self?.date_of_birth || "",
      tob: self?.time_of_birth || "",
      venue: self?.venue_instructions || "",
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
    setName(base.name);
    setDob(base.dob);
    setTob(base.tob);
    setVenue(base.venue);
    setAvatar(base.avatar);
    setSaved(false);
    setEditingName(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, mode, self]);

  const sun = dob ? sunSign(dob) : null;
  const element = sun?.element ?? null;
  const moon = dob ? moonSign(dob, tob || undefined) : null;
  const rising = dob && tob ? risingSign(dob, tob) : null;
  const animal = dob ? shengxiao(dob) : null;
  const wx = dob ? wuXing(dob) : null;
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const touch = () => setSaved(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRawFile(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const save = async () => {
    if (mode === "live" && supabase && email) {
      // Live: persist to the members row and surface any failure instead of
      // faking success (a swallowed error is why details kept vanishing).
      const { error } = await supabase.from("members").update({
        cult_name: name,
        date_of_birth: dob || null,
        time_of_birth: tob || null,
        zodiac: sun?.name || null,
        element: element || null,
        venue_instructions: venue || null,
        avatar_url: avatar,
      }).eq("email", email);
      if (error) { alert(`Could not save your profile: ${error.message}`); return; }
    } else {
      try {
        localStorage.setItem(storeKey, JSON.stringify({ name, dob, tob, venue, avatar }));
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("lcv-profile", { detail: { avatar } }));
    setSaved(true);
  };

  if (rawFile) {
    return (
      <section>
        <h1 className="disp" style={{ fontSize: 18, fontWeight: 500, marginBottom: 14 }}>Frame your portrait</h1>
        <AvatarCropper src={rawFile} onSave={(url) => { setAvatar(url); setRawFile(null); touch(); }} onCancel={() => setRawFile(null)} />
      </section>
    );
  }

  return (
    <section>
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
                onChange={(e) => { setName(e.target.value); touch(); }}
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
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>The stars that made you</div>
        <p className="whisper" style={{ margin: "0 0 8px", fontSize: 13 }}>
          Give your birth and the chart is drawn — everything below is read from it, not set by hand.
        </p>
        <div className="birth-fields">
          <div>
            <label className="field" style={{ marginTop: 8 }}>Date of birth</label>
            <input type="date" value={dob} onChange={(e) => { setDob(e.target.value); touch(); }} />
          </div>
          <div>
            <label className="field" style={{ marginTop: 8 }}>Time of birth</label>
            <input type="time" value={tob} onChange={(e) => { setTob(e.target.value); touch(); }} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          <Row label="Element" value={element || "—"} hint={!element ? "add your date of birth" : undefined} />
          <Row label="Sun sign" tip={SUN_TIP} value={sun ? `${sun.symbol} ${sun.name}` : "—"} hint={!sun ? "add your date of birth" : undefined} />
          <Row label="Moon sign" tip={MOON_TIP} value={moon ? `${moon.symbol} ${moon.name}` : "—"} hint={!moon ? "add your date of birth" : undefined} />
          <Row label="Ascendant" tip={ASC_TIP} value={rising ? `${rising.symbol} ${rising.name}` : "—"} hint={!rising ? "add date + time of birth" : undefined} />
          <Row label="Shengxiao" tip={SX_TIP} value={animal ? `${animal.symbol} ${animal.name}` : "—"} hint={!animal ? "add your date of birth" : undefined} />
          <Row label="Wu Xing" tip={WX_TIP} value={wx ? `${wx.symbol} ${wx.name}` : "—"} valueTip={wx?.meaning} hint={!wx ? "add your date of birth" : undefined} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="field" style={{ marginTop: 0 }}>Your venue instructions</label>
        <p className="whisper" style={{ margin: "0 0 8px", fontSize: 13 }}>Shared in the invite when you host.</p>
        <textarea value={venue} onChange={(e) => { setVenue(e.target.value); touch(); }} placeholder="Gate codes, parking, the dog…" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button className="btn gold" style={{ width: "auto", padding: "12px 26px" }} onClick={save} disabled={saved}>
          {saved ? "Sealed" : "Save changes"}
        </button>
        {saved && <span className="scr" style={{ fontSize: 15 }}>Your record is kept.</span>}
      </div>

      {role === "keiser" && <RosterEditor />}
      {role === "keiser" && <HeraldsEditor />}

      {mode === "demo" ? (
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 6 }}>View as</div>
          <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
            A preview aid while access isn&rsquo;t enforced — walk the tiers to see what each rank sees.
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
    </section>
  );
}
