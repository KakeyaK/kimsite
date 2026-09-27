import { z } from "astro/zod";

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
  cities: z.array(citySchema),
});

export type CountryEntry = z.infer<typeof countryEntrySchema>;
export type City = z.infer<typeof citySchema>;
export type TravelData = z.infer<typeof travelDataSchema>;

export function emptyData(): TravelData {
  return { version: 1, countries: {}, cities: [] };
}

/** Bring older or hand-written documents up to the current shape before validating. */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  return {
    ...obj,
    version: obj.version ?? 1,
    cities: obj.cities ?? [],
  };
}

export function dropUnknown(
  data: TravelData,
  known: ReadonlySet<string>,
): { data: TravelData; unknown: ISO3[] } {
  const unknown = new Set<ISO3>();
  const countries: TravelData["countries"] = {};
  for (const [iso, entry] of Object.entries(data.countries)) {
    if (known.has(iso)) countries[iso] = entry;
    else unknown.add(iso);
  }
  const cities = data.cities.filter((c) => {
    if (known.has(c.country)) return true;
    unknown.add(c.country);
    return false;
  });
  return { data: { ...data, countries, cities }, unknown: [...unknown] };
}

export function parseYears(s: string): number[] {
  const years = (s.match(/\d{4}/g) ?? []).map(Number).filter((y) => y >= 1900 && y <= 2100);
  return [...new Set(years)].sort((a, b) => a - b);
}

/**
 * Mark countries as "want to go" (e.g. from an invite), recording the trip year and a note.
 * Countries already visited/lived keep their entry; ones already on the want list get the year/note merged.
 * `added` lists the countries that changed; when nothing changes the same `data` object is returned.
 */
export function addWants(
  data: TravelData,
  isos: ISO3[],
  { year, note }: { year?: number; note?: string } = {},
): { data: TravelData; added: ISO3[] } {
  const countries = { ...data.countries };
  const added: ISO3[] = [];
  for (const iso of new Set(isos)) {
    const current = countries[iso];
    if (current && current.status !== "want") continue;
    const years = [...new Set([...(current?.years ?? []), ...(year ? [year] : [])])].sort((a, b) => a - b);
    const notes = current?.note ?? "";
    const nextNote = note && !notes.includes(note) ? (notes ? `${notes}\n${note}` : note) : notes;
    const next: CountryEntry = { ...current, status: "want" };
    if (years.length) next.years = years;
    if (nextNote) next.note = nextNote;
    if (current && JSON.stringify(next) === JSON.stringify(current)) continue;
    countries[iso] = next;
    added.push(iso);
  }
  return added.length ? { data: { ...data, countries }, added } : { data, added };
}
