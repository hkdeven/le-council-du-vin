"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "@/lib/types";
import { isLive } from "@/lib/supabase";

interface SessionValue {
  role: Role;
  setRole: (r: Role) => void;
  cultName: string;
  demo: boolean;
}

const SessionContext = createContext<SessionValue>({
  role: "keiser",
  setRole: () => {},
  cultName: "The Keiser",
  demo: true,
});

const NAMES: Record<Role, string> = {
  initiate: "Cassian Vale",
  member: "Sister Mara",
  keiser: "The Keiser",
};

// In demo mode the role is chosen by the header switcher so every tier can be
// walked through. Once Supabase auth is wired, role comes from the member row.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("keiser");

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem("lcv_role") as Role | null)
        : null;
    if (saved) setRoleState(saved);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    if (typeof window !== "undefined") localStorage.setItem("lcv_role", r);
  };

  return (
    <SessionContext.Provider
      value={{ role, setRole, cultName: NAMES[role], demo: !isLive }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);

export const ROLE_RANK: Record<Role, number> = {
  initiate: 0,
  member: 1,
  keiser: 2,
};
