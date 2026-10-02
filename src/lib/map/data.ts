import { z } from "astro/zod";
import { regionByCode } from "./meta";

export type ISO3 = string;
export const STATUSES = ["visited", "lived", "want"] as const;
export type Status = (typeof STATUSES)[number];

export function isHttpsUrl(s: string): boolean {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

export const iso3Schema = z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter uppercase country code");
/** A state/province: ISO 3166-2, e.g. "BR-SP". */
export const regionCodeSchema = z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/, "must be an ISO 3166-2 code like BR-SP");
const yearSchema = z.number().int().min(1900).max(2100);
const noteSchema = z.string().max(2000);

export const countryEntrySchema = z.object({
  status: z.enum(STATUSES),
  years: z.array(yearSchema).optional(),
  note: noteSchema.optional(),
});

export const citySchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  country: iso3Schema,
  /** The state it's in, when its country has states. */
  region: regionCodeSchema.optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  status: z.enum(["visited", "want"]),
  year: yearSchema.optional(),
  note: noteSchema.optional(),
  photo: z.string().refine(isHttpsUrl, "must be an https URL").optional(),
  custom: z.boolean().optional(),
});

export const travelDataSchema = z.object({
  version: z.literal(1),
  countries: z.record(iso3Schema, countryEntrySchema),
  regions: z.record(regionCodeSchema, countryEntrySchema),
  cities: z.array(citySchema),
});

export type CountryEntry = z.infer<typeof countryEntrySchema>;
export type City = z.infer<typeof citySchema>;
export type TravelData = z.infer<typeof travelDataSchema>;

export function emptyData(): TravelData {
  return { version: 1, countries: {}, regions: {}, cities: [] };
}

/** The codes the app has shapes for; anything else in imported data is dropped. */
export interface KnownCodes {
  countries: ReadonlySet<string>;
  regions: ReadonlySet<string>;
}

export function dropUnknown(data: TravelData, known: KnownCodes): { data: TravelData; unknown: string[] } {
  const unknown = new Set<string>();
  const keepKnown = <T>(entries: Record<string, T>, codes: ReadonlySet<string>): Record<string, T> =>
    Object.fromEntries(Object.entries(entries).filter(([code]) => codes.has(code) || (unknown.add(code), false)));
  const countries = keepKnown(data.countries, known.countries);
  const regions = keepKnown(data.regions, known.regions);
  const cities = data.cities
    .filter((c) => known.countries.has(c.country) || (unknown.add(c.country), false))
    // A city in a state we don't know stays, without its state.
    .map((c) => (c.region && !known.regions.has(c.region) ? (unknown.add(c.region), { ...c, region: undefined }) : c));
  return { data: { ...data, countries, regions, cities }, unknown: [...unknown] };
}

const STATUS_RANK: Record<Status, number> = { want: 0, visited: 1, lived: 2 };

/** `entry` raised to at least `status` (want < visited < lived), keeping its years and note; never lowered. */
function atLeast(entry: CountryEntry | undefined, status: Status): CountryEntry {
  return entry && STATUS_RANK[entry.status] >= STATUS_RANK[status] ? entry : { ...entry, status };
}

/**
 * Set or clear a state. Marking a state also raises its country to at least the same status.
 * Clearing a state leaves the country alone.
 */
export function setRegion(data: TravelData, code: string, entry: CountryEntry | null): TravelData {
  const regions = { ...data.regions };
  if (!entry) {
    delete regions[code];
    return { ...data, regions };
  }
  regions[code] = entry;
  const iso = regionByCode(code)?.country;
  if (!iso) return { ...data, regions };
  return { ...data, regions, countries: { ...data.countries, [iso]: atLeast(data.countries[iso], entry.status) } };
}

/**
 * Add or update a city. Having been to a city means having been to its state and country, so those
 * are raised to at least "visited". A city you want to go to changes nothing else.
 */
export function setCity(data: TravelData, city: City): TravelData {
  const exists = data.cities.some((c) => c.id === city.id);
  const next = { ...data, cities: exists ? data.cities.map((c) => (c.id === city.id ? city : c)) : [...data.cities, city] };
  if (city.status !== "visited") return next;
  const withRegion = city.region ? setRegion(next, city.region, atLeast(next.regions[city.region], "visited")) : next;
  return { ...withRegion, countries: { ...withRegion.countries, [city.country]: atLeast(withRegion.countries[city.country], "visited") } };
}

export function parseYears(s: string): number[] {
  const years = (s.match(/\d{4}/g) ?? []).map(Number).filter((y) => y >= 1900 && y <= 2100);
  return [...new Set(years)].sort((a, b) => a - b);
}
