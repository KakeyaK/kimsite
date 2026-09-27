import type { City, ISO3 } from "./data";
import { fold } from "./search";

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

export function cityId(iso: ISO3, name: string, lat: number, lon: number): string {
  const slug = fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${iso}-${slug}-${lat.toFixed(1)}-${lon.toFixed(1)}`;
}

export const customCityId = (now = Date.now()): string =>
  `custom-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Adding a city that's already on the list keeps the existing entry, so its year/status/note survive. */
export function addCity(cities: City[], city: City): City[] {
  return cities.some((c) => c.id === city.id) ? cities : [...cities, city];
}
