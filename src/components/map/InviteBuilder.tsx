import { useMemo, useState } from "preact/hooks";
import { emailSchema, inviteUrl, MAX_MESSAGE, MAX_STOPS, type Invite } from "@lib/map/invite";
import { placeToStop } from "@lib/map/places";
import { stopKey, stopList, stopName, type Stop } from "@lib/map/stops";
import { cn } from "@lib/utils";
import { PlaceSearch } from "./PlaceSearch";
import { imageStats, MAX_MD_IMAGES } from "./markdown";
import { Postcard } from "./Postcard";
import { shareOrCopy } from "./share";
import { btn, card, input } from "./ui";

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
  const emailOk = emailSchema.safeParse(email.trim()).success;

  const images = useMemo(() => imageStats(message), [message]);
  const skipped = images.total - images.shown;

  const invite = useMemo<Invite | null>(() => {
    if (stops.length === 0) return null;
    const inv: Invite = { v: 1, stops };
    if (from.trim()) inv.from = from.trim().slice(0, 80);
    if (message.trim()) inv.message = message.trim();
    if (date) inv.date = date;
    if (date && end >= date) inv.end = end;
    if (emailOk) inv.email = email.trim();
    return inv;
  }, [stops, from, message, date, end, email]);
  const url = invite ? inviteUrl(window.location.origin, invite) : "";

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
        <button type="button" class={btn} onClick={onClose} aria-label="Close trip planner">✕</button>
      </div>

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
        <input class={input} maxLength={80} value={from} onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)} />
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

      {url && (
        <div class="space-y-2 text-sm">
          <input class={input} readOnly value={url} aria-label="Invite link" onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
          {url.length > 2000 && <p class="text-amber-600 dark:text-amber-400">This link is long; some chat apps may cut it. Try a shorter message or fewer images.</p>}
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
          <p role="status">{status}</p>
        </div>
      )}
    </section>
  );
}
