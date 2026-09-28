import { STATUSES, type CountryEntry, type ISO3, type Status, type TravelData } from "./data";
import { regionsOf } from "./meta";
import type { BBox } from "./geo";

export const TOTAL_COUNTRIES = 195;

/** `sovereign` is false for territories and dependencies (Hong Kong, Greenland, Jersey…); they don't count toward totals. */
export interface CountryMeta { iso: ISO3; name: string; continent: string; bbox: BBox; sovereign: boolean }
export type ColorKey = Status | "stop";

const IGNORED_CONTINENTS = new Set(["Antarctica", "Seven seas (open ocean)"]);
const MILESTONES = [10, 25, 50, 100];

export function counts(d: TravelData): Record<Status, number> {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const { status } of Object.values(d.countries)) out[status]++;
  return out;
}

export function beenTo(d: TravelData): ISO3[] {
  return Object.entries(d.countries)
    .filter(([, e]) => e.status !== "want")
    .map(([iso]) => iso)
    .sort();
}

/** Been-to countries that count toward "N / 195" and badges: sovereign states only. */
export function countedBeenTo(d: TravelData, meta: CountryMeta[]): ISO3[] {
  const sovereign = new Set(meta.filter((m) => m.sovereign).map((m) => m.iso));
  return beenTo(d).filter((iso) => sovereign.has(iso));
}

export interface ContinentProgress { continent: string; been: number; total: number }

export function continentProgress(d: TravelData, meta: CountryMeta[]): ContinentProgress[] {
  const been = new Set(beenTo(d));
  const byContinent = new Map<string, ContinentProgress>();
  for (const m of meta) {
    if (!m.sovereign || IGNORED_CONTINENTS.has(m.continent)) continue;
    const p = byContinent.get(m.continent) ?? { continent: m.continent, been: 0, total: 0 };
    p.total++;
    if (been.has(m.iso)) p.been++;
    byContinent.set(m.continent, p);
  }
  return [...byContinent.values()].sort((a, b) => a.continent.localeCompare(b.continent));
}

export function badges(d: TravelData, meta: CountryMeta[]): string[] {
  const n = countedBeenTo(d, meta).length;
  return [
    ...MILESTONES.filter((m) => n >= m).map((m) => `${m} countries`),
    ...continentProgress(d, meta)
      .filter((p) => p.total > 0 && p.been === p.total)
      .map((p) => `Every country in ${p.continent}`),
  ];
}

export function yearRange(d: TravelData): [number, number] | null {
  const years = [
    ...Object.values(d.countries).flatMap((e) => e.years ?? []),
    ...d.cities.flatMap((c) => (c.year === undefined ? [] : [c.year])),
  ];
  return years.length ? [Math.min(...years), Math.max(...years)] : null;
}

/** The map as it looked at the end of `year`: places first reached by then. Wishes and undated places are left out. */
export function atYear(d: TravelData, year: number): TravelData {
  const reachedBy = (entries: Record<string, CountryEntry>) =>
    Object.fromEntries(
      Object.entries(entries).filter(([, e]) => e.status !== "want" && e.years?.length && Math.min(...e.years) <= year),
    );
  const cities = d.cities.filter((c) => c.status === "visited" && c.year !== undefined && c.year <= year);
  return { version: 1, countries: reachedBy(d.countries), regions: reachedBy(d.regions), cities };
}

/** How many of a country's states you've been to (visited or lived). */
export function regionProgress(d: TravelData, iso: ISO3): { been: number; total: number } {
  const states = regionsOf(iso);
  return { been: states.filter((r) => d.regions[r.code] && d.regions[r.code].status !== "want").length, total: states.length };
}

export function regionColors(d: TravelData): Record<string, ColorKey> {
  return Object.fromEntries(Object.entries(d.regions).map(([code, e]) => [code, e.status]));
}

export function statusColors(d: TravelData): Record<ISO3, ColorKey> {
  return Object.fromEntries(Object.entries(d.countries).map(([iso, e]) => [iso, e.status]));
}
