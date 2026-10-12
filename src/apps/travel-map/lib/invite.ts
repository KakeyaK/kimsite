import { z } from "astro/zod";
import type { KnownCodes } from "./data";
import type { CityRow } from "./cities";
import { fold } from "./search";
import { isCityStop, isKnownStop, stopSchema, type Stop } from "./stops";

export const MAX_STOPS = 10;
/** The message is Markdown (it can hold image links), rendered safely by components/markdown.tsx. */
export const MAX_MESSAGE = 2000;
export const MAX_FROM = 80;
/** Images shown in a message; more are left out. */
export const MAX_MD_IMAGES = 6;

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
 * The link format, readable enough for a person or a language model to write by hand:
 *
 *   /sandbox/travel-map/invite#to=Kyoto@JPN,BR-BA,KOR&from=Kim&date=2027-03-01&end=2027-03-15&msg=…
 *
 * Values are percent-encoded. A stop is a country code (JPN), a state code (BR-BA) or a city, Name@ISO3,
 * looked up by name in the city list. The invite-guide page (src/pages/sandbox/travel-map/invite-guide.astro)
 * documents it from lib/inviteGuide.ts.
 */
export const INVITE_FIELDS = ["to", "from", "email", "date", "end", "msg"] as const;
export type InviteField = (typeof INVITE_FIELDS)[number];

/** What's wrong with a link, for the error page: the field, and what it should look like. */
export type InviteError = { field: string; message: string };
export type DecodeResult = { ok: true; value: Invite; unknown: string[] } | { ok: false; error: InviteError };

/** A stop as written in the link, before cities are looked up. */
type StopSpec = { code: string } | { city: string; iso: string };

const COUNTRY_RE = /^[A-Z]{3}$/;
const REGION_RE = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

/** Percent-decode a value; `+` is a space, and a stray `%` (as in "100% fun") is kept as is. Null if it can't be decoded. */
function decodeValue(s: string): string | null {
  const plain = s.replace(/\+/g, " ");
  try {
    return decodeURIComponent(plain);
  } catch {
    try {
      return decodeURIComponent(plain.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
    } catch {
      return null;
    }
  }
}

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

/**
 * Read an invite from a link's hash (`#to=…&from=…`). Cities are looked up in `loadCities()`, which
 * is only called when the link has one. Places that can't be found are skipped and listed in `unknown`;
 * anything else wrong with the link is an error naming the field.
 */
export async function decodeInvite(hash: string, known: KnownCodes, loadCities: () => Promise<CityRow[]>): Promise<DecodeResult> {
  const fail = (field: string, message: string): DecodeResult => ({ ok: false, error: { field, message } });
  const body = hash.replace(/^#/, "");
  if (!body) return fail("to", "the link has no invite in it: it should end in #to=… followed by the places");

  const raw: Partial<Record<InviteField, string>> = {};
  for (const part of body.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    if (!(INVITE_FIELDS as readonly string[]).includes(key)) {
      return fail(key, `isn't a field. The fields are ${INVITE_FIELDS.join(", ")}, each written as name=value and separated by &`);
    }
    if (eq === -1) return fail(key, `has no value: write ${key}=…`);
    if (raw[key as InviteField] !== undefined) return fail(key, "appears more than once");
    raw[key as InviteField] = part.slice(eq + 1);
  }

  const values: Partial<Record<InviteField, string>> = {};
  for (const field of INVITE_FIELDS) {
    if (field === "to" || raw[field] === undefined) continue;
    const v = decodeValue(raw[field]!);
    if (v === null) return fail(field, "isn't percent-encoded correctly");
    if (v.trim()) values[field] = v.trim();
  }

  // Stops: split on the commas first, so a comma inside a city name can be encoded as %2C.
  if (!raw.to) return fail("to", "is missing: list the places, e.g. to=Kyoto@JPN,BR-BA,KOR");
  const specs: StopSpec[] = [];
  for (const piece of raw.to.split(",")) {
    const s = decodeValue(piece)?.trim();
    if (s === undefined) return fail("to", `"${piece}" isn't percent-encoded correctly`);
    if (!s) continue;
    const spec = parseStop(s);
    if (!spec) {
      const hint = s.includes(",") ? " Don't percent-encode the commas between stops." : "";
      return fail("to", `"${s}" isn't a stop. Write a country code (JPN), a state code (BR-BA) or a city as Name@ISO3 (Kyoto@JPN).${hint}`);
    }
    specs.push(spec);
  }
  if (specs.length === 0) return fail("to", "has no places: list them, e.g. to=Kyoto@JPN,BR-BA,KOR");
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
    if (!invite.date) return fail("end", "needs a start date (date=…)");
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
  if (stops.length === 0) return fail("to", `none of the places could be found: ${unknown.join(", ")}`);
  return { ok: true, value: { ...invite, stops }, unknown };
}

/** The hash for an invite, without the `#`. A city is written by name; decoding finds it again in the city list. */
export function encodeInvite(i: Invite): string {
  const parts = [
    `to=${i.stops.map((s) => (isCityStop(s) ? `${encodeURIComponent(s.n)}@${s.c}` : s)).join(",")}`,
  ];
  const add = (field: InviteField, value: string | undefined) => value && parts.push(`${field}=${encodeURIComponent(value)}`);
  add("from", i.from);
  add("email", i.email);
  add("date", i.date);
  add("end", i.end);
  add("msg", i.message);
  return parts.join("&");
}

export const INVITE_PATH = "/sandbox/travel-map/invite";

export const inviteUrl = (origin: string, i: Invite): string => `${origin}${INVITE_PATH}#${encodeInvite(i)}`;
