import LZString from "lz-string";
import { z } from "astro/zod";
import { dropUnknown, travelDataSchema, type KnownCodes, type TravelData } from "./data";

/** A map shared as a link: a snapshot of someone's travel data, compressed into the hash (`#m=…`). */
export const sharedMapSchema = z.object({
  v: z.literal(1),
  /** The sharer's name, shown as the map's owner. */
  name: z.string().max(80).optional(),
  data: travelDataSchema,
});

export type SharedMap = z.infer<typeof sharedMapSchema>;

/** The data without notes, for sharing a map without them. */
export function withoutNotes(data: TravelData): TravelData {
  const strip = (entries: TravelData["countries"]) =>
    Object.fromEntries(Object.entries(entries).map(([code, { note: _note, ...rest }]) => [code, rest]));
  return { ...data, countries: strip(data.countries), regions: strip(data.regions) };
}

export function encodeSharedMap(data: TravelData, { name, notes = false }: { name?: string; notes?: boolean } = {}): string {
  const map: SharedMap = { v: 1, data: notes ? data : withoutNotes(data) };
  const trimmed = name?.trim().slice(0, 80);
  if (trimmed) map.name = trimmed;
  return LZString.compressToEncodedURIComponent(JSON.stringify(map));
}

/** The shared map in a payload, with unknown place codes dropped; null when the link is broken or cut off. */
export function decodeSharedMap(s: string, known: KnownCodes): { value: SharedMap; unknown: string[] } | null {
  if (!s) return null;
  let raw: unknown;
  try {
    // lz-string's alphabet has no '%', so one means a chat app percent-encoded the link ('$' → '%24').
    if (s.includes("%")) s = decodeURIComponent(s);
    const json = LZString.decompressFromEncodedURIComponent(s);
    raw = json ? JSON.parse(json) : undefined;
  } catch {
    return null;
  }
  const parsed = sharedMapSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { data, unknown } = dropUnknown(parsed.data.data, known);
  return { value: { ...parsed.data, data }, unknown };
}

/** The payload from a `#m=…` hash, or null. */
export function parseSharedHash(hash: string): string | null {
  return /^#m=(.+)$/.exec(hash)?.[1] ?? null;
}

export const sharedMapUrl = (origin: string, data: TravelData, opts: { name?: string; notes?: boolean } = {}): string =>
  `${origin}/sandbox/travel-map/shared#m=${encodeSharedMap(data, opts)}`;
