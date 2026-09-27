import raw from "./countries.json";
import type { CountryMeta } from "./stats";
import { rankByName } from "./search";

export const COUNTRIES = raw as CountryMeta[];
const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
export const KNOWN_ISO: ReadonlySet<string> = new Set(BY_ISO.keys());

export const countryByIso = (iso: string): CountryMeta | undefined => BY_ISO.get(iso);
export const countryName = (iso: string): string => BY_ISO.get(iso)?.name ?? iso;

export function searchCountries(query: string, limit = 8): CountryMeta[] {
  return query.trim() ? rankByName(COUNTRIES, (c) => c.name, query, limit) : [];
}
