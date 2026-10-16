import { useMemo, useState } from "preact/hooks";
import { loadCities } from "@apps/travel-map/lib/cities";
import { emailSchema, encodeInvite, inviteUrl, MAX_FROM, MAX_MESSAGE, MAX_STOPS, type Invite, type InviteError } from "@apps/travel-map/lib/invite";
import { inviteDoc, parseInviteDoc } from "@apps/travel-map/lib/inviteDoc";
import { KNOWN_CODES } from "@apps/travel-map/lib/meta";
import { placeToStop } from "@apps/travel-map/lib/places";
import { shortenInvite } from "@apps/travel-map/lib/shortLink";
import { stopKey, stopList, stopName, type Stop } from "@apps/travel-map/lib/stops";
import { cn } from "@lib/utils";
import { PlaceSearch } from "./PlaceSearch";
import { imageStats, MAX_MD_IMAGES } from "./markdown";
import { Postcard } from "./Postcard";
import { shareOrCopy } from "./share";
import { btn, btnActive, card, input } from "./ui";

interface Props {
  /** Controlled so the page's single "Plan a trip" button can add the selected place. */
  stops: Stop[];
  onStopsChange: (stops: Stop[]) => void;
  onClose: () => void;
}

export function InviteBuilder({ stops, onStopsChange, onClose }: Props) {
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [end, setEnd] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  /** The short link made for `invite`; it stops applying as soon as the invite changes. */
  const [link, setLink] = useState<{ invite: string; url: string } | null>(null);
  const [creating, setCreating] = useState(false);
  /** The invite as a document (lib/inviteDoc.ts) while the source view is open; null in the form. */
  const [source, setSource] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<InviteError | null>(null);
  /** Places in the source that couldn't be found, so they aren't in the form. */
  const [skippedPlaces, setSkippedPlaces] = useState<string[]>([]);
  const emailOk = emailSchema.safeParse(email.trim()).success;

  const images = useMemo(() => imageStats(message), [message]);
  const skipped = images.total - images.shown;

  /** What the form holds, stops or not; it's an invite once it has a stop. */
  const draft = useMemo<Invite>(() => {
    const inv: Invite = { stops };
    if (from.trim()) inv.from = from.trim().slice(0, MAX_FROM);
    if (message.trim()) inv.message = message.trim();
    if (date) inv.date = date;
    if (date && end >= date) inv.end = end;
    if (emailOk) inv.email = email.trim();
    return inv;
  }, [stops, from, message, date, end, email]);
  const invite = stops.length ? draft : null;
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
    if (short) return setLink({ invite: current, url: short });
    // On the dev server, keep testing with the full link (the shortener may not be deployed, or be offline).
    if (import.meta.env.DEV) {
      setLink({ invite: current, url: inviteUrl(window.location.origin, invite) });
      return setStatus("Couldn't reach the shortener, so this is the full link (dev server only).");
    }
    setStatus("Couldn't create the link. Check your connection and try again.");
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
    setFrom(r.value.from ?? "");
    setEmail(r.value.email ?? "");
    setDate(r.value.date ?? "");
    setEnd(r.value.end ?? "");
    setMessage(r.value.message ?? "");
    setSkippedPlaces(r.unknown);
    setSource(null);
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
            country code (<code>JPN</code>), a state code (<code>BR-BA</code>) or a city written <code>Kyoto@JPN</code>. Edit it,
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
          <ol class="space-y-1 text-sm">
            {stops.map((stop, i) => {
              const name = stopName(stop);
              return (
                <li key={stopKey(stop)} class="flex items-center gap-2">
                  <span class="flex-1 text-black dark:text-white">{i + 1}. {name}</span>
                  <button type="button" class={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${name} earlier`}>↑</button>
                  <button type="button" class={btn} disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${name} later`}>↓</button>
                  <button type="button" class={btn} onClick={() => onStopsChange(stops.filter((_, j) => j !== i))} aria-label={`Remove ${name}`}>✕</button>
                </li>
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
              Markdown works: **bold**, _italic_, lists, [links](https://…) and images with ![caption](https://…). Up to {MAX_MD_IMAGES} images, https links only.
            </span>
            {skipped > 0 && (
              <span class="block text-amber-600 dark:text-amber-400">
                {skipped} image{skipped > 1 ? "s" : ""} won't show (not an https link, or over {MAX_MD_IMAGES}).
              </span>
            )}
          </label>

          {invite && (invite.message || invite.date) && (
            <div class="space-y-1">
              <p class="text-xs uppercase tracking-wide">Preview</p>
              <Postcard invite={invite} editing />
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
                  {link && <p>You changed the invite, so it needs a new link.</p>}
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
