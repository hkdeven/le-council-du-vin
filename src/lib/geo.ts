// Geocode a birth place by name via Open-Meteo's free geocoding API (no key).
// The member types a town; we store its coordinates + IANA timezone so the
// natal engine can compute an exact chart. Fails soft: an empty list.

export interface GeoHit {
  label: string; // "Vryburg, North West, South Africa"
  latitude: number;
  longitude: number;
  timezone: string; // IANA, e.g. "Africa/Johannesburg"
}

export async function geocodePlace(query: string): Promise<GeoHit[]> {
  // The API matches on the town NAME only — "Tawas City, Michigan" finds
  // nothing as one string. Search the part before the comma, then rank the
  // hits by how well the rest (state/region/country) matches.
  const parts = query.split(",").map((p) => p.trim()).filter(Boolean);
  const q = parts[0];
  const regionTokens = parts.slice(1).map((p) => p.toLowerCase());
  if (!q) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: { name: string; admin1?: string; admin2?: string; country?: string; latitude: number; longitude: number; timezone?: string }[];
    };
    const hits = (json.results || [])
      .filter((r) => r.timezone)
      .map((r) => ({
        label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone as string,
        _region: [r.admin1, r.admin2, r.country].filter(Boolean).join(" ").toLowerCase(),
      }));
    if (!regionTokens.length) return hits.map(({ _region, ...h }) => h);
    const matched = hits.filter((h) => regionTokens.every((t) => h._region.includes(t)));
    const some = matched.length ? matched : hits.filter((h) => regionTokens.some((t) => h._region.includes(t)));
    return (some.length ? some : hits).map(({ _region, ...h }) => h);
  } catch {
    return [];
  }
}
