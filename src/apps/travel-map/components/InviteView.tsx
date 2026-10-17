import { useEffect, useRef, useState } from "preact/hooks";
import { googleCalendarUrl } from "@apps/travel-map/lib/calendar";
import type { Invite } from "@apps/travel-map/lib/invite";
import type { ColorKey } from "@apps/travel-map/lib/stats";
import { createStore } from "@apps/travel-map/lib/storage";
import { addStops, isCityStop, isRegionStop, outlinedCountries, stopList, stopName, type Stop } from "@apps/travel-map/lib/stops";
import { cn } from "@lib/utils";
import { useMapView } from "./useMapView";
import { Postcard } from "./Postcard";
import { btn, MY_MAP_URL, container, mapBox, overlay } from "./ui";

type Added = { added: string[]; saved: boolean };

/** Countries and states on the trip get the trip colour; cities get a dot. */
function tripColors(stops: Stop[]) {
  const countries: Record<string, ColorKey> = {};
  const regions: Record<string, ColorKey> = {};
  for (const stop of stops) {
    if (isCityStop(stop)) continue;
    (isRegionStop(stop) ? regions : countries)[stop] = "stop";
  }
  return { countries, regions };
}

/**
 * "intro": the globe tours the stops. "focus": the postcard sits over the dimmed map.
 * "docked": the postcard below the map, which is free to explore.
 */
type Phase = "intro" | "focus" | "docked";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function InviteView({ invite, unknown }: { invite: Invite; unknown: string[] }) {
  const { ref, view, error } = useMapView({ globe: true });
  // With reduced motion there's no tour: the postcard is there from the start.
  const [phase, setPhase] = useState<Phase>(() => (reducedMotion() ? "focus" : "intro"));
  const [stop, setStop] = useState<number | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const focusRef = useRef<HTMLElement>(null);
  const dockedRef = useRef<HTMLElement>(null);
  const places = stopList(invite.stops);
  const headline = invite.from ? `${invite.from} says: let's visit ${places}!` : `Let's visit ${places}!`;
  const calendarUrl = googleCalendarUrl(invite, window.location.href);

  useEffect(() => {
    if (!view) return;
    let cancelled = false;
    const { countries, regions } = tripColors(invite.stops);
    void view.setCountryColors(countries);
    void view.setRegionColors(regions);
    void view.setCountryOutlines(outlinedCountries(invite.stops));
    void view.setCityStops(invite.stops.filter(isCityStop));
    void view.setArcs(invite.stops);
    if (reducedMotion()) return view.skipIntro(invite.stops); // no tour: jump to where it would end
    // Tour every stop in order, then bring up the postcard (unless Skip already did).
    view
      .globeIntro(invite.stops, { legs: invite.legs, onStop: (i) => !cancelled && setStop(i) })
      .then(() => !cancelled && setPhase((p) => (p === "intro" ? "focus" : p)));
    return () => { cancelled = true; };
  }, [view]);

  useEffect(() => {
    if (error) setPhase("docked"); // no WebGL: no map to put the card over
  }, [error]);

  useEffect(() => {
    if (phase === "focus") {
      focusRef.current?.focus();
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && explore();
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [phase]);

  function skip() {
    view?.skipIntro(invite.stops);
    setPhase("focus");
  }

  /** Send the card down below the map and hand focus back to the page. */
  function explore() {
    setPhase("docked");
    requestAnimationFrame(() => dockedRef.current?.focus({ preventScroll: true }));
  }

  function addToMyMap() {
    const store = createStore();
    // Record when the trip is and who it's with, straight from the invite.
    const result = addStops(store.load(), invite.stops, {
      year: invite.date ? Number(invite.date.slice(0, 4)) : undefined,
      note: invite.from ? `Travel with ${invite.from}` : undefined,
    });
    if (result.added.length) store.save(result.data);
    setAdded({ added: result.added, saved: store.isPersistent() });
  }

  /** The card's contents, the same over the map and below it. */
  const postcard = (focused: boolean) => (
    <>
      <h2 id={focused ? "postcard-title" : undefined} class="text-xl font-semibold text-black dark:text-white">{headline}</h2>
      <Postcard invite={invite} />
      <div class="flex flex-wrap items-center gap-2 text-sm">
        {focused && (
          <button type="button" class={cn(btn, "font-semibold text-black dark:text-white")} onClick={explore}>
            🗺 Explore the map
          </button>
        )}
        {calendarUrl && (
          <a class={btn} href={calendarUrl} target="_blank" rel="noopener noreferrer">
            📅 Add to Google Calendar
          </a>
        )}
        {added ? (
          <p role="status">
            {added.added.length
              ? `Added ${stopList(added.added)} to your map as "Want to go".`
              : "These places are already on your map."}
            {!added.saved && " Your browser is blocking storage, so this won't be kept."}
          </p>
        ) : (
          <button type="button" class={btn} onClick={addToMyMap}>
            📌 Add to my map as "Want to go"
          </button>
        )}
        <a class={btn} href={MY_MAP_URL}>Open my map</a>
      </div>
      {calendarUrl && invite.email && (
        <p class="text-xs">Saving the event in Google Calendar will offer to send {invite.from ?? "the inviter"} an invitation.</p>
      )}
    </>
  );

  return (
    <div class="space-y-6">
      <div class="relative">
        {error ? <p class={cn(container, "py-8")}>{error}</p> : <div ref={ref} class={mapBox} />}
        <h1
          class={cn(
            "pointer-events-none absolute inset-x-0 top-6 px-4 text-center text-2xl font-semibold text-black dark:text-white drop-shadow transition-opacity duration-700 sm:text-3xl",
            phase !== "intro" && !error && "opacity-0",
          )}
        >
          {headline}
        </h1>
        {phase === "intro" && (
          <div class="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-sm text-black dark:text-white">
            <button type="button" class={cn(btn, overlay, "text-black dark:text-white")} onClick={skip}>
              Skip ⏭
            </button>
            {stop !== null && invite.stops.length > 1 && (
              <p class={cn(overlay, "pointer-events-none px-3 py-1.5")} aria-live="polite">
                Stop {stop + 1} of {invite.stops.length} · {stopName(invite.stops[stop])}
              </p>
            )}
          </div>
        )}
        {phase === "focus" && !error && (
          <div class="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-6">
            {/* The dimmed backdrop: a click on it dismisses the card, like "Explore the map". */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close the postcard and explore the map"
              class="absolute inset-0 cursor-default bg-black/40 motion-safe:animate-[postcard-fade_300ms_ease-out]"
              onClick={explore}
            />
            <section
              ref={focusRef}
              role="dialog"
              aria-labelledby="postcard-title"
              tabIndex={-1}
              class={cn(overlay, "relative max-h-full w-full max-w-xl space-y-4 overflow-y-auto overscroll-contain p-4 focus:outline-none sm:p-5 motion-safe:animate-[postcard-in_400ms_ease-out]")}
            >
              {postcard(true)}
            </section>
          </div>
        )}
      </div>

      <div class={cn(container, "space-y-4")}>
        {unknown.length > 0 && <p class="text-sm text-amber-600 dark:text-amber-400">Some places in this invite weren't recognized and were skipped.</p>}

        {phase === "docked" && (
          <section
            ref={dockedRef}
            tabIndex={-1}
            aria-label="Postcard"
            class="space-y-4 focus:outline-none motion-safe:animate-[postcard-dock_500ms_ease-out]"
          >
            {postcard(false)}
          </section>
        )}
      </div>
    </div>
  );
}
