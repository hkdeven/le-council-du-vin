"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Emblem from "./Emblem";
import Avatar from "./Avatar";
import { useAuth, ROLE_RANK } from "./AuthProvider";
import { fetchPendingCount } from "@/lib/applications";
import { fetchCurrentGathering, revealWindowClosed } from "@/lib/gatherings";
import { useRiteOpen } from "@/lib/useRiteOpen";
import type { Gathering, Role } from "@/lib/types";

const NAV: { href: string; label: string; icon: string; min: Role }[] = [
  { href: "/convene", label: "Convene", icon: "ti-moon", min: "initiate" },
  { href: "/rite", label: "The rite", icon: "ti-glass-full", min: "initiate" },
  { href: "/reveal", label: "Reveal", icon: "ti-eye", min: "initiate" },
  { href: "/oracle", label: "Oracle", icon: "ti-crystal-ball", min: "member" },
  { href: "/tribunal", label: "Tribunal", icon: "ti-gavel", min: "member" },
  // Initiates read the codex (Keiser's ruling, 2026-07-12) — totals only;
  // the per-member breakdowns stay behind full membership.
  { href: "/codex", label: "Codex", icon: "ti-chart-radar", min: "initiate" },
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
  const { mode, loading, signedIn, hasAccess, memberError, role, member, email, avatar, sleeping, signOut } = useAuth();

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

  // SLEEP STAYS THE HAND AT THE GLASS. Disabling the save buttons was not
  // enough: a sleeping member could still type into every field, which reads
  // as though the Council were taking it down. Every data-entry control under
  // the main content is disabled outright, including on surfaces built later,
  // because the sweep runs on the DOM rather than on a list of components.
  // Buttons are NOT swept: the writing ones are sealed individually, and
  // sweeping them would take away the reading rights sleep must never touch
  // (tooltips, folds, the Heavens, the photo lightbox).
  // Opt out with data-sleep-ok: the plea to wake, and photographs of past
  // nights, are open to a sleeping hand by decree.
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = mainRef.current;
    if (!sleeping || !root) return;
    const stay = () => {
      root.querySelectorAll("input, textarea, select").forEach((el) => {
        const field = el as HTMLInputElement;
        if (field.closest("[data-sleep-ok]")) return;
        if (!field.disabled) field.disabled = true;
      });
    };
    stay();
    // Two ways a live field can appear after the sweep: a repaint mounts one
    // (a fold opening, a card rising), or React re-renders a field that owns
    // its own `disabled` prop and hands it back enabled. Watch for both. The
    // `if (!field.disabled)` guard above keeps this from chasing its own tail.
    const watch = new MutationObserver(stay);
    watch.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    return () => watch.disconnect();
  }, [sleeping, pathname]);

  // The chambers menu: the tabs folded behind a hamburger. Any navigation
  // (or a tap on the hamburger again) lifts the curtain.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Pending petitions → a badge on the Tribunal tab so the Keiser sees new
  // initiates on login. Refreshes as they move around and on submit/decree.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (role !== "keiser" && role !== "member") { setPending(0); return; }
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
          {/* A register that would not answer must never be read aloud as a
              refusal: telling a full member their petition is pending, because
              one request failed on a phone, is the worst possible lie. */}
          <p className="whisper" style={{ fontSize: 16, maxWidth: 400, margin: "14px auto 0" }}>
            {memberError
              ? "The register could not be read just now. This is the connection, not your standing. Draw the page again in a moment."
              : "You are known to the gate, but not yet of the Council. Your petition awaits the Keiser\u2019s decree."}
          </p>
          {memberError && (
            <button className="btn gold" style={{ width: "auto", padding: "12px 24px", marginTop: 20 }} onClick={() => window.location.reload()}>
              Try the gate again
            </button>
          )}
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

        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="The chambers"
          aria-expanded={menuOpen}
          style={{ marginLeft: "auto", position: "relative", width: "auto", background: "none", border: "none", color: "var(--gold2)", cursor: "pointer", padding: 6, display: "inline-flex", flex: "none" }}
        >
          <i className={`ti ${menuOpen ? "ti-x" : "ti-menu-2"}`} style={{ fontSize: 22 }} aria-hidden="true" />
          {pending > 0 && !menuOpen && (
            <span aria-label={`${pending} petition${pending === 1 ? "" : "s"} awaiting`} style={{ position: "absolute", top: 4, right: 3, width: 8, height: 8, borderRadius: 4, background: "var(--wine)" }} />
          )}
        </button>

        <Link
          href="/profile"
          aria-label="Your profile"
          title="Your profile"
          style={{ display: "flex", alignItems: "center", textDecoration: "none", flex: "none" }}
        >
          <Avatar src={avatar} initials={initials} size={34} />
        </Link>
        </div>
      </header>

      <nav
        aria-label="The chambers"
        style={{
          overflow: "hidden",
          maxHeight: menuOpen ? 340 : 0,
          transition: "max-height 0.32s ease",
          borderBottom: menuOpen ? "1px solid var(--line)" : "none",
          background: "#080706",
        }}
      >
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {(() => { const items = NAV.filter((n) => ROLE_RANK[role] >= ROLE_RANK[n.min])
          .filter((n) => (n.href !== "/rite" && n.href !== "/reveal") || riteOpen)
          // A week after the night ends the reveal is gone entirely (#7).
          .filter((n) => n.href !== "/reveal" || !revealWindowClosed(gathering));
        return items.map((n, i) => {
          const on = pathname.startsWith(n.href);
          const last = i === items.length - 1;
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                color: on ? "var(--gold2)" : "var(--dim)",
                background: on ? "rgba(160,150,120,0.08)" : "none",
                fontFamily: "'Cinzel', serif",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "13px 20px",
                borderBottom: last ? "none" : "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
              }}
            >
              <i className={`ti ${n.icon}`} style={{ fontSize: 17, width: 20, textAlign: "center" }} aria-hidden="true" />
              {n.label}
              {n.href === "/tribunal" && pending > 0 && (
                <span
                  aria-label={`${pending} petition${pending === 1 ? "" : "s"} awaiting`}
                  style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--wine)", color: "#fff", fontFamily: "'EB Garamond', serif", fontSize: 11, letterSpacing: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" }}
                >
                  {pending}
                </span>
              )}
            </Link>
          );
        }); })()}
        </div>
      </nav>

      <main>
        <div ref={mainRef} style={{ maxWidth: 820, margin: "0 auto", padding: 22, minHeight: 440 }}>
        {sleeping && (
          <div style={{ border: "1px solid rgba(140,138,130,0.45)", background: "linear-gradient(180deg, rgba(60,58,54,0.28), rgba(20,19,18,0.5))", borderRadius: 10, padding: "12px 14px", marginBottom: 18, textAlign: "center" }}>
            <div className="eyebrow" style={{ fontSize: 10, color: "#8d8b85", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <i className="ti ti-zzz" style={{ fontSize: 13 }} />Your seat sleeps
            </div>
            <p className="whisper" style={{ margin: "5px 0 0", fontSize: 13.5 }}>
              The Council remembers you. Every chamber your rank opens stays open to your eyes, but a sleeping hand writes nothing. Your record stands exactly as you left it, and the Keiser may wake you at a word.
            </p>
          </div>
        )}
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
