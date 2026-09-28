import countriesRaw from "./countries.json";
import regionsRaw from "./regions.json";
import type { KnownCodes } from "./data";
import type { BBox } from "./geo";
import type { CountryMeta } from "./stats";
import { rankByName } from "./search";

export const COUNTRIES = countriesRaw as CountryMeta[];
const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
export const KNOWN_ISO: ReadonlySet<string> = new Set(BY_ISO.keys());

export const countryByIso = (iso: string): CountryMeta | undefined => BY_ISO.get(iso);
export const countryName = (iso: string): string => BY_ISO.get(iso)?.name ?? iso;

export function searchCountries(query: string, limit = 8): CountryMeta[] {
  return query.trim() ? rankByName(COUNTRIES, (c) => c.name, query, limit) : [];
}

/** A state/province (ISO 3166-2 code, e.g. "BR-SP"). Only countries listed in the geodata script have them. */
export interface RegionMeta { code: string; name: string; country: string; bbox: BBox }

export const REGIONS = regionsRaw as RegionMeta[];
const BY_CODE = new Map(REGIONS.map((r) => [r.code, r]));
export const KNOWN_REGIONS: ReadonlySet<string> = new Set(BY_CODE.keys());

export const regionByCode = (code: string): RegionMeta | undefined => BY_CODE.get(code);
export const regionsOf = (iso: string): RegionMeta[] => REGIONS.filter((r) => r.country === iso);

export function searchRegions(query: string, limit = 8): RegionMeta[] {
  return query.trim() ? rankByName(REGIONS, (r) => r.name, query, limit) : [];
}

/** Everything the app has shapes for; used to drop unknown codes from imports and invites. */
export const KNOWN_CODES: KnownCodes = { countries: KNOWN_ISO, regions: KNOWN_REGIONS };
