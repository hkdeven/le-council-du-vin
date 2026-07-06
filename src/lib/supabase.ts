import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// The app runs in demo mode (seeded data, no writes) until these are set, so we
// don't throw on missing env — we expose a null client and let the data layer
// fall back. Once Supabase is provisioned, filling .env.local lights it up.
export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const isLive = Boolean(supabase);

// The login wall is a separate switch from "is Supabase connected". With Supabase
// wired but this off, the app stays open (navigable, role switcher) while still
// able to read/write data. Set NEXT_PUBLIC_ENFORCE_LOGIN=true to turn the wall on.
export const enforceLogin = process.env.NEXT_PUBLIC_ENFORCE_LOGIN === "true";
