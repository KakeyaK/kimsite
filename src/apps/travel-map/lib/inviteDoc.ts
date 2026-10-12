import type { KnownCodes } from "./data";
import type { CityRow } from "./cities";
import { resolveInvite, type DecodeResult, type Invite, type RawInvite } from "./invite";
import { isCityStop } from "./stops";

/*
 * An invite as a text document, for writing by hand (or by a language model) and pasting into the trip
 * planner's source view:
 *
 *   ---
 *   to:
 *     - Kyoto@JPN
 *     - KOR
 *   from: Kim
 *   email:
 *   date: 2027-03-28
 *   end: 2027-04-08
 *   ---
 *
 *   The message, in Markdown.
 *
 * The fields are the link's (lib/invite.ts), one per line; the message is everything after them.
 */
export const DOC_FIELDS = ["to", "from", "email", "date", "end"] as const;
type DocField = (typeof DOC_FIELDS)[number];

/** The document for an invite. Every field is written, empty or not, so it's there to fill in. `stops` may be empty. */
export function inviteDoc(i: Invite): string {
  const field = (name: DocField, value = "") => `${name}:${value && ` ${value}`}`;
  return [
    "---",
    "to:",
    ...i.stops.map((s) => `  - ${isCityStop(s) ? `${s.n}@${s.c}` : s}`),
    field("from", i.from),
    field("email", i.email),
    field("date", i.date),
    field("end", i.end),
    "---",
    "",
    i.message ?? "",
    "",
  ].join("\n");
}

/** A chat often hands the document over inside a code block: take it out. */
function unfence(text: string): string {
  const t = text.replace(/^\uFEFF/, "").trim();
  const fenced = /^```[^\n]*\n([\s\S]*)\n```$/.exec(t);
  return fenced ? fenced[1] : t;
}

function unquote(s: string): string {
  const t = s.trim();
  return t.length >= 2 && (t[0] === '"' || t[0] === "'") && t.at(-1) === t[0] ? t.slice(1, -1).trim() : t;
}

/**
 * Read an invite document. Lenient about what models tend to write: quoted values, the places on one line
 * (`to: Kyoto@JPN, KOR`) and a code fence around it all. Places that can't be found are skipped and listed
 * in `unknown`, and the invite may come back without stops; anything else wrong is an error naming the field.
 */
export async function parseInviteDoc(text: string, known: KnownCodes, loadCities: () => Promise<CityRow[]>): Promise<DecodeResult> {
  const fail = (field: string, message: string): DecodeResult => ({ ok: false, error: { field, message } });
  const lines = unfence(text).split(/\r?\n/);
  if (lines[0].trim() !== "---") return fail("---", "is missing: start with a line of ---, then the fields, then another line of ---");
  const close = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (close === -1) return fail("---", "is missing after the fields: close them with a line of ---");

  const raw: RawInvite = { to: [] };
  const seen = new Set<string>();
  let inTo = false;
  for (const line of lines.slice(1, close)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("-")) {
      if (!inTo) return fail(t, "is a list item, and only to takes a list");
      const stop = unquote(t.slice(1));
      if (stop) raw.to.push(stop);
      continue;
    }
    const colon = t.indexOf(":");
    const key = (colon === -1 ? t : t.slice(0, colon)).trim().toLowerCase();
    if (!(DOC_FIELDS as readonly string[]).includes(key)) {
      return fail(key, `isn't a field. The fields are ${DOC_FIELDS.join(", ")}, each on its own line as name: value. The message goes after the second ---`);
    }
    if (colon === -1) return fail(key, `has no value: write ${key}: …`);
    if (seen.has(key)) return fail(key, "appears more than once");
    seen.add(key);
    inTo = key === "to";
    const value = unquote(t.slice(colon + 1));
    if (key === "to") raw.to.push(...value.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean));
    else if (value) raw[key as Exclude<DocField, "to">] = value;
  }
  const message = lines.slice(close + 1).join("\n").trim();
  if (message) raw.msg = message;

  const r = await resolveInvite(raw, known, loadCities);
  return !r.ok && r.error.field === "msg" ? fail("message", r.error.message) : r;
}
