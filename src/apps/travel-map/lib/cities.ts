import type { ISO3 } from "./data";

/** A city you can add to a trip, from the bundled list. */
export type CityRow = [name: string, iso3: ISO3, lat: number, lon: number, pop: number];

let cache: Promise<CityRow[]> | null = null;

export function loadCities(): Promise<CityRow[]> {
  cache ??= fetch("/map/cities.json")
    .then((r) => {
      if (!r.ok) throw new Error(`cities.json: HTTP ${r.status}`);
      return r.json() as Promise<CityRow[]>;
    })
    .catch((e) => {
      cache = null; // allow a retry
      throw e;
    });
  return cache;
}
