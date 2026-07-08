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
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }[];
    };
    return (json.results || [])
      .filter((r) => r.timezone)
      .map((r) => ({
        label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone as string,
      }));
  } catch {
    return [];
  }
}
