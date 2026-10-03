import { useEffect, useMemo, useState } from "preact/hooks";
import type { TravelData } from "@apps/travel-map/lib/data";
import { atYear, regionColors, statusColors, yearRange } from "@apps/travel-map/lib/stats";
import { countryName, regionByCode } from "@apps/travel-map/lib/meta";
import type { PlaceRef } from "@apps/travel-map/lib/mapView";
import { createStore } from "@apps/travel-map/lib/storage";
import { cn } from "@lib/utils";
import { useMapView } from "./useMapView";
import { StatsStrip } from "./StatsStrip";
import { MapNotes } from "./MapNotes";
import { TimelineSlider } from "./TimelineSlider";
import { btn, container, mapBox, overlay, STATUS_LABEL } from "./ui";

export default function KimMap({ data }: { data: TravelData }) {
  const { ref, view, error } = useMapView();
  const [year, setYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<PlaceRef | null>(null);
  const range = useMemo(() => yearRange(data), [data]);
  const shown = useMemo(() => (year === null ? data : atYear(data, year)), [data, year]);

  useEffect(() => {
    void view?.setCountryColors(statusColors(shown));
    void view?.setRegionColors(regionColors(shown));
  }, [view, shown]);

  useEffect(() => {
    void view?.setSelected(selected);
  }, [view, selected]);

  useEffect(() => (view ? view.onPlaceClick(setSelected) : undefined), [view]);

  function startOwn() {
    const store = createStore();
    const mine = store.load();
    const hasMine = Object.keys(mine.countries).length > 0;
    if (hasMine && !confirm("Replace your own map with a copy of mine?")) return;
    store.save(structuredClone(data));
    window.location.href = "/sandbox/travel-map";
  }

  const entry = selected && (selected.kind === "region" ? data.regions : data.countries)[selected.code];
  const name = selected && (selected.kind === "region" ? (regionByCode(selected.code)?.name ?? selected.code) : countryName(selected.code));

  return (
    <div class="space-y-6">
      <div class="relative">
        {error ? <p class={cn(container, "py-8")}>{error}</p> : <div ref={ref} class={mapBox} />}
        {selected && (
          <section class={cn(overlay, "absolute inset-x-3 bottom-3 z-10 p-4 md:inset-x-auto md:bottom-auto md:left-3 md:top-3 md:w-80")} aria-live="polite">
            <div class="flex items-start justify-between gap-2">
              <h2 class="font-semibold text-black dark:text-white">{name}</h2>
              <button type="button" class={btn} onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>
            {entry ? (
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
        {range && <TimelineSlider min={range[0]} max={range[1]} value={year} onChange={setYear} />}
        <StatsStrip data={shown} />
        <div class="flex flex-wrap gap-2">
          <button type="button" class={btn} onClick={startOwn}>Start my own map from this</button>
          <a class={btn} href="/sandbox/travel-map">Make my own map</a>
        </div>
        <MapNotes />
      </div>
    </div>
  );
}
