import type {
  Member,
  Theme,
  Gathering,
  Wine,
  Application,
  DateOption,
} from "./types";

// Seed content mirrors the approved mockup so the app is fully viewable in demo
// mode (before Supabase is wired). Once live, the data layer reads real rows.

export const seedMembers: Member[] = [
  { id: "m-larissa", email: "larissa@nightvine.com", cult_name: "Sister Larissa", short_name: "LA", role: "member", last_hosted: "2026-01-31", active: true },
  { id: "m-dominik", email: "dominik@nightvine.com", cult_name: "Brother Dominik", short_name: "DK", role: "member", last_hosted: "2026-02-28", active: true },
  { id: "m-james", email: "james@nightvine.com", cult_name: "Brother James", short_name: "JM", role: "member", last_hosted: "2026-03-28", active: true },
  { id: "m-martin", email: "martin@nightvine.com", cult_name: "Brother Martin", short_name: "MN", role: "member", last_hosted: "2026-04-25", active: true },
  { id: "m-wernardt", email: "wernardt@nightvine.com", cult_name: "Brother Wernardt", short_name: "WT", role: "member", last_hosted: "2026-06-27", active: true },
  { id: "m-scott", email: "scott@nightvine.com", cult_name: "Brother Scott", short_name: "SC", role: "member", last_hosted: "2026-07-04", active: true },
  { id: "m-matthew", email: "matthew@nightvine.com", cult_name: "Brother Matthew", short_name: "MW", role: "member", last_hosted: "2026-07-25", venue_instructions: "Estate gate on Rosmead — code 4471. Follow the lanterns to the cellar.", active: true },
  { id: "m-keiser", email: "hkdeven@gmail.com", cult_name: "The Keiser", short_name: "KE", role: "keiser", zodiac: "Scorpio", element: "Water", date_of_birth: "1988-11-05", time_of_birth: "03:30", last_hosted: "2026-05-30", venue_instructions: "Ring twice. Street parking after 18:00 is free.", active: true },
];

// Candidate dates for the next gathering — members vote for every date they can
// make; the winner is the date the most souls can attend (replaces the WhatsApp poll).
export const seedDateOptions: DateOption[] = [
  { id: "d-1", date: "2026-08-21", voters: ["m-larissa", "m-dominik", "m-james", "m-scott"] },
  { id: "d-2", date: "2026-08-22", voters: ["m-larissa", "m-dominik", "m-james", "m-martin", "m-keiser", "m-matthew"] },
  { id: "d-3", date: "2026-08-28", voters: ["m-dominik", "m-keiser", "m-wernardt"] },
  { id: "d-4", date: "2026-08-29", voters: ["m-larissa", "m-keiser", "m-scott"] },
];

export const seedThemes: Theme[] = [
  { id: "t-1", title: "Volcanic soils only", description: "Etna, Santorini, the Canaries — wines born of fire and ash.", status: "pool", favours: 7, created_at: "2026-06-01" },
  { id: "t-2", title: "Older than the youngest member", description: "Nothing younger than our newest soul. Bring provenance.", status: "pool", favours: 5, created_at: "2026-06-04" },
  { id: "t-3", title: "Bottles under a €15 tithe", description: "The cheap and the cheerful. Humility before the vine.", status: "pool", favours: 4, created_at: "2026-06-10" },
  { id: "t-4", title: "Orange wines of the old world", description: "Skin-contact, amber, and untamed. Bring what unsettles.", status: "scheduled", favours: 6, created_at: "2026-05-20" },
  { id: "t-5", title: "Screw-top reds", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-6", title: "Durbanville whites", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-7", title: "Italian reds", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-8", title: "Whites · R150–200", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-9", title: "Favourite white", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-10", title: "Favourite red", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-11", title: "Must contain a set varietal — white", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-12", title: "Must contain a set varietal — red", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-13", title: "Black-owned wine farm", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-14", title: "Women winemakers", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-15", title: "Rhône blends", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-16", title: "Double bubbles", status: "pool", favours: 0, created_at: "2026-07-06" },
  { id: "t-17", title: "Rosé", status: "pool", favours: 0, created_at: "2026-07-06" },
];

export const seedGathering: Gathering = {
  id: "g-47",
  number: 47,
  moon_label: "The waning moon",
  theme_title: "Orange wines of the old world",
  theme_description: "Skin-contact, amber, and untamed. Bring what unsettles.",
  host_id: "m-matthew",
  host_name: "Brother Matthew",
  gather_date: "2026-07-25",
  status: "scoring",
  wine_count: 11,
  reveal_photos: ["/reveals/g-47.webp"],
};

export const seedWines: Wine[] = [
  { id: "w-7", gathering_id: "g-47", cloth_number: 7, producer: "Radikon Jakot", vintage: "2019", region: "Friuli", brought_by_name: "Sister Larissa", revealed: true, avg_score: 9.1, rank: 1 },
  { id: "w-3", gathering_id: "g-47", cloth_number: 3, producer: "Movia Rebula", vintage: "2018", region: "Brda", brought_by_name: "Brother Dominik", revealed: true, avg_score: 8.8, rank: 2 },
  { id: "w-9", gathering_id: "g-47", cloth_number: 9, producer: "Gravner Ribolla", vintage: "2015", region: "Friuli", brought_by_name: "Brother James", revealed: true, avg_score: 8.4, rank: 3 },
  { id: "w-1", gathering_id: "g-47", cloth_number: 1, producer: "COS Pithos", vintage: "2020", region: "Sicily", brought_by_name: "Brother Wernardt", revealed: true, avg_score: 7.8, rank: 4 },
  { id: "w-4", gathering_id: "g-47", cloth_number: 4, producer: null, vintage: null, region: null, brought_by_name: null, revealed: false, avg_score: null, rank: null },
  { id: "w-2", gathering_id: "g-47", cloth_number: 2, producer: "the shamed vintage", vintage: null, region: null, brought_by_name: "unnamed, mercifully", revealed: true, avg_score: 4.6, rank: 11 },
];

export const seedApplications: Application[] = [
  {
    id: "a-cassian",
    cult_name: "Cassian Vale",
    email: "cassian@nightvine.com",
    zodiac: "Scorpio",
    element: "Fire",
    draw_reason: "I have tasted much and confessed little. I seek a table that keeps its secrets.",
    if_wine: "A brooding Barolo, unready and unrepentant.",
    wine_sin: "I once chilled a Burgundy.",
    oath: true,
    status: "pending",
    created_at: "2026-06-30",
    tally: { anoint: 6, cast_out: 3, abstain: 2 },
  },
];

export const seedVictories = [
  { name: "Sister Larissa", wins: 9 },
  { name: "Brother Scott", wins: 7 },
  { name: "Brother Matthew", wins: 5 },
  { name: "The Keiser", wins: 3 },
  { name: "Brother Martin", wins: 2 },
];

export const aromaLexicon = [
  "apricot", "honey", "petrol", "orange peel", "beeswax", "black tea", "smoke", "salt",
];
