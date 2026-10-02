import { setCity, setRegion, type ISO3, type TravelData } from "./data";
import { cityId, type CityRow } from "./cities";
import { searchCountries, searchRegions } from "./meta";
import { rankByName } from "./search";
import type { Stop } from "./stops";

export type Place =
  | { kind: "country"; iso: ISO3; name: string }
  | { kind: "region"; code: string; iso: ISO3; name: string }
  | { kind: "city"; iso: ISO3; name: string; lat: number; lon: number; region?: string };

/**
 * Countries, then states, then cities (biggest first). Countries and states get at least half the
 * slots, plus any slots cities don't fill. `cities` is null while the list loads.
 */
export function searchPlaces(query: string, cities: CityRow[] | null, limit = 8): Place[] {
  if (!query.trim()) return [];
  const cityRows = cities ? rankByName(cities, (r) => r[0], query, limit) : [];
  const areaSlots = Math.max(Math.ceil(limit / 2), limit - cityRows.length);
  const areas: Place[] = [
    ...searchCountries(query, areaSlots).map((c): Place => ({ kind: "country", iso: c.iso, name: c.name })),
    ...searchRegions(query, areaSlots).map((r): Place => ({ kind: "region", code: r.code, iso: r.country, name: r.name })),
  ].slice(0, areaSlots);
  return [
    ...areas,
    ...cityRows
      .slice(0, limit - areas.length)
      .map(([name, iso, lat, lon, , region]): Place => ({ kind: "city", iso, name, lat, lon, ...(region && { region }) })),
  ];
}

export function placeToStop(p: Place): Stop {
  if (p.kind === "country") return p.iso;
  if (p.kind === "region") return p.code;
  return { n: p.name, c: p.iso, la: p.lat, lo: p.lon };
}

/**
 * Picking a search result puts it on your map as "been". A country or state that's already marked is
 * left as is, so a "lived" or "want" isn't overwritten; a state raises its country (`setRegion`).
 * A city already on the list is kept as is; a new one raises its state and country (`setCity`).
 */
export function markPicked(data: TravelData, place: Place): TravelData {
  if (place.kind === "region") return data.regions[place.code] ? data : setRegion(data, place.code, { status: "visited" });
  if (place.kind === "country") {
    return data.countries[place.iso] ? data : { ...data, countries: { ...data.countries, [place.iso]: { status: "visited" } } };
  }
  const { name, iso, lat, lon, region } = place;
  const id = cityId(iso, name, lat, lon);
  if (data.cities.some((c) => c.id === id)) return data;
  return setCity(data, { id, name, country: iso, lat, lon, status: "visited", ...(region && { region }) });
}
