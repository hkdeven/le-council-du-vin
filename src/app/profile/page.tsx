"use client";

import { useAuth } from "@/components/AuthProvider";
import { seedMembers } from "@/lib/seed";
import type { Role } from "@/lib/types";

const DEMO_NAMES: Record<Role, string> = {
  initiate: "Cassian Vale",
  member: "Sister Mara",
  keiser: "The Keiser",
};
const ROLES: Role[] = ["initiate", "member", "keiser"];

export default function Profile() {
  const { mode, role, member, email, setRole, signOut } = useAuth();

  const name = mode === "demo" ? DEMO_NAMES[role] : member?.cult_name || email || "You";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const self = mode === "demo" ? seedMembers.find((m) => m.role === role) : member;

  return (
    <section>
      <h1 className="disp" style={{ fontSize: 18, fontWeight: 500 }}>Your profile</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2, marginBottom: 18 }}>
        Who the Council sees when you enter.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="av" style={{ width: 52, height: 52, fontSize: 16 }}>{initials}</div>
          <div>
            <div className="scr" style={{ fontSize: 20 }}>{name}</div>
            <span className="tag" style={{ marginTop: 4 }}>{role}</span>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {email && <Row label="Sigil" value={email} />}
          {self?.zodiac && <Row label="Star" value={self.zodiac} />}
          {self?.element && <Row label="Element" value={self.element} />}
        </div>
      </div>

      {self?.venue_instructions && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Your venue instructions</div>
          <p className="whisper" style={{ margin: "0 0 8px", fontSize: 13 }}>
            Shared in the invite when you host.
          </p>
          <p style={{ margin: 0 }}>{self.venue_instructions}</p>
        </div>
      )}

      {mode === "demo" ? (
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 6 }}>View as</div>
          <p className="whisper" style={{ margin: "0 0 10px", fontSize: 13 }}>
            A preview aid while access isn&rsquo;t enforced — walk the tiers to see what each rank sees.
          </p>
          <div className="pills">
            {ROLES.map((r) => (
              <span key={r} className={`pill${role === r ? " on" : ""}`} onClick={() => setRole(r)}>
                {r}
              </span>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span className="eyebrow">{label}</span>
      <span style={{ color: "var(--parch)", fontSize: 14 }}>{value}</span>
    </div>
  );
}
