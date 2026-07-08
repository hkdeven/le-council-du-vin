import type { Member, Theme, Application, Poll, Gathering } from "./types";

// Real club data only. Members are the actual council; everything else starts
// empty and is created in the app (persisted per-browser in demo, Supabase when live).

export const seedMembers: Member[] = [
  { id: "m-larissa", email: "larissa@nightvine.com", cult_name: "Priestess Larissa", short_name: "LA", role: "member", last_hosted: "2026-01-31", active: true },
  { id: "m-dominik", email: "dominik@nightvine.com", cult_name: "Magus Dominik", short_name: "DK", role: "member", last_hosted: "2026-02-28", active: true },
  { id: "m-james", email: "james@nightvine.com", cult_name: "Warden James", short_name: "JM", role: "member", last_hosted: "2026-03-28", active: true },
  { id: "m-martin", email: "martin@nightvine.com", cult_name: "Elder Martin", short_name: "MN", role: "member", last_hosted: "2026-04-25", active: true },
  { id: "m-wernardt", email: "wernardt@nightvine.com", cult_name: "Adept Wernardt", short_name: "WT", role: "member", last_hosted: "2026-06-27", active: true },
  { id: "m-scott", email: "scott@nightvine.com", cult_name: "Scribe Scott", short_name: "SC", role: "member", last_hosted: "2026-07-04", active: true },
  { id: "m-matthew", email: "matthew@nightvine.com", cult_name: "Seer Matthew", short_name: "MW", role: "member", last_hosted: "2026-07-25", venue_instructions: "Estate gate on Rosmead — code 4471. Follow the lanterns to the cellar.", active: true },
  { id: "m-keiser", email: "hkdeven@gmail.com", cult_name: "The Keiser", short_name: "KE", role: "keiser", zodiac: "Scorpio", element: "Water", date_of_birth: "1988-11-05", time_of_birth: "03:30", birth_place: "Vryburg, North West, South Africa", birth_lat: -26.95659, birth_lon: 24.7284, birth_tz: "Africa/Johannesburg", last_hosted: "2026-05-30", venue_instructions: "Ring twice. Street parking after 18:00 is free.", active: true },
];

// The club's real theme pool.
export const seedThemes: Theme[] = [
  { id: "t-1", title: "Screw-top reds", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-2", title: "Durbanville whites", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-3", title: "Italian reds", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-4", title: "Whites · R150–200", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-5", title: "Favourite white", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-6", title: "Favourite red", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-7", title: "Must contain a set varietal — white", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-8", title: "Must contain a set varietal — red", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-9", title: "Black-owned wine farm", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-10", title: "Women winemakers", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-11", title: "Rhône blends", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-12", title: "Double bubbles", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-13", title: "Rosé", status: "pool", favours: 0, created_at: "2026-07-06" },
];

// Default copy stamped onto every new meeting (the Keiser can edit per meeting).
export const DEFAULT_RULES =
  "You must arrive by 19:00 for your wine to be included. Be sure to chill your wine when appropriate and remove cork foil/markings beforehand. Snacks and bread will be provided, but additional noshy bits and bubbles are always welcomed.";
export const DEFAULT_THREAT =
  "Please note — wines that do not follow theme will not be scored or ranked, future invites to wine night and bowls will not be extended, and your seat will be forfeit to another. If you are one of two, both seats may be forfeit at the discretion of the Keiser.";

export const seedGatherings: Gathering[] = [];
export const seedPolls: Poll[] = [];
export const seedApplications: Application[] = [];
