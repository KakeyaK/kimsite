import LZString from "lz-string";
import { z } from "astro/zod";
import { iso3Schema, type ISO3 } from "./data";

export const MAX_STOPS = 10;
/** The message is Markdown (it can hold image links), rendered safely by components/map/markdown.tsx. */
export const MAX_MESSAGE = 2000;

const fromSchema = z.string().max(80);
const stopsSchema = z.array(iso3Schema).min(1).max(MAX_STOPS);
const messageSchema = z.string().max(MAX_MESSAGE);

export const inviteSchema = z.object({
  v: z.literal(1),
  from: fromSchema.optional(),
  stops: stopsSchema,
  message: messageSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type Invite = z.infer<typeof inviteSchema>;
export type Decoded<T> = { value: T; unknown: ISO3[] };

function decodeRaw(s: string): unknown {
  if (!s) return undefined;
  try {
    // lz-string's alphabet has no '%', so one means a chat app percent-encoded the link ('$' → '%24').
    if (s.includes("%")) s = decodeURIComponent(s);
    const json = LZString.decompressFromEncodedURIComponent(s);
    return json ? JSON.parse(json) : undefined;
  } catch {
    return undefined;
  }
}

export const encodeInvite = (i: Invite): string => LZString.compressToEncodedURIComponent(JSON.stringify(i));

export function decodeInvite(s: string, known: ReadonlySet<string>): Decoded<Invite> | null {
  const parsed = inviteSchema.safeParse(decodeRaw(s));
  if (!parsed.success) return null;
  const unknown: ISO3[] = [];
  const stops = parsed.data.stops.filter((iso) => known.has(iso) || (unknown.push(iso), false));
  if (stops.length === 0) return null;
  return { value: { ...parsed.data, stops }, unknown };
}

/** The invite payload from a `#i=…` hash, or null. */
export function parseHash(hash: string): string | null {
  return /^#i=(.+)$/.exec(hash)?.[1] ?? null;
}

export const inviteUrl = (origin: string, i: Invite): string =>
  `${origin}/projects/map/invite#i=${encodeInvite(i)}`;
