import { useEffect, useMemo, useState } from "preact/hooks";
import { isEmptyData, type TravelData } from "@apps/travel-map/lib/data";
import { atYear, regionColors, statusColors, yearRange } from "@apps/travel-map/lib/stats";
import { countryName, regionByCode } from "@apps/travel-map/lib/meta";
import type { PlaceRef } from "@apps/travel-map/lib/mapView";
import { describeOverlap, OVERLAP_KEYS, overlapColors, overlapKey, overlapLabels } from "@apps/travel-map/lib/overlap";
import { createStore } from "@apps/travel-map/lib/storage";
import { planTripUrl } from "@apps/travel-map/lib/stops";
import { cn } from "@lib/utils";
import { useMapView } from "./useMapView";
import { MapNotes } from "./MapNotes";
import { legendCorner, MapLegend, STATUS_LEGEND, type LegendItem } from "./MapLegend";
import { MyMapLink } from "./MyMapLink";
import { TimelineSlider } from "./TimelineSlider";
import { btn, container, mapBox, MY_MAP_URL, overlay, STATUS_LABEL } from "./ui";

interface Props {
  data: TravelData;
  /** Whose map this is ("Kim", or the name in a shared link); used in overlap mode. */
  owner: string;
}

/** Someone else's map, read-only: Kim's (bundled with the site) or one shared as a link. */
export default function MapViewer({ data, owner }: Props) {
  const { ref, view, error } = useMapView();
  const [year, setYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<PlaceRef | null>(null);
  const [overlap, setOverlap] = useState(false);
  /** The visitor's own map, to compare with; null when they haven't made one. */
  const mine = useMemo(() => {
    const d = createStore().load();
    return isEmptyData(d) ? null : d;
  }, []);
  const range = useMemo(() => yearRange(data), [data]);
  const legend = useMemo<LegendItem[]>(() => {
    if (!overlap || !mine) return STATUS_LEGEND;
    const label = overlapLabels(owner);
    return OVERLAP_KEYS.map((key) => [key, label[key]]);
  }, [overlap, mine, owner]);
  const shown = useMemo(() => (year === null || overlap ? data : atYear(data, year)), [data, year, overlap]);

  useEffect(() => {
    if (overlap && mine) {
      const { countries, regions } = overlapColors(data, mine);
      void view?.setCountryColors(countries);
      void view?.setRegionColors(regions);
    } else {
      void view?.setCountryColors(statusColors(shown));
      void view?.setRegionColors(regionColors(shown));
    }
  }, [view, shown, overlap, mine]);

  useEffect(() => {
    void view?.setSelected(selected);
  }, [view, selected]);

  useEffect(() => (view ? view.onPlaceClick(setSelected) : undefined), [view]);

  const entries = (d: TravelData) => (selected?.kind === "region" ? d.regions : d.countries);
  const entry = selected && entries(data)[selected.code];
  const myEntry = selected && mine ? entries(mine)[selected.code] : undefined;
  const name = selected && (selected.kind === "region" ? (regionByCode(selected.code)?.name ?? selected.code) : countryName(selected.code));

  return (
    <div class="space-y-6">
      <div class={container}>
        <MyMapLink />
      </div>
      <div class="relative">
        {error ? <p class={cn(container, "py-8")}>{error}</p> : <div ref={ref} class={mapBox} />}
        {!error && (
          <div class="absolute right-3 top-3 z-10">
            {mine ? (
              <button
                type="button"
                class={cn(btn, overlay, "text-black dark:text-white", overlap && "ring-2 ring-black/40 dark:ring-white/50")}
                aria-pressed={overlap}
                onClick={() => setOverlap(!overlap)}
              >
                {overlap ? "✓ Comparing with my map" : "🔀 Compare with my map"}
              </button>
            ) : (
              <a class={cn(btn, overlay, "block text-black dark:text-white")} href={MY_MAP_URL}>
                Make your map to compare
              </a>
            )}
          </div>
        )}
        {!error && <MapLegend class={legendCorner} items={legend} />}
        {selected && (
          <section class={cn(overlay, "absolute inset-x-3 bottom-3 z-10 space-y-2 p-4 md:inset-x-auto md:bottom-auto md:left-3 md:top-3 md:w-80")} aria-live="polite">
            <div class="flex items-start justify-between gap-2">
              <h2 class="font-semibold text-black dark:text-white">{name}</h2>
              <button type="button" class={btn} onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>
            {overlap && mine ? (
              <>
                <p class="text-sm">{describeOverlap(owner, entry?.status, myEntry?.status)}</p>
                {overlapKey(entry?.status, myEntry?.status) === "both-want" && (
                  <a class={cn(btn, "inline-block")} href={planTripUrl(selected.code)}>✈️ Plan a trip</a>
                )}
              </>
            ) : entry ? (
              <p class="text-sm">
                {STATUS_LABEL[entry.status]}
                {entry.years?.length ? ` · ${entry.years.join(", ")}` : ""}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            ) : (
              <p class="text-sm">Not yet!</p>
            )}
          </section>
        )}
      </div>
      <div class={cn(container, "space-y-6")}>
        {overlap && mine ? (
          <p class="text-xs">"Been" means visited or lived. A place only one of you wants to go to isn't coloured.</p>
        ) : (
          range && <TimelineSlider min={range[0]} max={range[1]} value={year} onChange={setYear} />
        )}
        <MapNotes />
      </div>
    </div>
  );
}
