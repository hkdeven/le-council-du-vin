"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isLive, enforceLogin } from "@/lib/supabase";
import type { Member, Role } from "@/lib/types";
import { setWriteLock } from "@/lib/writeLock";
import { canonicalEmail, pickMemberRow } from "@/lib/memberLookup";

// The login wall is only active when Supabase is connected AND enforcement is on.
// Otherwise the app runs open (demo behaviour) so it stays navigable.
const gated = isLive && enforceLogin;

export const ROLE_RANK: Record<Role, number> = {
  initiate: 0,
  member: 1,
  keiser: 2,
};

type Mode = "demo" | "live";
type Status = "loading" | "anonymous" | "member" | "no-membership";

interface AuthValue {
  mode: Mode;
  status: Status;
  loading: boolean;
  signedIn: boolean;
  hasAccess: boolean;
  memberError: string | null;
  role: Role;
  member: Member | null;
  // A sleeping (deactivated) member keeps their rank's reading rights but may
  // write nothing; the write lock in src/lib/writeLock.ts is armed with this.
  sleeping: boolean;
  email: string | null;
  avatar: string | null;
  authError: string | null;
  // Demo-mode role switcher (no real auth when Supabase env is absent).
  setRole: (r: Role) => void;
  signInWithGoogle: () => void;
  signInWithOtp: (email: string) => Promise<{ error?: string; sent?: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error?: string; needsConfirm?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string; sent?: boolean }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const noop = () => {};
const AuthContext = createContext<AuthValue>({
  mode: "demo",
  status: "member",
  loading: false,
  signedIn: true,
  hasAccess: true,
  memberError: null,
  role: "keiser",
  member: null,
  sleeping: false,
  email: null,
  avatar: null,
  authError: null,
  setRole: noop,
  signInWithGoogle: noop,
  signInWithOtp: async () => ({}),
  signInWithPassword: async () => ({}),
  signUpWithPassword: async () => ({}),
  resetPassword: async () => ({}),
  updatePassword: async () => ({}),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [demoRole, setDemoRole] = useState<Role>("keiser");
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  // Has the register been consulted for real, or are we still holding the
  // cached row? The cache paints instantly (and must), but a member sleeping
  // since it was written would look awake for the length of the refetch, and
  // the write lock is armed off exactly this. So: the BANNER rides the
  // confirmed row (no flash for the awake), the LOCK closes pessimistically
  // until the register answers.
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(gated);
  const [authError, setAuthError] = useState<string | null>(null);
  // The register itself would not answer (network, a refused read). Distinct
  // from "this soul is not a member", which is a successful read of nothing.
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    if (gated) return;
    const saved = localStorage.getItem("lcv_role") as Role | null;
    if (saved) setDemoRole(saved);
  }, []);

  useEffect(() => {
    if (!gated || !supabase) return;
    let active = true;
    // Last known member row, so a refresh paints instantly instead of holding
    // the whole app on "Consulting the register" while the row refetches.
    // The fresh row still loads in the background and corrects any staleness.
    const CACHE_KEY = "lcv_member_cache";
    const readCache = (email: string): Member | null => {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { email?: string; member?: Member | null };
        return parsed.email === email ? parsed.member ?? null : null;
      } catch {
        return null;
      }
    };
    const resolve = async (sess: Session | null) => {
      if (!active) return;
      setSession(sess);
      // Canonical form, always. Access hangs on this matching the members row
      // exactly (the RLS policy compares exactly too), so a capital letter or
      // a stray space would lock a member out of the Council entirely.
      const email = canonicalEmail(sess?.user?.email);
      if (email) {
        const cached = readCache(email);
        if (cached) {
          setMember(cached);
          setLoading(false);
        }
        // Case-blind at BOTH ends. Every policy in policies.sql compares with
        // lower(), but this lookup was still an exact .eq(), so access hung on
        // every stored address happening to be canonical: one capital letter in
        // a row and RLS would hand the member their row while this query failed
        // to ask for it. That is precisely what shut James out for six weeks.
        // ilike matches without regard to case; it also treats _ and % as
        // wildcards, so the canonical comparison below is what actually decides
        // the match and a near-miss row can never be mistaken for this member.
        const { data: rows, error } = await supabase!
          .from("members")
          .select("*")
          .ilike("email", email);
        const data = pickMemberRow(rows as Member[] | null, email);
        if (active) {
          if (error) {
            // A register that could not be read is NOT a soul who is not in it.
            // The error was unread here, so one dropped request on a phone set
            // member to null: hasAccess went false and a full member was shown
            // the pending screen mid-gathering, with null written to the cache
            // so a refresh painted them out again. Hold what we have instead
            // and let the next resolve correct it.
            setMemberError(error.message);
          } else {
            setMemberError(null);
            setMember((data as Member) ?? null);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ email, member: data ?? null })); } catch {}
          }
        }
      } else if (active) {
        setMember(null);
        try { localStorage.removeItem(CACHE_KEY); } catch {}
      }
      if (active) { setResolved(true); setLoading(false); }
    };
    // The gate ledger (ticket #12): a real sign-in is reported once, so the
    // Keiser can see who entered, when, and from what vessel. Throttled per
    // browser so token refreshes and tab-switches don't flood the ledger;
    // the server captures the IP and verifies the token.
    const recordLogin = (token: string) => {
      try {
        const last = Number(localStorage.getItem("lcv_login_logged") || 0);
        if (Date.now() - last < 30 * 60 * 1000) return;
        localStorage.setItem("lcv_login_logged", String(Date.now()));
      } catch {}
      fetch("/api/log-login", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    };
    supabase.auth.getSession().then(({ data }) => {
      resolve(data.session);
      if (data.session?.access_token) recordLogin(data.session.access_token);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      resolve(sess);
      if (event === "SIGNED_IN" && sess?.access_token) recordLogin(sess.access_token);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setRole = useCallback((r: Role) => {
    setDemoRole(r);
    localStorage.setItem("lcv_role", r);
  }, []);

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

  const signInWithGoogle = useCallback(() => {
    setAuthError(null);
    supabase?.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }, [redirectTo]);

  const signInWithOtp = useCallback(
    async (email: string) => {
      setAuthError(null);
      const { error } = await supabase!.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      return error ? { error: error.message } : { sent: true };
    },
    [redirectTo]
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }, []);

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) return { error: error.message };
      return { needsConfirm: !data.session };
    },
    [redirectTo]
  );

  // Forgot password: the emailed link lands on /reset, where updatePassword
  // seals the new secret word. Supabase only mails addresses it knows.
  const resetPassword = useCallback(async (email: string) => {
    setAuthError(null);
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/reset`,
    });
    return error ? { error: error.message } : { sent: true };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setAuthError(null);
    const { error } = await supabase!.auth.updateUser({ password });
    return { error: error?.message };
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setMember(null);
    try { localStorage.removeItem("lcv_member_cache"); } catch {}
  }, []);

  const roleForAvatar: Role = gated ? member?.role ?? "initiate" : demoRole;
  const [avatar, setAvatarState] = useState<string | null>(null);
  useEffect(() => {
    // A profile save dispatches `lcv-profile` with the new avatar in `detail`,
    // so the header updates instantly in live mode (where the member row is
    // otherwise cached until reload).
    const load = (e?: Event) => {
      const detail = e && (e as CustomEvent).detail;
      if (detail && typeof detail === "object" && "avatar" in detail) {
        setAvatarState((detail as { avatar: string | null }).avatar ?? null);
        return;
      }
      if (gated) { setAvatarState(member?.avatar_url ?? null); return; }
      try {
        const raw = localStorage.getItem(`lcv_profile_${roleForAvatar}`);
        setAvatarState(raw ? JSON.parse(raw).avatar ?? null : null);
      } catch { setAvatarState(null); }
    };
    load();
    window.addEventListener("lcv-profile", load);
    return () => window.removeEventListener("lcv-profile", load);
  }, [roleForAvatar, member]);

  const signedIn = gated ? !!session : true;
  const hasAccess = gated ? !!member : true;
  const role: Role = gated ? member?.role ?? "initiate" : demoRole;
  const status: Status = gated
    ? loading
      ? "loading"
      : !session
      ? "anonymous"
      : member
      ? "member"
      : "no-membership"
    : "member";

  const sleeping = gated && member?.active === false;
  // `gated &&` is load-bearing on both: the resolve effect returns early in
  // demo mode, so `resolved` never flips there and demo would seal forever.
  const sealed = gated && (!resolved || sleeping);
  useEffect(() => { setWriteLock(sealed); }, [sealed]);

  return (
    <AuthContext.Provider
      value={{
        mode: gated ? "live" : "demo",
        status,
        loading,
        signedIn,
        hasAccess,
        memberError,
        role,
        member,
        sleeping,
        email: session?.user?.email ?? null,
        avatar,
        authError,
        setRole,
        signInWithGoogle,
        signInWithOtp,
        signInWithPassword,
        signUpWithPassword,
        resetPassword,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
