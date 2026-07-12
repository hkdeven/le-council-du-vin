// Geocode a birth place by name via Open-Meteo's free geocoding API (no key).
// The member types a town; we store its coordinates + IANA timezone so the
// natal engine can compute an exact chart.
//
// The lookup goes through our own /api/geocode proxy first: browser content
// blockers and strict networks silently kill cross-origin calls to the
// geocoding host, which used to read as "the atlas does not know it" when the
// search never left the browser at all. The direct call remains as fallback.
// Failures are REPORTED, never swallowed: the result carries an error message
// the pages must show, so a dead lookup is never mistaken for a missing town.

export interface GeoHit {
  label: string; // "Vryburg, North West, South Africa"
  latitude: number;
  longitude: number;
  timezone: string; // IANA, e.g. "Africa/Johannesburg"
}

export interface GeoLookup {
  hits: GeoHit[];
  error: string | null; // set when the search itself failed (network, API down)
}

interface RawHit {
  name: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

const DIRECT_URL = (q: string) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`;

async function searchByName(q: string): Promise<RawHit[]> {
  // Same-origin proxy first (nothing blocks it), then the API directly.
  const urls = typeof window === "undefined"
    ? [DIRECT_URL(q)]
    : [`/api/geocode?q=${encodeURIComponent(q)}`, DIRECT_URL(q)];
  let lastError = "";
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const json = (await res.json().catch(() => null)) as
        | { results?: RawHit[]; error?: boolean; reason?: string }
        | null;
      if (!res.ok || !json || json.error) {
        lastError = json?.reason || `the atlas answered ${res.status}`;
        continue;
      }
      return json.results || [];
    } catch {
      lastError = "the atlas could not be reached";
    }
  }
  throw new Error(lastError || "the atlas could not be reached");
}

export async function geocodePlace(query: string): Promise<GeoLookup> {
  // The API matches on the town NAME only — "Tawas City, Michigan" finds
  // nothing as one string. Search the part before the comma, then rank the
  // hits by how well the rest (state/region/country) matches.
  const parts = query.split(",").map((p) => p.trim()).filter(Boolean);
  const q = parts[0];
  const regionTokens = parts.slice(1).map((p) => p.toLowerCase());
  if (!q) return { hits: [], error: null };
  // The API needs two characters or more; below that it errors obscurely.
  if (q.length < 2) return { hits: [], error: "Give the atlas at least two letters of the town." };
  let raw: RawHit[];
  try {
    raw = await searchByName(q);
  } catch (e) {
    return { hits: [], error: (e as Error).message };
  }
  const hits = raw
    .filter((r) => r.timezone)
    .map((r) => ({
      label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone as string,
      _region: [r.admin1, r.admin2, r.country].filter(Boolean).join(" ").toLowerCase(),
    }));
  const strip = ({ _region, ...h }: (typeof hits)[number]): GeoHit => h;
  if (!regionTokens.length) return { hits: hits.map(strip), error: null };
  const matched = hits.filter((h) => regionTokens.every((t) => h._region.includes(t)));
  const some = matched.length ? matched : hits.filter((h) => regionTokens.some((t) => h._region.includes(t)));
  return { hits: (some.length ? some : hits).map(strip), error: null };
}
