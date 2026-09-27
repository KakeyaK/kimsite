import { useMemo, useState } from "preact/hooks";
import type { ISO3 } from "@lib/map/data";
import { inviteUrl, MAX_MESSAGE, MAX_STOPS, type Invite } from "@lib/map/invite";
import { countryName } from "@lib/map/meta";
import { cn } from "@lib/utils";
import { PlaceSearch } from "./PlaceSearch";
import { imageStats, MAX_MD_IMAGES } from "./markdown";
import { Postcard } from "./Postcard";
import { placeList } from "./format";
import { shareOrCopy } from "./share";
import { btn, card, input } from "./ui";

interface Props {
  /** Controlled so the page's single "Plan a trip" button can add the selected country. */
  stops: ISO3[];
  onStopsChange: (stops: ISO3[]) => void;
  onClose: () => void;
}

export function InviteBuilder({ stops, onStopsChange, onClose }: Props) {
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  const images = useMemo(() => imageStats(message), [message]);
  const skipped = images.total - images.shown;

  const invite = useMemo<Invite | null>(() => {
    if (stops.length === 0) return null;
    const inv: Invite = { v: 1, stops };
    if (from.trim()) inv.from = from.trim().slice(0, 80);
    if (message.trim()) inv.message = message.trim();
    if (date) inv.date = date;
    return inv;
  }, [stops, from, message, date]);
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
          {stops.length ? `Trip to ${placeList(stops)}` : "Plan a trip"}
        </h2>
        <button type="button" class={btn} onClick={onClose} aria-label="Close trip planner">✕</button>
      </div>

      {stops.length === 0 && <p class="text-sm">Add the places you want to go.</p>}
      <ol class="space-y-1 text-sm">
        {stops.map((iso, i) => (
          <li key={iso} class="flex items-center gap-2">
            <span class="flex-1 text-black dark:text-white">{i + 1}. {countryName(iso)}</span>
            <button type="button" class={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${countryName(iso)} earlier`}>↑</button>
            <button type="button" class={btn} disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${countryName(iso)} later`}>↓</button>
            <button type="button" class={btn} onClick={() => onStopsChange(stops.filter((s) => s !== iso))} aria-label={`Remove ${countryName(iso)}`}>✕</button>
          </li>
        ))}
      </ol>
      {stops.length < MAX_STOPS && (
        <PlaceSearch
          label="Add a stop"
          placeholder="Add a country…"
          onPick={({ iso }) => !stops.includes(iso) && onStopsChange([...stops, iso])}
        />
      )}

      <label class="block space-y-1 text-sm">
        <span>From (your name)</span>
        <input class={input} maxLength={80} value={from} onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="block space-y-1 text-sm">
        <span>When (optional)</span>
        <input class={input} type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
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
                const r = await shareOrCopy(url, `Trip to ${placeList(stops)}`);
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
