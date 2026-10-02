import { z } from "astro/zod";
import { iso3Schema, regionCodeSchema, type CountryEntry, type ISO3, type KnownCodes, type TravelData } from "./data";
import { bboxCenter, type BBox, type LonLat } from "./geo";
import { countryByIso, countryName, regionByCode } from "./meta";

/** A city on a trip. Short keys keep invite links short. */
export const cityStopSchema = z.object({
  n: z.string().min(1).max(200),
  c: iso3Schema,
  la: z.number().min(-90).max(90),
  lo: z.number().min(-180).max(180),
});
/** A trip stop: a country ("JPN"), a state ("BR-BA") or a city. */
export const stopSchema = z.union([iso3Schema, regionCodeSchema, cityStopSchema]);

export type CityStop = z.infer<typeof cityStopSchema>;
export type Stop = z.infer<typeof stopSchema>;

export const isCityStop = (s: Stop): s is CityStop => typeof s === "object";
/** A state stop ("BR-BA"); country codes never contain a dash. */
export const isRegionStop = (s: Stop): s is string => typeof s === "string" && s.includes("-");

export function stopKey(s: Stop): string {
  return isCityStop(s) ? `city:${s.c}:${s.n}:${s.la}:${s.lo}` : s;
}

export function stopName(s: Stop): string {
  if (isCityStop(s)) return s.n;
  return isRegionStop(s) ? (regionByCode(s)?.name ?? s) : countryName(s);
}

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
/** "Kyoto, Bahia, and South Korea" */
export const stopList = (stops: Stop[]): string => listFormat.format(stops.map(stopName));

export function stopCountry(s: Stop): ISO3 {
  if (isCityStop(s)) return s.c;
  return isRegionStop(s) ? (regionByCode(s)?.country ?? s) : s;
}

/** The area to frame for a state or country; null for a city (a point). */
export function stopBounds(s: Stop): BBox | null {
  if (isCityStop(s)) return null;
  return (isRegionStop(s) ? regionByCode(s)?.bbox : countryByIso(s)?.bbox) ?? null;
}

export function stopCenter(s: Stop): LonLat {
  if (isCityStop(s)) return [s.lo, s.la];
  const bounds = stopBounds(s);
  return bounds ? bboxCenter(bounds) : [0, 0];
}

/**
 * Countries to outline on a trip map: the country of every city or state stop, so you can tell
 * where it is. Countries that are stops themselves are filled instead, so they're left out.
 */
export function outlinedCountries(stops: Stop[]): ISO3[] {
  const filled = new Set(stops.filter((s): s is ISO3 => typeof s === "string" && !isRegionStop(s)));
  const outlined = stops.filter((s) => isCityStop(s) || isRegionStop(s)).map(stopCountry);
  return [...new Set(outlined)].filter((iso) => !filled.has(iso));
}

export function isKnownStop(s: Stop, known: KnownCodes): boolean {
  if (isCityStop(s)) return known.countries.has(s.c);
  return isRegionStop(s) ? known.regions.has(s) : known.countries.has(s);
}

type Trip = { year?: number; note?: string };

/**
 * The "want to go" entry after adding a trip, or null when nothing changes. Places you've been
 * (visited/lived) are never touched; places already on the want list get the year and note merged.
 */
function wantEntry(current: CountryEntry | undefined, { year, note }: Trip): CountryEntry | null {
  if (current && current.status !== "want") return null;
  const years = [...new Set([...(current?.years ?? []), ...(year ? [year] : [])])].sort((a, b) => a - b);
  const notes = current?.note ?? "";
  const mergedNote = note && !notes.includes(note) ? (notes ? `${notes}\n${note}` : note) : notes;
  const next: CountryEntry = { ...current, status: "want" };
  if (years.length) next.years = years;
  if (mergedNote) next.note = mergedNote;
  return current && JSON.stringify(next) === JSON.stringify(current) ? null : next;
}

/**
 * Put a trip's stops on the map as "want to go": states and countries, and the country of every stop
 * too. A city isn't something the map marks, so a city stop only adds its country. `added` lists the
 * states and countries that changed the map; when nothing changes, the same `data` object comes back.
 */
export function addStops(data: TravelData, stops: Stop[], trip: Trip = {}): { data: TravelData; added: string[] } {
  const countries = { ...data.countries };
  const regions = { ...data.regions };
  const added: string[] = [];

  const want = (entries: Record<string, CountryEntry>, code: string): boolean => {
    const next = wantEntry(entries[code], trip);
    if (next) entries[code] = next;
    return next !== null;
  };

  for (const stop of stops) {
    const country = stopCountry(stop);
    const regionChanged = isRegionStop(stop) && want(regions, stop);
    const countryChanged = want(countries, country);
    if (regionChanged) added.push(stop);
    else if (countryChanged) added.push(country);
  }
  return added.length ? { data: { ...data, countries, regions }, added } : { data, added };
}
