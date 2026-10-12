import { useState } from "preact/hooks";
import { isEmptyData, type TravelData } from "@apps/travel-map/lib/data";
import { sharedMapUrl } from "@apps/travel-map/lib/sharedMap";
import { cn } from "@lib/utils";
import { shareOrCopy } from "./share";
import { btn, card, input } from "./ui";

/** "Share map": a link that carries a snapshot of the map. */
export function ShareMap({ data }: { data: TravelData }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState(false);
  const [status, setStatus] = useState("");
  const empty = isEmptyData(data);

  async function share() {
    const url = sharedMapUrl(window.location.origin, data, { name, notes });
    const r = await shareOrCopy(url, name.trim() ? `${name.trim()}'s travel map` : "My travel map");
    const long = url.length > 2000 ? " It's a long link, so some chat apps may cut it; try leaving the notes out." : "";
    setStatus((r === "copied" ? "Link copied!" : r === "shared" ? "Shared!" : "Couldn't share the link.") + long);
  }

  return (
    <section class={cn(card, "space-y-3 text-sm")} aria-labelledby="share-map-title">
      <h2 id="share-map-title" class="text-lg font-semibold text-black dark:text-white">Share map</h2>
      <p>
        Send friends a link to your map, so they can see where you've been and compare it with theirs. The link is a
        snapshot: if you change your map later, share a new link.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block min-w-48 flex-1 space-y-1">
          <span>Your name (optional)</span>
          <input class={input} maxLength={80} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="flex items-center gap-2 py-1">
          <input type="checkbox" checked={notes} onChange={(e) => setNotes((e.currentTarget as HTMLInputElement).checked)} />
          Include my notes
        </label>
        <button type="button" class={cn(btn, "font-semibold text-black dark:text-white")} disabled={empty} onClick={share}>
          🔗 Share map
        </button>
      </div>
      {empty && <p>Mark a few places first.</p>}
      <p role="status">{status}</p>
    </section>
  );
}
