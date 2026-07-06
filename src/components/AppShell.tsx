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
  { href: "/oracle", label: "Oracle", icon: "ti-crystal-ball", min: "member" },
  { href: "/tribunal", label: "Tribunal", icon: "ti-gavel", min: "keiser" },
  { href: "/codex", label: "Codex", icon: "ti-chart-radar", min: "member" },
];

const PUBLIC = ["/", "/initiation"];
const DEMO_NAMES: Record<Role, string> = {
  initiate: "Cassian Vale",
  member: "Sister Mara",
  keiser: "The Keiser",
};

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", padding: "70px 0" }}>{children}</div>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, loading, signedIn, hasAccess, role, member, email } = useAuth();

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

  const profileName = mode === "demo" ? DEMO_NAMES[role] : member?.cult_name || email || "You";
  const initials = profileName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

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
        <Link href="/" aria-label="The gate" style={{ display: "flex", flex: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site-mark.png" alt="" width={34} height={34} style={{ display: "block" }} />
        </Link>
        <div className="disp" style={{ fontSize: 14, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
          Le Council du Vin
        </div>

        <Link
          href="/profile"
          aria-label="Your profile"
          title="Your profile"
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flex: "none" }}
        >
          <span className="eyebrow" style={{ fontSize: 9 }}>{role}</span>
          <span className="av" style={{ width: 34, height: 34 }}>{initials}</span>
        </Link>
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
