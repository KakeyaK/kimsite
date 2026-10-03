import LZString from "lz-string";
import { z } from "astro/zod";
import type { KnownCodes } from "./data";
import { isCityStop, isKnownStop, stopSchema } from "./stops";

export const MAX_STOPS = 10;
/** The message is Markdown (it can hold image links), rendered safely by components/map/markdown.tsx. */
export const MAX_MESSAGE = 2000;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const emailSchema = z.string().email().max(254);

export const inviteSchema = z
  .object({
    v: z.literal(1),
    from: z.string().max(80).optional(),
    /** The inviter's email, so the friend's calendar event can invite them back. */
    email: emailSchema.optional(),
    stops: z.array(stopSchema).min(1).max(MAX_STOPS),
    message: z.string().max(MAX_MESSAGE).optional(),
    /** Trip start (YYYY-MM-DD); `end` is the last day, and needs a start. */
    date: dateSchema.optional(),
    end: dateSchema.optional(),
  })
  .refine((i) => !i.end || (i.date !== undefined && i.end >= i.date), { message: "end must be on or after the start date", path: ["end"] });

export type Invite = z.infer<typeof inviteSchema>;
export type Decoded<T> = { value: T; unknown: string[] };

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

export function decodeInvite(s: string, known: KnownCodes): Decoded<Invite> | null {
  const parsed = inviteSchema.safeParse(decodeRaw(s));
  if (!parsed.success) return null;
  const unknown: string[] = [];
  const stops = parsed.data.stops.filter(
    (stop) => isKnownStop(stop, known) || (unknown.push(isCityStop(stop) ? stop.c : stop), false),
  );
  if (stops.length === 0) return null;
  return { value: { ...parsed.data, stops }, unknown };
}

/** The invite payload from a `#i=…` hash, or null. */
export function parseHash(hash: string): string | null {
  return /^#i=(.+)$/.exec(hash)?.[1] ?? null;
}

export const inviteUrl = (origin: string, i: Invite): string =>
  `${origin}/sandbox/travel-map/invite#i=${encodeInvite(i)}`;
