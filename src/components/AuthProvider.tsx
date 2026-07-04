"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isLive } from "@/lib/supabase";
import type { Member, Role } from "@/lib/types";

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
  role: Role;
  member: Member | null;
  email: string | null;
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
  signOut: () => Promise<void>;
}

const noop = () => {};
const AuthContext = createContext<AuthValue>({
  mode: "demo",
  status: "member",
  loading: false,
  signedIn: true,
  hasAccess: true,
  role: "keiser",
  member: null,
  email: null,
  authError: null,
  setRole: noop,
  signInWithGoogle: noop,
  signInWithOtp: async () => ({}),
  signInWithPassword: async () => ({}),
  signUpWithPassword: async () => ({}),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [demoRole, setDemoRole] = useState<Role>("keiser");
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(isLive);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isLive) return;
    const saved = localStorage.getItem("lcv_role") as Role | null;
    if (saved) setDemoRole(saved);
  }, []);

  useEffect(() => {
    if (!isLive || !supabase) return;
    let active = true;
    const resolve = async (sess: Session | null) => {
      if (!active) return;
      setSession(sess);
      const email = sess?.user?.email;
      if (email) {
        const { data } = await supabase!
          .from("members")
          .select("*")
          .eq("email", email)
          .maybeSingle();
        if (active) setMember((data as Member) ?? null);
      } else if (active) {
        setMember(null);
      }
      if (active) setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      resolve(sess)
    );
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

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setMember(null);
  }, []);

  const signedIn = isLive ? !!session : true;
  const hasAccess = isLive ? !!member : true;
  const role: Role = isLive ? member?.role ?? "initiate" : demoRole;
  const status: Status = isLive
    ? loading
      ? "loading"
      : !session
      ? "anonymous"
      : member
      ? "member"
      : "no-membership"
    : "member";

  return (
    <AuthContext.Provider
      value={{
        mode: isLive ? "live" : "demo",
        status,
        loading,
        signedIn,
        hasAccess,
        role,
        member,
        email: session?.user?.email ?? null,
        authError,
        setRole,
        signInWithGoogle,
        signInWithOtp,
        signInWithPassword,
        signUpWithPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
