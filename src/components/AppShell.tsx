"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Emblem from "./Emblem";
import { useAuth, ROLE_RANK } from "./AuthProvider";
import type { Role } from "@/lib/types";

const NAV: { href: string; label: string; icon: string; min: Role }[] = [
  { href: "/convene", label: "Convene", icon: "ti-moon", min: "initiate" },
  { href: "/rite", label: "The rite", icon: "ti-glass-full", min: "initiate" },
  { href: "/reveal", label: "Reveal", icon: "ti-eye", min: "initiate" },
  { href: "/almanac", label: "Almanac", icon: "ti-book", min: "member" },
  { href: "/tribunal", label: "Tribunal", icon: "ti-gavel", min: "keiser" },
  { href: "/codex", label: "Codex", icon: "ti-chart-radar", min: "member" },
];

const ROLES: Role[] = ["initiate", "member", "keiser"];
const PUBLIC = ["/", "/initiation"];

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", padding: "70px 0" }}>{children}</div>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, loading, signedIn, hasAccess, role, member, email, setRole, signOut } = useAuth();

  const bare = PUBLIC.includes(pathname);

  // Enforce login on every protected route (live mode only — demo stays open).
  useEffect(() => {
    if (mode === "live" && !loading && !bare && !signedIn) {
      router.replace("/");
    }
  }, [mode, loading, bare, signedIn, router]);

  if (bare) {
    return (
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "0 18px" }}>
        {children}
      </main>
    );
  }

  // Protected route states (live mode).
  if (mode === "live") {
    if (loading) {
      return (
        <Centered>
          <i className="ti ti-loader-2" style={{ fontSize: 26, color: "var(--gold)" }} aria-hidden="true" />
          <p className="whisper" style={{ fontSize: 15, marginTop: 10 }}>Consulting the register…</p>
        </Centered>
      );
    }
    if (!signedIn) {
      return (
        <Centered>
          <p className="whisper" style={{ fontSize: 16 }}>The gate is barred. Redirecting…</p>
        </Centered>
      );
    }
    if (!hasAccess) {
      return (
        <Centered>
          <Emblem size={84} />
          <p className="whisper" style={{ fontSize: 16, maxWidth: 400, margin: "14px auto 0" }}>
            You are known to the gate, but not yet of the Council. Your petition awaits the Keiser&rsquo;s decree.
          </p>
          <button className="btn" style={{ width: "auto", padding: "12px 24px", marginTop: 22 }} onClick={signOut}>
            Withdraw
          </button>
        </Centered>
      );
    }
  }

  const active = NAV.find((n) => pathname.startsWith(n.href));
  const allowed = active ? ROLE_RANK[role] >= ROLE_RANK[active.min] : true;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          background: "#0a0908",
        }}
      >
        <Link href="/" aria-label="The gate" style={{ display: "flex" }}>
          <Emblem size={36} />
        </Link>
        <div className="disp" style={{ fontSize: 14, letterSpacing: "0.15em", lineHeight: 1.1 }}>
          Le Council du Vin
          <span className="scr" style={{ display: "block", fontSize: 12, letterSpacing: 0, color: "var(--dim)" }}>
            in vino veritas
          </span>
        </div>

        {mode === "demo" ? (
          <div
            className="roles"
            style={{ marginLeft: "auto", display: "flex", border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden" }}
            aria-label="View as role"
          >
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  background: role === r ? "var(--gold2)" : "none",
                  color: role === r ? "#0a0a0a" : "var(--dim)",
                  border: "none",
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div className="scr" style={{ fontSize: 15 }}>{member?.cult_name || email}</div>
              <div className="eyebrow" style={{ fontSize: 8.5 }}>{role}</div>
            </div>
            <button
              onClick={signOut}
              aria-label="Depart"
              title="Depart"
              style={{ width: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--dim)", padding: "7px 9px", cursor: "pointer" }}
            >
              <i className="ti ti-logout" />
            </button>
          </div>
        )}
      </header>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          padding: "8px 12px",
          borderBottom: "1px solid var(--line)",
          background: "#080706",
        }}
      >
        {NAV.filter((n) => ROLE_RANK[role] >= ROLE_RANK[n.min]).map((n) => {
          const on = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                color: on ? "var(--gold2)" : "var(--dim)",
                background: on ? "rgba(160,150,120,0.1)" : "none",
                fontFamily: "'Cinzel', serif",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "7px 10px",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 5,
                textDecoration: "none",
              }}
            >
              <i className={`ti ${n.icon}`} aria-hidden="true" />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <main style={{ padding: 22, minHeight: 440 }}>
        {allowed ? (
          children
        ) : (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <i className="ti ti-lock" style={{ fontSize: 30, color: "var(--gold)" }} aria-hidden="true" />
            <p className="whisper" style={{ fontSize: 16, marginTop: 12 }}>
              This chamber is sealed to your rank. The Council sees you, but does not yet trust you.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
