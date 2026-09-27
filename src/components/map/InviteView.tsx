import { useEffect, useState } from "preact/hooks";
import { addWants, type ISO3 } from "@lib/map/data";
import type { Invite } from "@lib/map/invite";
import { countryName } from "@lib/map/meta";
import type { ColorKey } from "@lib/map/stats";
import { createStore } from "@lib/map/storage";
import { cn } from "@lib/utils";
import { useMapView } from "./useMapView";
import { Postcard } from "./Postcard";
import { placeList } from "./format";
import { btn, container, mapBox, overlay } from "./ui";

type Added = { added: ISO3[]; saved: boolean };

export function InviteView({ invite, unknown }: { invite: Invite; unknown: ISO3[] }) {
  const { ref, view, error } = useMapView({ globe: true });
  const [phase, setPhase] = useState<"intro" | "postcard">("intro");
  const [stop, setStop] = useState<number | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const places = placeList(invite.stops);
  const headline = invite.from ? `${invite.from} says: let's visit ${places}!` : `Let's visit ${places}!`;

  useEffect(() => {
    if (!view) return;
    let cancelled = false;
    const colors: Record<ISO3, ColorKey> = Object.fromEntries(invite.stops.map((iso) => [iso, "stop" as const]));
    void view.setCountryColors(colors);
    void view.setArcs(invite.stops);
    // Tour every stop in order, then show the postcard.
    view
      .globeIntro(invite.stops, { onStop: (i) => !cancelled && setStop(i) })
      .then(() => !cancelled && setPhase("postcard"));
    return () => { cancelled = true; };
  }, [view]);

  useEffect(() => {
    if (error) setPhase("postcard"); // no WebGL: skip straight to the card
  }, [error]);

  function addToMyMap() {
    const store = createStore();
    // Record when the trip is and who it's with, straight from the invite.
    const result = addWants(store.load(), invite.stops, {
      year: invite.date ? Number(invite.date.slice(0, 4)) : undefined,
      note: invite.from ? `Travel with ${invite.from}` : undefined,
    });
    if (result.added.length) store.save(result.data);
    setAdded({ added: result.added, saved: store.isPersistent() });
  }

  return (
    <div class="space-y-6">
      <div class="relative">
        {error ? <p class={cn(container, "py-8")}>{error}</p> : <div ref={ref} class={mapBox} />}
        <h1
          class={cn(
            "pointer-events-none absolute inset-x-0 top-6 px-4 text-center text-2xl font-semibold text-black dark:text-white drop-shadow transition-opacity duration-700 sm:text-3xl",
            phase === "postcard" && !error && "opacity-0",
          )}
        >
          {headline}
        </h1>
        {phase === "intro" && stop !== null && invite.stops.length > 1 && (
          <p class={cn(overlay, "pointer-events-none absolute bottom-3 left-3 px-3 py-1.5 text-sm text-black dark:text-white")} aria-live="polite">
            Stop {stop + 1} of {invite.stops.length} · {countryName(invite.stops[stop])}
          </p>
        )}
      </div>

      <div class={cn(container, "space-y-4")}>
        {unknown.length > 0 && <p class="text-sm text-amber-600 dark:text-amber-400">Some places in this invite weren't recognized and were skipped.</p>}

        {phase === "postcard" && (
          <>
            <h2 class="text-xl font-semibold text-black dark:text-white">{headline}</h2>
            <Postcard invite={invite} />
            <div class="flex flex-wrap items-center gap-2 text-sm">
              {added ? (
                <p role="status">
                  {added.added.length
                    ? `Added ${placeList(added.added)} to your map as "Want to go".`
                    : "These places are already on your map."}
                  {!added.saved && " Your browser is blocking storage, so this won't be kept."}
                </p>
              ) : (
                <button type="button" class={btn} onClick={addToMyMap}>
                  📌 Add to my map as "Want to go"
                </button>
              )}
              <a class={btn} href="/projects/map">Open my map</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
