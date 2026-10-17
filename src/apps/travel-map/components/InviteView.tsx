import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { PaddingOptions } from "maplibre-gl";
import { googleCalendarUrl } from "@apps/travel-map/lib/calendar";
import { tripRoute, type Invite, type RoutePoint } from "@apps/travel-map/lib/invite";
import type { ColorKey } from "@apps/travel-map/lib/stats";
import { createStore } from "@apps/travel-map/lib/storage";
import { addStops, isCityStop, isRegionStop, MODE_EMOJI, outlinedCountries, stopList, stopName, type Stop } from "@apps/travel-map/lib/stops";
import { cn } from "@lib/utils";
import { useMapView } from "./useMapView";
import { InviteText, Postcard, RouteLine } from "./Postcard";
import { btn, MY_MAP_URL, overlay } from "./ui";

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

/** What a point on the route is, above its name. */
function eyebrow(p: RoutePoint, stopNumber: number, stops: number): string {
  if (p.role === "start") return "Leaving from";
  if (p.role === "finish") return "Back to";
  return stops > 1 ? `Stop ${stopNumber} of ${stops}` : "The destination";
}

/** How you get to point i from the one before: "🚌 By bus from Paris". */
function arrival(route: RoutePoint[], i: number): string | null {
  if (i === 0) return null;
  const p = route[i];
  const from = stopName(route[i - 1].stop);
  return p.by ? `${MODE_EMOJI[p.by]} By ${p.by} from ${from}` : `From ${from}`;
}

const MD = 768; // Tailwind's md: the panel is a side column from here, a bottom sheet below

/**
 * A trip invite, told one place at a time over the map. Step -1 is the cover, 0 to n - 1 the points on the route (the
 * map travels to each), n the end, with what to do next. The map is live throughout.
 */
export function InviteView({ invite, unknown }: { invite: Invite; unknown: string[] }) {
  const { ref, view, error } = useMapView({ globe: true, cooperative: false });
  const route = useMemo(() => tripRoute(invite), [invite]);
  const n = route.length;
  const [step, setStep] = useState(-1);
  const shown = useRef<number | null>(null);
  /** On phones: the sheet pulled up to show more. */
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState<Added | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const calendarUrl = googleCalendarUrl(invite, window.location.href);
  const stops = route.filter((p) => p.role === "stop").length;

  /** Keep what the camera shows clear of the panel: beside it on wide screens, above it on phones. */
  function padding(): PaddingOptions {
    const panel = panelRef.current;
    if (!panel || error) return { top: 48, right: 48, bottom: 48, left: 48 };
    if (window.innerWidth >= MD) return { top: 64, right: 64, bottom: 64, left: panel.offsetWidth + 64 };
    return { top: 48, right: 32, bottom: panel.offsetHeight + 40, left: 32 };
  }

  /** Point the camera at the step: the whole route on the cover and at the end, the place otherwise. */
  function frame(to: number, from: number | null) {
    if (!view) return;
    if (to < 0 || to >= n) {
      void view.setActiveLeg(null);
      void view.showRoute(route.map((p) => p.stop), { padding: padding() });
      return;
    }
    void view.setActiveLeg(to > 0 ? to - 1 : null);
    // Moving on to the next place travels the leg; anything else (back, a jump) just flies there.
    const next = from === to - 1 && from >= 0;
    void view.travel(route[to].stop, { from: next ? route[from].stop : undefined, mode: route[to].by, padding: padding() });
  }

  useEffect(() => {
    if (!view) return;
    const destinations = route.filter((p) => p.role === "stop").map((p) => p.stop);
    const { countries, regions } = tripColors(destinations);
    void view.setCountryColors(countries);
    void view.setRegionColors(regions);
    void view.setCountryOutlines(outlinedCountries(destinations));
    void view.setCityStops(destinations.filter(isCityStop));
    void view.setEndpoints(route.filter((p) => p.role !== "stop").map((p) => p.stop));
    void view.setArcs(route.map((p) => p.stop));
  }, [view]);

  useEffect(() => {
    if (!view) return;
    frame(step, shown.current);
    shown.current = step;
  }, [view, step]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    // Not on arrival: focus goes to the place's name as you move through the trip, so screen readers follow along.
    if (shown.current !== null) (headingRef.current ?? document.getElementById("cover-title"))?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, n));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, -1));
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [n]);

  function addToMyMap() {
    const store = createStore();
    // Record when the trip is and who it's with, straight from the invite. Only destinations: not where it leaves from.
    const result = addStops(store.load(), invite.stops, {
      year: invite.date ? Number(invite.date.slice(0, 4)) : undefined,
      note: invite.from ? `Travel with ${invite.from}` : undefined,
    });
    if (result.added.length) store.save(result.data);
    setAdded({ added: result.added, saved: store.isPersistent() });
  }

  const primary = cn(btn, "font-semibold text-black dark:text-white");

  /** The cover, a place, or the end. */
  function body() {
    if (step < 0) {
      return (
        <Postcard invite={invite}>
          {unknown.length > 0 && <p class="text-sm text-amber-600 dark:text-amber-400">Some places in this invite weren't recognized and were skipped.</p>}
        </Postcard>
      );
    }
    if (step >= n) {
      return (
        <div class="space-y-4">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide">That's the trip</p>
            <h2 ref={headingRef} tabIndex={-1} class="text-2xl font-semibold text-black focus:outline-none dark:text-white">See you there? ✈️</h2>
            <RouteLine invite={invite} />
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            {calendarUrl && (
              <a class={btn} href={calendarUrl} target="_blank" rel="noopener noreferrer">📅 Add to Google Calendar</a>
            )}
            {!added && <button type="button" class={btn} onClick={addToMyMap}>📌 Add to my map as "Want to go"</button>}
            <a class={btn} href={MY_MAP_URL}>Open my map</a>
          </div>
          {added && (
            <p role="status" class="text-sm">
              {added.added.length ? `Added ${stopList(added.added)} to your map as "Want to go".` : "These places are already on your map."}
              {!added.saved && " Your browser is blocking storage, so this won't be kept."}
            </p>
          )}
          {calendarUrl && invite.email && (
            <p class="text-xs">Saving the event in Google Calendar will offer to send {invite.from ?? "the inviter"} an invitation.</p>
          )}
        </div>
      );
    }
    const p = route[step];
    const stopNumber = route.slice(0, step + 1).filter((q) => q.role === "stop").length;
    const how = arrival(route, step);
    return (
      <div class="space-y-4">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-wide">{eyebrow(p, stopNumber, stops)}</p>
          <h2 ref={headingRef} tabIndex={-1} class="text-2xl font-semibold text-black focus:outline-none dark:text-white">{stopName(p.stop)}</h2>
          {how && <p class="text-sm">{how}</p>}
        </div>
        {p.note && <InviteText text={p.note} />}
      </div>
    );
  }

  return (
    <div class={cn("relative", !error && "h-[calc(100dvh-5rem)] min-h-[480px]")}>
      {error ? <p class="mx-auto max-w-xl px-5 pb-4 text-sm">{error}</p> : (
        // MapLibre makes its container position: relative, so the wrapper is what fills the box.
        <div class="absolute inset-0 border-t border-black/15 dark:border-white/20"><div ref={ref} class="size-full" /></div>
      )}

      {step >= 0 && step < n && !error && (
        <button
          type="button"
          class={cn(btn, overlay, "absolute right-3 top-3 z-10 text-black dark:text-white")}
          onClick={() => frame(step, null)}
          title="Back to this place on the map"
        >
          ⌖ Recenter
        </button>
      )}

      <section
        ref={panelRef}
        aria-label="Trip invite"
        class={cn(
          "z-20 flex flex-col",
          error
            ? "relative mx-auto max-w-xl px-5"
            : cn(
              overlay,
              "absolute inset-x-0 bottom-0 rounded-b-none transition-[max-height] duration-300",
              expanded ? "max-h-[85%]" : "max-h-[50%]",
              "md:inset-x-auto md:bottom-auto md:left-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[26rem] md:rounded-b-lg lg:w-[30rem]",
            ),
        )}
      >
        {!error && (
          <button
            type="button"
            class="mx-auto mt-1.5 flex h-5 w-full items-center justify-center md:hidden"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Show less" : "Show more"}
            aria-expanded={expanded}
          >
            <span class="h-1 w-10 rounded-full bg-black/20 dark:bg-white/30" />
          </button>
        )}
        <div ref={bodyRef} class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1 md:p-5">
          {body()}
        </div>
        <nav class="flex items-center gap-2 border-t border-black/10 px-4 py-3 dark:border-white/10 md:px-5" aria-label="Trip steps">
          {step >= 0 && (
            <button type="button" class={btn} onClick={() => setStep(step - 1)} aria-label="Back">←</button>
          )}
          <ol class="flex flex-1 flex-wrap items-center justify-center gap-1.5">
            {route.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  class={cn(
                    "block size-2.5 rounded-full border border-[color:var(--map-stop)] transition-colors",
                    i <= step ? "bg-[color:var(--map-stop)]" : "bg-transparent",
                    i < step && "opacity-50",
                    p.role !== "stop" && "rounded-sm",
                  )}
                  onClick={() => setStep(i)}
                  aria-label={`${eyebrow(p, route.slice(0, i + 1).filter((q) => q.role === "stop").length, stops)}: ${stopName(p.stop)}`}
                  aria-current={i === step ? "step" : undefined}
                />
              </li>
            ))}
          </ol>
          {step < 0 ? (
            <button type="button" class={primary} onClick={() => setStep(0)}>See the trip →</button>
          ) : step < n ? (
            <button type="button" class={primary} onClick={() => setStep(step + 1)}>
              {step === n - 1 ? "Finish →" : `${stopName(route[step + 1].stop)} →`}
            </button>
          ) : (
            <button type="button" class={btn} onClick={() => setStep(-1)}>↺ Start over</button>
          )}
        </nav>
      </section>
    </div>
  );
}
