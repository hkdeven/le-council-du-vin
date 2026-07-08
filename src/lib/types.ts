export type Role = "initiate" | "member" | "keiser";

export interface Member {
  id: string;
  email: string;
  cult_name: string;
  short_name: string;
  role: Role;
  zodiac?: string | null;
  element?: string | null;
  date_of_birth?: string | null;
  time_of_birth?: string | null;
  // Birth place, geocoded once on save; the coordinates and IANA timezone
  // feed the exact natal calculations (ascendant needs all of them).
  birth_place?: string | null;
  birth_lat?: number | null;
  birth_lon?: number | null;
  birth_tz?: string | null;
  avatar_url?: string | null;
  last_hosted?: string | null;
  venue_instructions?: string | null;
  active: boolean;
}

export interface DateOption {
  id: string;
  date: string;
  voters: string[]; // member ids
}

export interface Poll {
  id: string;
  title: string;
  status: "open" | "archived";
  created_at: string;
  options: DateOption[];
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
  host2_id?: string | null; // optional co-host
  host2_name?: string | null;
  gather_date: string;
  gather_time?: string | null;
  status: "upcoming" | "scoring" | "revealed";
  wine_count: number;
  reveal_photos?: string[] | null;
  rules_text?: string | null;
  threat_text?: string | null;
  venue_instructions?: string | null;
  attendees?: string[]; // member ids who have RSVP'd
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
  date_of_birth?: string | null;
  time_of_birth?: string | null;
  draw_reason?: string | null;
  if_wine?: string | null;
  wine_sin?: string | null;
  oath: boolean;
  status: "pending" | "anointed" | "cast_out";
  created_at: string;
  anointed_at?: string | null; // set when the Keiser anoints the petitioner
  birth_place?: string | null;
  birth_lat?: number | null;
  birth_lon?: number | null;
  birth_tz?: string | null;
  tally?: { anoint: number; cast_out: number; abstain: number };
}
