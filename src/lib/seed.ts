import type {
  Member,
  Theme,
  Gathering,
  Wine,
  Application,
} from "./types";

// Seed content mirrors the approved mockup so the app is fully viewable in demo
// mode (before Supabase is wired). Once live, the data layer reads real rows.

export const seedMembers: Member[] = [
  { id: "m-mara", email: "mara@nightvine.com", cult_name: "Sister Mara", short_name: "MR", role: "member", zodiac: "Pisces", element: "Water", last_hosted: "2026-03-28", active: true },
  { id: "m-silas", email: "silas@nightvine.com", cult_name: "Brother Silas", short_name: "SV", role: "member", zodiac: "Capricorn", element: "Earth", last_hosted: "2026-07-25", active: true },
  { id: "m-thorne", email: "thorne@nightvine.com", cult_name: "Elder Thorne", short_name: "EL", role: "member", zodiac: "Leo", element: "Fire", last_hosted: "2026-03-01", active: true },
  { id: "m-keiser", email: "hkdeven@gmail.com", cult_name: "The Keiser", short_name: "KE", role: "keiser", zodiac: "Scorpio", element: "Fire", last_hosted: "2026-05-30", active: true },
];

export const seedThemes: Theme[] = [
  { id: "t-1", title: "Volcanic soils only", description: "Etna, Santorini, the Canaries — wines born of fire and ash.", status: "pool", favours: 7, created_at: "2026-06-01" },
  { id: "t-2", title: "Older than the youngest member", description: "Nothing younger than our newest soul. Bring provenance.", status: "pool", favours: 5, created_at: "2026-06-04" },
  { id: "t-3", title: "Bottles under a €15 tithe", description: "The cheap and the cheerful. Humility before the vine.", status: "pool", favours: 4, created_at: "2026-06-10" },
  { id: "t-4", title: "Orange wines of the old world", description: "Skin-contact, amber, and untamed. Bring what unsettles.", status: "scheduled", favours: 6, created_at: "2026-05-20" },
];

export const seedGathering: Gathering = {
  id: "g-47",
  number: 47,
  moon_label: "The waning moon",
  theme_title: "Orange wines of the old world",
  theme_description: "Skin-contact, amber, and untamed. Bring what unsettles.",
  host_id: "m-silas",
  host_name: "Brother Silas",
  gather_date: "2026-07-25",
  status: "scoring",
  wine_count: 11,
};

export const seedWines: Wine[] = [
  { id: "w-7", gathering_id: "g-47", cloth_number: 7, producer: "Radikon Jakot", vintage: "2019", region: "Friuli", brought_by_name: "Sister Mara", revealed: true, avg_score: 9.1, rank: 1 },
  { id: "w-3", gathering_id: "g-47", cloth_number: 3, producer: "Movia Rebula", vintage: "2018", region: "Brda", brought_by_name: "Brother Silas", revealed: true, avg_score: 8.8, rank: 2 },
  { id: "w-9", gathering_id: "g-47", cloth_number: 9, producer: "Gravner Ribolla", vintage: "2015", region: "Friuli", brought_by_name: "Cassian Vale", revealed: true, avg_score: 8.4, rank: 3 },
  { id: "w-1", gathering_id: "g-47", cloth_number: 1, producer: "COS Pithos", vintage: "2020", region: "Sicily", brought_by_name: "Elder Thorne", revealed: true, avg_score: 7.8, rank: 4 },
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
  { name: "Sister Mara", wins: 9 },
  { name: "Brother Silas", wins: 7 },
  { name: "Elder Thorne", wins: 5 },
  { name: "The Keiser", wins: 3 },
  { name: "Cassian Vale", wins: 2 },
];

export const aromaLexicon = [
  "apricot", "incense", "honey", "petrol", "dried flower", "walnut",
  "orange peel", "beeswax", "black tea", "smoke", "quince", "salt",
];
