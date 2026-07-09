"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Emblem from "./Emblem";
import Avatar from "./Avatar";
import { useAuth, ROLE_RANK } from "./AuthProvider";
import { fetchPendingCount } from "@/lib/applications";
import { fetchCurrentGathering } from "@/lib/gatherings";
import { useRiteOpen } from "@/lib/useRiteOpen";
import type { Gathering, Role } from "@/lib/types";

const NAV: { href: string; label: string; icon: string; min: Role }[] = [
  { href: "/convene", label: "Convene", icon: "ti-moon", min: "initiate" },
  { href: "/rite", label: "The rite", icon: "ti-glass-full", min: "initiate" },
  { href: "/reveal", label: "Reveal", icon: "ti-eye", min: "initiate" },
  { href: "/oracle", label: "Oracle", icon: "ti-crystal-ball", min: "member" },
  { href: "/tribunal", label: "Tribunal", icon: "ti-gavel", min: "keiser" },
  { href: "/codex", label: "Codex", icon: "ti-chart-radar", min: "member" },
];

const PUBLIC = ["/", "/initiation", "/reset"];
const DEMO_NAMES: Record<Role, string> = {
  initiate: "Cassian Vale",
  member: "Priestess Larissa",
  keiser: "The Keiser",
};

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", padding: "70px 0" }}>{children}</div>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, loading, signedIn, hasAccess, role, member, email, avatar, signOut } = useAuth();

  const bare = PUBLIC.includes(pathname);

  // Enforce login on every protected route (live mode only — demo stays open).
  useEffect(() => {
    if (mode === "live" && !loading && !bare && !signedIn) {
      router.replace("/");
    }
  }, [mode, loading, bare, signedIn, router]);

  // The rite tab only appears once the rite opens (same clock as the
  // "Enter the rite" button); useRiteOpen re-renders the moment it does.
  const [gathering, setGathering] = useState<Gathering | null>(null);
  useEffect(() => {
    if (bare) return;
    fetchCurrentGathering().then(setGathering).catch(() => {});
  }, [mode, bare]);
  const riteOpen = useRiteOpen(gathering);

  // Pending petitions → a badge on the Tribunal tab so the Keiser sees new
  // initiates on login. Refreshes as they move around and on submit/decree.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (role !== "keiser") { setPending(0); return; }
    const refresh = () => fetchPendingCount().then(setPending).catch(() => {});
    refresh();
    window.addEventListener("lcv-applications", refresh);
    return () => window.removeEventListener("lcv-applications", refresh);
  }, [role, pathname]);

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
          <i className="ti ti-loader-2 lcv-spin" style={{ fontSize: 26, color: "var(--gold)" }} aria-hidden="true" />
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
    <div>
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "#0a0908",
        }}
      >
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
        <Link href="/convene" aria-label="The convening" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", flex: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site-mark.png" alt="" width={34} height={34} style={{ display: "block" }} />
          <span className="disp" style={{ fontSize: 14, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
            Le Council du Vin
          </span>
        </Link>

        <Link
          href="/profile"
          aria-label="Your profile"
          title="Your profile"
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flex: "none" }}
        >
          <span className="eyebrow" style={{ fontSize: 9 }}>{role}</span>
          <Avatar src={avatar} initials={initials} size={34} />
        </Link>
        </div>
      </header>

      <nav
        style={{
          borderBottom: "1px solid var(--line)",
          background: "#080706",
        }}
      >
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 2, padding: "8px 12px" }}>
        {NAV.filter((n) => ROLE_RANK[role] >= ROLE_RANK[n.min])
          .filter((n) => (n.href !== "/rite" && n.href !== "/reveal") || riteOpen)
          .map((n) => {
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
              {n.href === "/tribunal" && pending > 0 && (
                <span
                  aria-label={`${pending} petition${pending === 1 ? "" : "s"} awaiting`}
                  style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--wine)", color: "#fff", fontFamily: "'EB Garamond', serif", fontSize: 11, letterSpacing: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: 1 }}
                >
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
        </div>
      </nav>

      <main>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: 22, minHeight: 440 }}>
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
        </div>
      </main>
    </div>
  );
}
