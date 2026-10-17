import type { CountryEntry, ISO3, Status, TravelData } from "./data";
import type { BBox } from "./geo";
import type { OverlapKey } from "./overlap";

/**
 * `label` is where the name goes on the map; `labelRank` is how early it earns a spot (lower = sooner).
 */
export interface CountryMeta {
  iso: ISO3; name: string; continent: string; bbox: BBox; label: [number, number]; labelRank: number;
  /** Where the country is pinned (trip stops, lines, distances): its capital, or its label point when it has none. */
  point: [number, number];
}
/** A colour on the map: a status, a trip stop, or an overlap category (see overlap.ts). Each is a `--map-*` variable. */
export type ColorKey = Status | "stop" | OverlapKey;

export function yearRange(d: TravelData): [number, number] | null {
  const years = Object.values(d.countries).flatMap((e) => e.years ?? []);
  return years.length ? [Math.min(...years), Math.max(...years)] : null;
}

/** The map as it looked at the end of `year`: places first reached by then. Wishes and undated places are left out. */
export function atYear(d: TravelData, year: number): TravelData {
  const reachedBy = (entries: Record<string, CountryEntry>) =>
    Object.fromEntries(
      Object.entries(entries).filter(([, e]) => e.status !== "want" && e.years?.length && Math.min(...e.years) <= year),
    );
  return { version: 1, countries: reachedBy(d.countries), regions: reachedBy(d.regions) };
}

export function regionColors(d: TravelData): Record<string, ColorKey> {
  return Object.fromEntries(Object.entries(d.regions).map(([code, e]) => [code, e.status]));
}

export function statusColors(d: TravelData): Record<ISO3, ColorKey> {
  return Object.fromEntries(Object.entries(d.countries).map(([iso, e]) => [iso, e.status]));
}
