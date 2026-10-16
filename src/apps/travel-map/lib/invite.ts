import LZString from "lz-string";
import { z } from "astro/zod";
import type { KnownCodes } from "./data";
import type { CityRow } from "./cities";
import { fold } from "./search";
import { isCityStop, isKnownStop, stopSchema, type Stop } from "./stops";

export const MAX_STOPS = 10;
/**
 * The message is Markdown (it can hold image links), rendered safely by components/markdown.tsx. Invites are shared as
 * short links (lib/shortLink.ts), so the message never has to fit in a URL; the shortener takes the largest one.
 */
export const MAX_MESSAGE = 20_000;
export const MAX_FROM = 80;
/** Images shown in a message; more are left out. */
export const MAX_MD_IMAGES = 12;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const emailSchema = z.string().email().max(254);

export const inviteSchema = z
  .object({
    from: z.string().max(MAX_FROM).optional(),
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

/*
 * The link: /sandbox/travel-map/invite#i=…, the fields below as JSON, compressed with lz-string (like a
 * shared map's #m=…). Nobody shares it: the trip planner stores the invite with the shortener and shares the short
 * link (lib/shortLink.ts), which forwards here. What people (and language models) write by hand is the invite
 * document, which has the same fields (lib/inviteDoc.ts). A stop is a country code (JPN), a state code (BR-BA) or a
 * city, Name@ISO3, looked up by name in the city list.
 */
export type InviteField = "to" | "from" | "email" | "date" | "end" | "msg";

/** What's wrong with a link, for the error page: the field, and what it should look like. */
export type InviteError = { field: string; message: string };
export type DecodeResult = { ok: true; value: Invite; unknown: string[] } | { ok: false; error: InviteError };

/** An invite's fields as written (in a link or a document), trimmed, before anything is checked. */
export type RawInvite = { to: string[] } & Partial<Record<Exclude<InviteField, "to">, string>>;

/** A stop as written, before cities are looked up. */
type StopSpec = { code: string } | { city: string; iso: string };

const COUNTRY_RE = /^[A-Z]{3}$/;
const REGION_RE = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

function parseStop(s: string): StopSpec | null {
  const at = s.lastIndexOf("@");
  if (at === -1) {
    const code = s.toUpperCase();
    return COUNTRY_RE.test(code) || REGION_RE.test(code) ? { code } : null;
  }
  const city = s.slice(0, at).trim();
  const iso = s.slice(at + 1).trim().toUpperCase();
  return city && city.length <= 200 && COUNTRY_RE.test(iso) ? { city, iso } : null;
}

const isRealDate = (d: string) => dateSchema.safeParse(d).success && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);

/**
 * The most populous city with this name in this country, ignoring case and accents. "Misato" also finds
 * "Misato, Saitama" (the list qualifies a few names that way). Null when there's none.
 */
export function findCity(rows: CityRow[], name: string, iso: string): CityRow | null {
  const q = fold(name.trim());
  let best: CityRow | null = null;
  let bestRank = -1;
  for (const row of rows) {
    if (row[1] !== iso) continue;
    const n = fold(row[0]);
    const rank = n === q ? 2 : n.split(",")[0].trim() === q ? 1 : 0;
    if (rank > 0 && (rank > bestRank || (rank === bestRank && row[4] > (best?.[4] ?? -1)))) {
      best = row;
      bestRank = rank;
    }
  }
  return best;
}

const fail = (field: string, message: string): DecodeResult => ({ ok: false, error: { field, message } });
const notAStop = (s: string) => `"${s}" isn't a stop. Write a country code (JPN), a state code (BR-BA) or a city as Name@ISO3 (Kyoto@JPN).`;

/**
 * Read an invite from a link's hash (`#i=…`). Cities are looked up in `loadCities()`, which is only called when the
 * invite has one. Places that can't be found are skipped and listed in `unknown`; anything else wrong with the invite
 * is an error naming the field.
 */
export async function decodeInvite(hash: string, known: KnownCodes, loadCities: () => Promise<CityRow[]>): Promise<DecodeResult> {
  const body = hash.replace(/^#/, "");
  if (!body) return fail("i", "is missing: the link has no invite in it");
  if (!body.startsWith("i=")) return fail("i", "is missing: this isn't an invite link");
  return decodePacked(body.slice(2), known, loadCities);
}

/**
 * Check an invite's fields and look its places up. Unlike a link, the result may have no stops at all
 * (none written, or none found): the trip planner takes a half-written invite.
 */
export async function resolveInvite(values: RawInvite, known: KnownCodes, loadCities: () => Promise<CityRow[]>): Promise<DecodeResult> {
  const specs: StopSpec[] = [];
  for (const s of values.to) {
    const spec = parseStop(s);
    if (!spec) return fail("to", notAStop(s));
    specs.push(spec);
  }
  if (specs.length > MAX_STOPS) return fail("to", `has ${specs.length} places; the most is ${MAX_STOPS}`);

  const invite: Omit<Invite, "stops"> = {};
  if (values.from) {
    if (values.from.length > MAX_FROM) return fail("from", `is ${values.from.length} characters long; the most is ${MAX_FROM}`);
    invite.from = values.from;
  }
  if (values.email) {
    if (!emailSchema.safeParse(values.email).success) return fail("email", `"${values.email}" isn't an email address`);
    invite.email = values.email;
  }
  if (values.date) {
    if (!isRealDate(values.date)) return fail("date", `"${values.date}" isn't a date written YYYY-MM-DD`);
    invite.date = values.date;
  }
  if (values.end) {
    if (!isRealDate(values.end)) return fail("end", `"${values.end}" isn't a date written YYYY-MM-DD`);
    if (!invite.date) return fail("end", "needs a start date");
    if (values.end < invite.date) return fail("end", `is before the start date (${invite.date})`);
    invite.end = values.end;
  }
  if (values.msg) {
    if (values.msg.length > MAX_MESSAGE) return fail("msg", `is ${values.msg.length} characters long; the most is ${MAX_MESSAGE}`);
    invite.message = values.msg;
  }

  let rows: CityRow[] = [];
  if (specs.some((s) => "city" in s)) {
    try {
      rows = await loadCities();
    } catch {
      // the city list didn't load: the cities are skipped like unknown ones
    }
  }
  const stops: Stop[] = [];
  const unknown: string[] = [];
  for (const spec of specs) {
    if ("code" in spec) {
      if (isKnownStop(spec.code, known)) stops.push(spec.code);
      else unknown.push(spec.code);
    } else {
      const row = known.countries.has(spec.iso) ? findCity(rows, spec.city, spec.iso) : null;
      if (row) stops.push({ n: row[0], c: row[1], la: row[2], lo: row[3] });
      else unknown.push(`${spec.city}@${spec.iso}`);
    }
  }
  return { ok: true, value: { ...invite, stops }, unknown };
}

const packedSchema = z.object({
  to: z.array(z.string()),
  from: z.string().optional(),
  email: z.string().optional(),
  date: z.string().optional(),
  end: z.string().optional(),
  msg: z.string().optional(),
});

/** Read a compressed invite (the payload of `#i=…`). */
async function decodePacked(payload: string, known: KnownCodes, loadCities: () => Promise<CityRow[]>): Promise<DecodeResult> {
  const broken = fail("i", "can't be read: the link was cut off or changed on the way");
  let raw: unknown;
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    raw = json ? JSON.parse(json) : undefined;
  } catch {
    return broken;
  }
  const parsed = packedSchema.safeParse(raw);
  if (!parsed.success) return broken;
  const r = await resolveInvite(parsed.data, known, loadCities);
  if (r.ok && r.value.stops.length === 0) return fail("to", r.unknown.length ? `none of the places could be found: ${r.unknown.join(", ")}` : "has no places");
  return r;
}

/** The hash for an invite, without the `#`: its fields, compressed. A city is written by name; decoding finds it again in the city list. */
export function encodeInvite(i: Invite): string {
  const raw: RawInvite = { to: i.stops.map((s) => (isCityStop(s) ? `${s.n}@${s.c}` : s)) };
  if (i.from) raw.from = i.from;
  if (i.email) raw.email = i.email;
  if (i.date) raw.date = i.date;
  if (i.end) raw.end = i.end;
  if (i.message) raw.msg = i.message;
  return `i=${LZString.compressToEncodedURIComponent(JSON.stringify(raw))}`;
}

export const INVITE_PATH = "/sandbox/travel-map/invite";

export const inviteUrl = (origin: string, i: Invite): string => `${origin}${INVITE_PATH}#${encodeInvite(i)}`;
