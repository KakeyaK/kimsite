import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import { loadCities } from "@apps/travel-map/lib/cities";
import {
  emailSchema, encodeInvite, inviteUrl, MAX_FROM, MAX_MESSAGE, MAX_STOPS, MAX_TITLE, tripRoute, type Invite, type InviteError, type RoutePoint,
} from "@apps/travel-map/lib/invite";
import { inviteDoc, parseInviteDoc } from "@apps/travel-map/lib/inviteDoc";
import { KNOWN_CODES } from "@apps/travel-map/lib/meta";
import { placeToStop } from "@apps/travel-map/lib/places";
import { shortenInvite } from "@apps/travel-map/lib/shortLink";
import { MODE_EMOJI, MODES, stopKey, stopList, stopName, type Mode, type Stop } from "@apps/travel-map/lib/stops";
import { cn } from "@lib/utils";
import { PlaceSearch } from "./PlaceSearch";
import { imageStats, MAX_MD_IMAGES } from "./markdown";
import { Postcard } from "./Postcard";
import { shareOrCopy } from "./share";
import { btn, btnActive, card, input } from "./ui";

/**
 * A leg's mode is kept by the two stops it joins, so it follows them when stops are moved, and a leg
 * that no longer exists (a stop removed, or moved away) is simply not used.
 */
const legKey = (a: Stop, b: Stop) => `${stopKey(a)} > ${stopKey(b)}`;

/** A note is kept by its place and role the same way: the start and the return may be the same city. */
const noteKey = (p: Pick<RoutePoint, "stop" | "role">) => `${p.role}:${stopKey(p.stop)}`;

const modesOf = (i: Invite): Record<string, Mode> => {
  const route = tripRoute(i);
  return Object.fromEntries(route.slice(1).flatMap((p, k) => (p.by ? [[legKey(route[k].stop, p.stop), p.by]] : [])));
};
const notesOf = (i: Invite): Record<string, string> =>
  Object.fromEntries(tripRoute(i).flatMap((p) => (p.note ? [[noteKey(p), p.note]] : [])));

interface Props {
  /** Controlled so the page's single "Plan a trip" button can add the selected place. */
  stops: Stop[];
  onStopsChange: (stops: Stop[]) => void;
  onClose: () => void;
  /** A saved invite to edit (its stops are in `stops`): the form starts with it, and with its link until it changes. */
  initial?: { invite: Invite; url: string };
  /** Each link made, to save the invite with; returns false when it couldn't be saved. */
  onLink: (invite: Invite, encoded: string, url: string) => boolean;
}

export function InviteBuilder({ stops, onStopsChange, onClose, initial, onLink }: Props) {
  const [title, setTitle] = useState(initial?.invite.title ?? "");
  const [start, setStart] = useState<Stop | null>(initial?.invite.start ?? null);
  const [finish, setFinish] = useState<Stop | null>(initial?.invite.finish ?? null);
  const [notes, setNotes] = useState<Record<string, string>>(() => (initial ? notesOf(initial.invite) : {}));
  /** Places whose note box was opened (one with a note is always open). */
  const [noteOpen, setNoteOpen] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState(initial?.invite.from ?? "");
  const [message, setMessage] = useState(initial?.invite.message ?? "");
  const [date, setDate] = useState(initial?.invite.date ?? "");
  const [end, setEnd] = useState(initial?.invite.end ?? "");
  const [email, setEmail] = useState(initial?.invite.email ?? "");
  const [modes, setModes] = useState<Record<string, Mode>>(() => (initial ? modesOf(initial.invite) : {}));
  const [status, setStatus] = useState("");
  /** The short link made for `invite`; it stops applying as soon as the invite changes. */
  const [link, setLink] = useState<{ invite: string; url: string } | null>(() =>
    initial ? { invite: encodeInvite(initial.invite), url: initial.url } : null,
  );
  const [creating, setCreating] = useState(false);
  /** The invite as a document (lib/inviteDoc.ts) while the source view is open; null in the form. */
  const [source, setSource] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<InviteError | null>(null);
  /** Places in the source that couldn't be found, so they aren't in the form. */
  const [skippedPlaces, setSkippedPlaces] = useState<string[]>([]);
  const emailOk = emailSchema.safeParse(email.trim()).success;

  /** The route as the form has it: where it leaves from, the stops, where it comes back to. */
  const points = useMemo(
    () => [
      ...(start ? [{ stop: start, role: "start" as const }] : []),
      ...stops.map((stop) => ({ stop, role: "stop" as const })),
      ...(finish ? [{ stop: finish, role: "finish" as const }] : []),
    ],
    [start, stops, finish],
  );

  /** What the form holds, stops or not; it's an invite once it has a stop. */
  const draft = useMemo<Invite>(() => {
    const inv: Invite = { stops };
    if (start) inv.start = start;
    if (finish) inv.finish = finish;
    const legs = points.slice(1).map((p, i) => modes[legKey(points[i].stop, p.stop)] ?? null);
    if (legs.some(Boolean)) inv.legs = legs;
    const placeNotes = points.map((p) => notes[noteKey(p)]?.trim() || null);
    if (placeNotes.some(Boolean)) inv.notes = placeNotes;
    if (title.trim()) inv.title = title.trim().slice(0, MAX_TITLE);
    if (from.trim()) inv.from = from.trim().slice(0, MAX_FROM);
    if (message.trim()) inv.message = message.trim();
    if (date) inv.date = date;
    if (date && end >= date) inv.end = end;
    if (emailOk) inv.email = email.trim();
    return inv;
  }, [points, stops, start, finish, modes, notes, title, from, message, date, end, email]);

  const texts = [draft.message ?? "", ...(draft.notes ?? []).map((n) => n ?? "")];
  /** The message and the notes share one limit, so the link stays one the shortener takes. */
  const textLength = texts.reduce((n, t) => n + t.length, 0);
  const skipped = useMemo(() => texts.reduce((n, t) => {
    const { total, shown } = imageStats(t);
    return n + total - shown;
  }, 0), [texts.join("\u0000")]);
  const invite = stops.length && textLength <= MAX_MESSAGE ? draft : null;
  const encoded = invite ? encodeInvite(invite) : "";
  /** The link to share, once made for the invite as it is now. Visitors only ever see short links. */
  const url = link && link.invite === encoded ? link.url : "";

  async function createLink() {
    if (!invite) return;
    const current = encoded;
    setCreating(true);
    setStatus("");
    const short = await shortenInvite(current);
    setCreating(false);
    // On the dev server, keep testing with the full link (the shortener may not be deployed, or be offline).
    const url = short ?? (import.meta.env.DEV ? inviteUrl(window.location.origin, invite) : null);
    if (!url) return setStatus("Couldn't create the link. Check your connection and try again.");
    setLink({ invite: current, url });
    const saved = onLink(invite, current, url);
    setStatus(
      [
        !short && "Couldn't reach the shortener, so this is the full link (dev server only).",
        saved ? "Saved in this browser, under Your invites, to edit later." : "Couldn't save the invite in this browser, so keep the link.",
      ].filter(Boolean).join(" "),
    );
  }

  function openSource() {
    setSource(inviteDoc(draft));
    setSourceError(null);
  }

  /** Back to the form, filled from the source; stays in the source when it can't be read. */
  async function openForm() {
    if (source === null) return;
    const r = await parseInviteDoc(source, KNOWN_CODES, loadCities);
    if (!r.ok) return setSourceError(r.error);
    onStopsChange(r.value.stops);
    setStart(r.value.start ?? null);
    setFinish(r.value.finish ?? null);
    setModes(modesOf(r.value));
    setNotes(notesOf(r.value));
    setTitle(r.value.title ?? "");
    setFrom(r.value.from ?? "");
    setEmail(r.value.email ?? "");
    setDate(r.value.date ?? "");
    setEnd(r.value.end ?? "");
    setMessage(r.value.message ?? "");
    setSkippedPlaces(r.unknown);
    setSource(null);
  }

  function toggleNote(key: string) {
    const next = new Set(noteOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setNoteOpen(next);
  }

  /** How you get to `p` from the point before it. */
  function modeSelect(prev: Stop, p: Stop) {
    const key = legKey(prev, p);
    return (
      <select
        class={cn(btn, "bg-transparent dark:[color-scheme:dark]")}
        aria-label={`How you get to ${stopName(p)}`}
        title={`How you get to ${stopName(p)} from ${stopName(prev)} (optional)`}
        value={modes[key] ?? ""}
        onChange={(e) => {
          const next = { ...modes };
          const mode = (e.currentTarget as HTMLSelectElement).value as Mode | "";
          if (mode) next[key] = mode;
          else delete next[key];
          setModes(next);
        }}
      >
        <option value="">Getting there…</option>
        {MODES.map((m) => <option key={m} value={m}>{MODE_EMOJI[m]} {m[0].toUpperCase() + m.slice(1)}</option>)}
      </select>
    );
  }

  /** A point on the route: its name, how you get there, its controls, and its note. */
  function routeRow(i: number, label: string, controls: ComponentChildren, onRemove: () => void) {
    const p = points[i];
    const name = stopName(p.stop);
    const key = noteKey(p);
    const open = noteOpen.has(key) || Boolean(notes[key]);
    return (
      <li key={key} class="space-y-1">
        <div class="flex items-center gap-2">
          <span class={cn("flex-1 text-black dark:text-white", p.role !== "stop" && "italic")}>{label}</span>
          {i > 0 && modeSelect(points[i - 1].stop, p.stop)}
          {controls}
          <button
            type="button"
            class={cn(btn, open && btnActive)}
            onClick={() => toggleNote(key)}
            disabled={Boolean(notes[key])}
            aria-label={`Note on ${name}`}
            aria-expanded={open}
            title={`A note on ${name}, shown when the map gets there`}
          >
            📝
          </button>
          <button type="button" class={btn} onClick={onRemove} aria-label={`Remove ${name}`}>✕</button>
        </div>
        {open && (
          <textarea
            class={cn(input, "font-mono")}
            rows={4}
            aria-label={`Note on ${name}`}
            placeholder={`What's in ${name}? Markdown and images work, like the message.`}
            value={notes[key] ?? ""}
            onInput={(e) => setNotes({ ...notes, [key]: (e.currentTarget as HTMLTextAreaElement).value })}
          />
        )}
      </li>
    );
  }

  function move(i: number, delta: number) {
    const next = [...stops];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    onStopsChange(next);
  }

  return (
    <section class={cn(card, "space-y-4")} aria-label="Plan a trip">
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-lg font-semibold text-black dark:text-white">
          {stops.length ? `Trip to ${stopList(stops)}` : "Plan a trip"}
        </h2>
        <div class="flex shrink-0 gap-1">
          <button
            type="button"
            class={cn(btn, "flex items-center", source !== null && btnActive)}
            aria-pressed={source !== null}
            aria-label="Edit as source"
            title={source === null ? "Edit as source" : "Back to the form"}
            onClick={source === null ? openSource : openForm}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
              <path d="m16 18 6-6-6-6" />
              <path d="m8 6-6 6 6 6" />
              <path d="m14.5 4-5 16" />
            </svg>
          </button>
          <button type="button" class={btn} onClick={onClose} aria-label="Close trip planner">✕</button>
        </div>
      </div>

      {source !== null ? (
        <div class="space-y-2 text-sm">
          <textarea
            class={cn(input, "font-mono")}
            rows={18}
            spellcheck={false}
            aria-label="Invite source"
            value={source}
            onInput={(e) => setSource((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <p class="text-xs">
            The whole invite as text: the fields between the <code>---</code> lines, then the message in Markdown. A place is a
            country code (<code>JPN</code>), a state code (<code>BR-BA</code>) or a city written <code>Kyoto@JPN</code>, and may
            end with how you get there from the place before (<code>KOR by train</code>: {MODES.join(", ")}). Edit it,
            or paste one written elsewhere, then go back to the form.
          </p>
          {sourceError && (
            <p role="alert" class="text-rose-600 dark:text-rose-400">
              <code>{sourceError.field}</code> {sourceError.message}
            </p>
          )}
          <button type="button" class={cn(btn, "font-semibold text-black dark:text-white")} onClick={openForm}>Back to the form</button>
        </div>
      ) : (
        <>
          {skippedPlaces.length > 0 && (
            <p role="status" class="text-sm text-amber-600 dark:text-amber-400">
              Couldn't find {skippedPlaces.join(", ")}, so {skippedPlaces.length > 1 ? "they were" : "it was"} left out.
            </p>
          )}
          {stops.length === 0 && <p class="text-sm">Add the places you want to go.</p>}
          <ol class="space-y-2 text-sm">
            {points.map((p, i) => {
              const name = stopName(p.stop);
              if (p.role === "start") return routeRow(i, `Leaving from ${name}`, null, () => setStart(null));
              if (p.role === "finish") return null; // below the stop search: new stops go before it
              const k = stops.indexOf(p.stop);
              return routeRow(
                i,
                `${k + 1}. ${name}`,
                <>
                  <button type="button" class={btn} disabled={k === 0} onClick={() => move(k, -1)} aria-label={`Move ${name} earlier`}>↑</button>
                  <button type="button" class={btn} disabled={k === stops.length - 1} onClick={() => move(k, 1)} aria-label={`Move ${name} later`}>↓</button>
                </>,
                () => onStopsChange(stops.filter((_, j) => j !== k)),
              );
            })}
          </ol>
          {stops.length < MAX_STOPS && (
            <PlaceSearch
              cities
              label="Add a stop"
              placeholder="Add a city, state or country…"
              onPick={(place) => {
                const stop = placeToStop(place);
                if (!stops.some((s) => stopKey(s) === stopKey(stop))) onStopsChange([...stops, stop]);
              }}
            />
          )}
          {finish && (
            <ul class="text-sm">{routeRow(points.length - 1, `Back to ${stopName(finish)}`, null, () => setFinish(null))}</ul>
          )}
          {(!start || !finish) && (
            <div class="space-y-2 text-sm">
              <p class="text-xs">
                Where does the trip leave from and come back to? Optional: they're on the route and the map, but not destinations.
              </p>
              <div class="flex flex-wrap items-center gap-2">
                {!start && (
                  <PlaceSearch class="min-w-48 flex-1" cities label="Leaving from" placeholder="Leaving from…" onPick={(place) => setStart(placeToStop(place))} />
                )}
                {!finish && (
                  <PlaceSearch class="min-w-48 flex-1" cities label="Coming back to" placeholder="Coming back to…" onPick={(place) => setFinish(placeToStop(place))} />
                )}
                {start && !finish && (
                  <button type="button" class={btn} onClick={() => setFinish(start)}>↩ Back to {stopName(start)}</button>
                )}
              </div>
            </div>
          )}

          <label class="block space-y-1 text-sm">
            <span>From (your name)</span>
            <input class={input} maxLength={MAX_FROM} value={from} onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <label class="block space-y-1">
              <span>Start date (optional)</span>
              <input class={input} type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
            </label>
            <label class="block space-y-1">
              <span>End date</span>
              <input class={input} type="date" min={date} disabled={!date} value={end} onInput={(e) => setEnd((e.currentTarget as HTMLInputElement).value)} />
            </label>
          </div>
          {date && end && end < date && <p class="text-sm text-amber-600 dark:text-amber-400">The end date is before the start, so it's left out.</p>}
          <label class="block space-y-1 text-sm">
            <span>Your email (optional)</span>
            <input class={input} type="email" autoComplete="email" maxLength={254} value={email} onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)} />
            <span class="block text-xs">
              Lets your friend's "Add to Google Calendar" invite you to the event. Anyone with the link can see it.
            </span>
            {email.trim() && !emailOk && <span class="block text-amber-600 dark:text-amber-400">That doesn't look like an email, so it's left out.</span>}
          </label>
          <label class="block space-y-1 text-sm">
            <span>Title (optional)</span>
            <input
              class={input}
              maxLength={MAX_TITLE}
              placeholder={stops.length ? `Let's visit ${stopList(stops)}!` : "Let's explore Kyoto and Tokyo together"}
              value={title}
              onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span>Message</span>
            <textarea
              class={cn(input, "font-mono")}
              rows={6}
              maxLength={MAX_MESSAGE}
              placeholder={"Let's go! **Cherry blossoms** in April 🌸\n\n![Kyoto](https://example.com/kyoto.jpg)"}
              value={message}
              onInput={(e) => setMessage((e.currentTarget as HTMLTextAreaElement).value)}
            />
            <span class="block text-xs">
              The first thing your friend reads, so keep it short: what each place holds goes in its note (📝). Markdown works:
              **bold**, _italic_, lists, [links](https://…) and images with ![caption](https://…). Up to {MAX_MD_IMAGES} images in
              each, https links only.
            </span>
            {textLength > MAX_MESSAGE && (
              <span role="alert" class="block text-rose-600 dark:text-rose-400">
                The message and the notes are {textLength.toLocaleString("en")} characters together; the most is {MAX_MESSAGE.toLocaleString("en")}.
              </span>
            )}
            {skipped > 0 && (
              <span class="block text-amber-600 dark:text-amber-400">
                {skipped} image{skipped > 1 ? "s" : ""} won't show (not an https link, or over {MAX_MD_IMAGES}).
              </span>
            )}
          </label>

          {invite && (
            <div class="space-y-1">
              <p class="text-xs uppercase tracking-wide">Cover preview</p>
              <div class={cn(card, "bg-white/60 dark:bg-black/20")}>
                <Postcard invite={invite} editing />
              </div>
            </div>
          )}

          {invite && (
            <div class="space-y-2 text-sm">
              {url ? (
                <>
                  <input class={input} readOnly value={url} aria-label="Invite link" onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class={btn}
                      onClick={async () => {
                        const r = await shareOrCopy(url, `Trip to ${stopList(stops)}`);
                        setStatus(r === "copied" ? "Link copied!" : r === "shared" ? "Shared!" : "Couldn't share. Copy the link above.");
                      }}
                    >
                      Share link
                    </button>
                    <a class={btn} href={url} target="_blank" rel="noopener">Open invite</a>
                  </div>
                </>
              ) : (
                <>
                  {link && <p>You changed the invite, so it needs a new link. The old one still opens it as it was.</p>}
                  <button type="button" class={cn(btn, "font-semibold text-black dark:text-white")} disabled={creating} onClick={createLink}>
                    {creating ? "Creating link…" : "Create link"}
                  </button>
                </>
              )}
              <p role="status">{status}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
