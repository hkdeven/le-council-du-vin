export type Role = "initiate" | "member" | "keiser";

export interface Member {
  id: string;
  email: string;
  cult_name: string;
  short_name: string;
  role: Role;
  zodiac?: string | null;
  element?: string | null;
  avatar_url?: string | null;
  last_hosted?: string | null;
  venue_instructions?: string | null;
  active: boolean;
}

export interface DateOption {
  id: string;
  date: string;
  voters: string[];
}

export interface Theme {
  id: string;
  title: string;
  description?: string | null;
  proposed_by?: string | null;
  status: "pool" | "scheduled" | "used";
  favours: number;
  created_at: string;
}

export interface Gathering {
  id: string;
  number: number;
  moon_label: string;
  theme_title: string;
  theme_description?: string | null;
  host_id?: string | null;
  host_name?: string | null;
  gather_date: string;
  status: "upcoming" | "scoring" | "revealed";
  wine_count: number;
  reveal_photos?: string[] | null;
}

export interface Wine {
  id: string;
  gathering_id: string;
  cloth_number: number;
  producer?: string | null;
  vintage?: string | null;
  region?: string | null;
  brought_by_name?: string | null;
  revealed: boolean;
  avg_score?: number | null;
  rank?: number | null;
}

export interface Score {
  id: string;
  wine_id: string;
  member_id: string;
  score: number;
  aromas?: string[] | null;
  notes?: string | null;
}

export interface Application {
  id: string;
  cult_name: string;
  email: string;
  zodiac?: string | null;
  element?: string | null;
  draw_reason?: string | null;
  if_wine?: string | null;
  wine_sin?: string | null;
  oath: boolean;
  status: "pending" | "anointed" | "cast_out";
  created_at: string;
  tally?: { anoint: number; cast_out: number; abstain: number };
}
