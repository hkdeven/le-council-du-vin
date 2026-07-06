"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { seedMembers } from "@/lib/seed";
import { supabase } from "@/lib/supabase";
import { sunSign, moonSign, risingSign, shengxiao, wuXing } from "@/lib/astrology";
import AvatarCropper from "@/components/AvatarCropper";
import type { Role } from "@/lib/types";

const DEMO_NAMES: Record<Role, string> = {
  initiate: "Cassian Vale",
  member: "Sister Larissa",
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
    let base = {
      name: mode === "demo" ? DEMO_NAMES[role] : self?.cult_name || email || "",
      dob: self?.date_of_birth || "",
      tob: self?.time_of_birth || "",
      venue: self?.venue_instructions || "",
      avatar: (self?.avatar_url as string | null) || null,
    };
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) base = { ...base, ...JSON.parse(raw) };
    } catch {}
    setName(base.name);
    setDob(base.dob);
    setTob(base.tob);
    setVenue(base.venue);
    setAvatar(base.avatar);
    setSaved(false);
    setEditingName(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, mode]);

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
    try {
      localStorage.setItem(storeKey, JSON.stringify({ name, dob, tob, venue, avatar }));
    } catch {}
    if (supabase && email) {
      await supabase.from("members").update({
        cult_name: name,
        date_of_birth: dob || null,
        time_of_birth: tob || null,
        zodiac: sun?.name || null,
        element: element || null,
        venue_instructions: venue || null,
        avatar_url: avatar,
      }).eq("email", email);
    }
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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}>
            <label className="field" style={{ marginTop: 8 }}>Date of birth</label>
            <input type="date" value={dob} onChange={(e) => { setDob(e.target.value); touch(); }} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
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
