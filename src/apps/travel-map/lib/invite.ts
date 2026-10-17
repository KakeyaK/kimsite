import LZString from "lz-string";
import { z } from "astro/zod";
import type { KnownCodes } from "./data";
import type { CityRow } from "./cities";
import { fold } from "./search";
import { isCityStop, isKnownStop, modeSchema, MODES, stopSchema, type Mode, type Stop } from "./stops";

export const MAX_STOPS = 10;
/**
 * The message is Markdown (it can hold image links), rendered safely by components/markdown.tsx. Invites are shared as
 * short links (lib/shortLink.ts), so the message never has to fit in a URL; the shortener takes the largest one.
 */
export const MAX_MESSAGE = 20_000;
export const MAX_FROM = 80;
export const MAX_TITLE = 120;
/** Images shown in a message; more are left out. */
export const MAX_MD_IMAGES = 12;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const emailSchema = z.string().email().max(254);

export const inviteSchema = z
  .object({
    /** The cover's headline; without one it says who invites you where. */
    title: z.string().max(MAX_TITLE).optional(),
    from: z.string().max(MAX_FROM).optional(),
    /** The inviter's email, so the friend's calendar event can invite them back. */
    email: emailSchema.optional(),
    /** The destinations. */
    stops: z.array(stopSchema).min(1).max(MAX_STOPS),
    /** Where the trip leaves from and comes back to, when said. They're on the route, but not destinations. */
    start: stopSchema.optional(),
    finish: stopSchema.optional(),
    /**
     * Along the route (tripRoute: start, stops, finish), how each leg is travelled: `legs[i]` goes from point i to
     * point i + 1 (null: not said). Left out when none is.
     */
    legs: z.array(modeSchema.nullable()).optional(),
    /** The cover's message. */
    message: z.string().max(MAX_MESSAGE).optional(),
    /** Along the route, what the inviter wrote about each point, in Markdown (null: nothing). Left out when none has one. */
    notes: z.array(z.string().nullable()).optional(),
    /** Trip start (YYYY-MM-DD); `end` is the last day, and needs a start. */
    date: dateSchema.optional(),
    end: dateSchema.optional(),
  })
  .refine((i) => !i.end || (i.date !== undefined && i.end >= i.date), { message: "end must be on or after the start date", path: ["end"] });

export type Invite = z.infer<typeof inviteSchema>;

/** A point on the route: the start, a destination or the finish, with how you get there and the inviter's note. */
export interface RoutePoint {
  stop: Stop;
  role: "start" | "stop" | "finish";
  /** How you get here from the point before; null for the first point, or when not said. */
  by: Mode | null;
  note: string | null;
}

/** The whole trip in order: where it leaves from, the destinations, where it comes back to. */
export function tripRoute(i: Pick<Invite, "stops" | "start" | "finish" | "legs" | "notes">): RoutePoint[] {
  const points: Pick<RoutePoint, "stop" | "role">[] = [
    ...(i.start ? [{ stop: i.start, role: "start" as const }] : []),
    ...i.stops.map((stop) => ({ stop, role: "stop" as const })),
    ...(i.finish ? [{ stop: i.finish, role: "finish" as const }] : []),
  ];
  return points.map((p, k) => ({ ...p, by: (k > 0 && i.legs?.[k - 1]) || null, note: i.notes?.[k] || null }));
}

/*
 * The link: /sandbox/travel-map/invite#i=…, the fields below as JSON, compressed with lz-string (like a
 * shared map's #m=…). Nobody shares it: the trip planner stores the invite with the shortener and shares the short
 * link (lib/shortLink.ts), which forwards here. What people (and language models) write by hand is the invite
 * document, which has the same fields (lib/inviteDoc.ts). A stop is a country code (JPN), a state code (BR-BA) or a
 * city, Name@ISO3, looked up by name in the city list. It may end with how you get there from the stop before:
 * "Kyoto@JPN by train". The trip may also say where it leaves from (`start`) and comes back to (`return`): on the route,
 * but not destinations. `notes` go along the route, one per place.
 */
export type InviteField = "title" | "to" | "start" | "return" | "from" | "email" | "date" | "end" | "msg";

/** What's wrong with a link, for the error page: the field, and what it should look like. */
export type InviteError = { field: string; message: string };
export type DecodeResult = { ok: true; value: Invite; unknown: string[] } | { ok: false; error: InviteError };

/**
 * An invite's fields as written (in a link or a document), trimmed, before anything is checked. `return` is the
 * finish; `notes` go along the route as written (start, to, return), "" for a point without one.
 */
export type RawInvite = { to: string[]; notes?: string[] } & Partial<Record<Exclude<InviteField, "to">, string>>;

/** A stop as written, before cities are looked up, with how you get there. */
type StopSpec = ({ code: string } | { city: string; iso: string }) & { by?: Mode };

const COUNTRY_RE = /^[A-Z]{3}$/;
const REGION_RE = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

const BY_RE = new RegExp(`\\s+by\\s+(${MODES.join("|")})$`, "i");

function parseStop(written: string): StopSpec | null {
  const by = BY_RE.exec(written);
  const s = by ? written.slice(0, by.index).trim() : written;
  const spec = parsePlace(s);
  return spec && by ? { ...spec, by: by[1].toLowerCase() as Mode } : spec;
}

function parsePlace(s: string): StopSpec | null {
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
const notAStop = (s: string) =>
  `"${s}" isn't a stop. Write a country code (JPN), a state code (BR-BA) or a city as Name@ISO3 (Kyoto@JPN), then optionally how you get there: ${MODES.map((m) => `by ${m}`).join(", ")}.`;

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
  /** The route as written: the start, the destinations, the finish. */
  const written: { spec: StopSpec; role: RoutePoint["role"] }[] = [];
  if (values.start) {
    const spec = parseStop(values.start);
    if (!spec) return fail("start", notAStop(values.start));
    if (spec.by) return fail("start", `"${values.start}" is where the trip leaves from, so there's no getting there "by ${spec.by}"`);
    written.push({ spec, role: "start" });
  }
  for (const s of values.to) {
    const spec = parseStop(s);
    if (!spec) return fail("to", notAStop(s));
    if (spec.by && !written.length) {
      return fail("to", `"${s}" is the first place and the trip has no start, so there's no getting there "by ${spec.by}": add a start, or say it on the place you travel to`);
    }
    written.push({ spec, role: "stop" });
  }
  const destinations = written.filter((w) => w.role === "stop").length;
  if (destinations > MAX_STOPS) return fail("to", `has ${destinations} places; the most is ${MAX_STOPS}`);
  if (values.return) {
    const spec = parseStop(values.return);
    if (!spec) return fail("return", notAStop(values.return));
    written.push({ spec, role: "finish" });
  }

  const invite: Omit<Invite, "stops"> = {};
  if (values.title) {
    if (values.title.length > MAX_TITLE) return fail("title", `is ${values.title.length} characters long; the most is ${MAX_TITLE}`);
    invite.title = values.title;
  }
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
  const notes = values.notes ?? [];
  if (notes.length > written.length) return fail("notes", `has ${notes.length} notes for ${written.length} places`);
  const text = (values.msg?.length ?? 0) + notes.reduce((n, note) => n + note.length, 0);
  if (text > MAX_MESSAGE) {
    return fail("msg", `${notes.some(Boolean) ? "and the places' notes are" : "is"} ${text} characters long; the most is ${MAX_MESSAGE}`);
  }
  if (values.msg) invite.message = values.msg;

  let rows: CityRow[] = [];
  if (written.some((w) => "city" in w.spec)) {
    try {
      rows = await loadCities();
    } catch {
      // the city list didn't load: the cities are skipped like unknown ones
    }
  }
  const route: { stop: Stop; role: RoutePoint["role"]; by: Mode | null; note: string | null }[] = [];
  const unknown: string[] = [];
  for (const [k, { spec, role }] of written.entries()) {
    let stop: Stop | null = null;
    if ("code" in spec) {
      if (isKnownStop(spec.code, known)) stop = spec.code;
      else unknown.push(spec.code);
    } else {
      const row = known.countries.has(spec.iso) ? findCity(rows, spec.city, spec.iso) : null;
      if (row) stop = { n: row[0], c: row[1], la: row[2], lo: row[3] };
      else unknown.push(`${spec.city}@${spec.iso}`);
    }
    // A place that's skipped takes its leg and its note with it.
    if (stop) route.push({ stop, role, by: spec.by ?? null, note: notes[k] || null });
  }
  const start = route.find((p) => p.role === "start")?.stop;
  const finish = route.find((p) => p.role === "finish")?.stop;
  const legs = route.slice(1).map((p) => p.by);
  const found = route.map((p) => p.note);
  return {
    ok: true,
    value: {
      ...invite,
      stops: route.filter((p) => p.role === "stop").map((p) => p.stop),
      ...(start && { start }),
      ...(finish && { finish }),
      ...(legs.some(Boolean) && { legs }),
      ...(found.some(Boolean) && { notes: found }),
    },
    unknown,
  };
}

const packedSchema = z.object({
  title: z.string().optional(),
  to: z.array(z.string()),
  start: z.string().optional(),
  return: z.string().optional(),
  notes: z.array(z.string()).optional(),
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

/** A place as written in a link or a document: `KOR`, `Kyoto@JPN`. */
export const writePlace = (s: Stop): string => (isCityStop(s) ? `${s.n}@${s.c}` : s);

/** The route as written in a link or a document: `KOR`, `Kyoto@JPN by train`, split into its fields, and the notes along it. */
export function writeRoute(i: Pick<Invite, "stops" | "start" | "finish" | "legs" | "notes">): Pick<RawInvite, "to" | "start" | "return" | "notes"> {
  const route = tripRoute(i);
  const write = (p: RoutePoint) => (p.by ? `${writePlace(p.stop)} by ${p.by}` : writePlace(p.stop));
  const out: Pick<RawInvite, "to" | "start" | "return" | "notes"> = { to: route.filter((p) => p.role === "stop").map(write) };
  const start = route.find((p) => p.role === "start");
  const finish = route.find((p) => p.role === "finish");
  if (start) out.start = write(start);
  if (finish) out.return = write(finish);
  if (route.some((p) => p.note)) out.notes = route.map((p) => p.note ?? "");
  return out;
}

/** The hash for an invite, without the `#`: its fields, compressed. A city is written by name; decoding finds it again in the city list. */
export function encodeInvite(i: Invite): string {
  const raw: RawInvite = writeRoute(i);
  if (i.title) raw.title = i.title;
  if (i.from) raw.from = i.from;
  if (i.email) raw.email = i.email;
  if (i.date) raw.date = i.date;
  if (i.end) raw.end = i.end;
  if (i.message) raw.msg = i.message;
  return `i=${LZString.compressToEncodedURIComponent(JSON.stringify(raw))}`;
}

export const INVITE_PATH = "/sandbox/travel-map/invite";

export const inviteUrl = (origin: string, i: Invite): string => `${origin}${INVITE_PATH}#${encodeInvite(i)}`;
