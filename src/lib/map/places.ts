import type { ISO3 } from "./data";
import type { CityRow } from "./cities";
import { searchCountries } from "./meta";
import { rankByName } from "./search";

export type Place =
  | { kind: "country"; iso: ISO3; name: string }
  | { kind: "city"; iso: ISO3; name: string; lat: number; lon: number };

/**
 * Countries first, then cities (biggest first). Countries get at least half the slots, and any slots
 * cities don't fill. `cities` is null while the list loads.
 */
export function searchPlaces(query: string, cities: CityRow[] | null, limit = 8): Place[] {
  if (!query.trim()) return [];
  const cityRows = cities ? rankByName(cities, (r) => r[0], query, limit) : [];
  const countryRows = searchCountries(query, Math.max(Math.ceil(limit / 2), limit - cityRows.length));
  return [
    ...countryRows.map((c): Place => ({ kind: "country", iso: c.iso, name: c.name })),
    ...cityRows.slice(0, limit - countryRows.length).map(([name, iso, lat, lon]): Place => ({ kind: "city", iso, name, lat, lon })),
  ];
}
