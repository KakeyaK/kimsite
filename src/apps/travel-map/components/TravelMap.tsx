import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { emptyData, setCity, setRegion, type City, type CountryEntry, type ISO3, type TravelData } from "@apps/travel-map/lib/data";
import { createStore } from "@apps/travel-map/lib/storage";
import { regionColors, statusColors } from "@apps/travel-map/lib/stats";
import { customCityId } from "@apps/travel-map/lib/cities";
import { countryName, regionByCode } from "@apps/travel-map/lib/meta";
import type { PlaceRef } from "@apps/travel-map/lib/mapView";
import { markPicked, type Place } from "@apps/travel-map/lib/places";
import type { Stop } from "@apps/travel-map/lib/stops";
import { cn } from "@lib/utils";
import { useMapView } from "./useMapView";
import { PlacePanel } from "./PlacePanel";
import { PlaceSearch } from "./PlaceSearch";
import { RegionList } from "./RegionList";
import { CityList } from "./CityList";
import { StatsStrip } from "./StatsStrip";
import { ImportExport } from "./ImportExport";
import { MapNotes } from "./MapNotes";
import { InviteBuilder } from "./InviteBuilder";
import { btn, btnActive, container, mapBox, overlay } from "./ui";

/** The country a selection belongs to (a state's country, or the country itself). */
const countryOf = (place: PlaceRef): ISO3 => (place.kind === "country" ? place.code : (regionByCode(place.code)?.country ?? place.code));

export default function TravelMap() {
  const store = useMemo(() => createStore(), []);
  const [data, setData] = useState<TravelData>(() => store.load());
  const [selected, setSelected] = useState<PlaceRef | null>(null);
  const { ref, view, error } = useMapView();

  /** Country whose custom pin is being dropped (the next map click places it). */
  const [pinFor, setPinFor] = useState<ISO3 | null>(null);
  const pinForRef = useRef<ISO3 | null>(null);
  pinForRef.current = pinFor;

  /** Trip stops while the planner is open; null when it's closed. */
  const [planning, setPlanning] = useState<Stop[] | null>(null);
  const plannerRef = useRef<HTMLDivElement>(null);

  function update(next: TravelData) {
    setData(next);
    store.save(next);
  }

  function setCountry(iso: ISO3, entry: CountryEntry | null) {
    const countries = { ...data.countries };
    if (entry) countries[iso] = entry;
    else delete countries[iso];
    update({ ...data, countries });
  }

  function upsertCity(city: City) {
    update(setCity(data, city));
  }

  function removeCity(id: string) {
    update({ ...data, cities: data.cities.filter((c) => c.id !== id) });
  }

  /** Search result: marks it "been" (see `markPicked`) and opens its panel: a state's, or else its country's. */
  function pickPlace(place: Place) {
    update(markPicked(data, place));
    setSelected(place.kind === "region" ? { kind: "region", code: place.code } : { kind: "country", code: place.iso });
  }

  /** Opens an empty trip planner (or scrolls to the one already open, keeping what's in it). */
  function planTrip() {
    setPlanning((stops) => stops ?? []);
    requestAnimationFrame(() => plannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  useEffect(() => {
    void view?.setCountryColors(statusColors(data));
    void view?.setRegionColors(regionColors(data));
  }, [view, data]);

  useEffect(() => {
    void view?.setPins(data.cities);
  }, [view, data.cities]);

  useEffect(() => {
    void view?.setSelected(selected);
  }, [view, selected]);

  useEffect(() => (view ? view.onPlaceClick((place) => { if (!pinForRef.current) setSelected(place); }) : undefined), [view]);

  useEffect(() => {
    if (!view) return;
    return view.onMapClick(({ lat, lon, region }) => {
      const iso = pinForRef.current;
      if (!iso) return;
      setPinFor(null);
      const name = window.prompt("Name this place", "My spot")?.trim();
      if (!name) return;
      // Functional update: this handler is registered once and would otherwise see stale `data`.
      setData((current) => {
        const pin: City = { id: customCityId(), name: name.slice(0, 200), country: iso, lat, lon, status: "visited", custom: true };
        // Only a state of the pin's own country (a click just over the border lands in a neighbour's).
        if (region && regionByCode(region)?.country === iso) pin.region = region;
        const next = setCity(current, pin);
        store.save(next);
        return next;
      });
    });
  }, [view]);

  useEffect(() => {
    const el = ref.current;
    if (!selected || !view || !el) return;
    // Keep the place clear of the panel: left column on wide screens, bottom sheet on phones.
    const padding =
      el.clientWidth >= 768
        ? { top: 64, right: 48, bottom: 48, left: 368 }
        : { top: 72, right: 24, bottom: Math.round(el.clientHeight * 0.55) + 16, left: 24 };
    if (selected.kind === "region") view.flyToRegion(selected.code, { padding });
    else view.flyToCountry(selected.code, { padding });
  }, [view, selected]);

  const iso = selected && countryOf(selected);

  return (
    <div class="space-y-6">
      {!store.isPersistent() && (
        <p role="status" class={cn(container, "text-sm")}>
          <span class="block rounded border border-amber-500/40 bg-amber-500/10 p-3">
            Your browser is blocking storage, so changes here won't be saved after you leave. Use Export to keep a copy.
          </span>
        </p>
      )}

      <div class="relative">
        {error ? <p class={cn(container, "py-8")}>{error}</p> : <div ref={ref} class={mapBox} />}

        <div class="absolute inset-x-3 top-3 z-10 flex gap-2 md:left-auto md:w-[26rem]">
          <PlaceSearch cities class="flex-1 shadow-lg" label="Search places" placeholder="Search a place…" onPick={pickPlace} />
          <button type="button" class={cn(btn, overlay, "shrink-0 text-black dark:text-white")} onClick={planTrip}>
            ✈️ Plan a trip
          </button>
        </div>

        {selected && iso ? (
          <div class="absolute inset-x-3 bottom-3 z-10 max-h-[55%] overflow-y-auto rounded-lg md:inset-x-auto md:bottom-auto md:left-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-80">
            {selected.kind === "region" ? (
              <PlacePanel
                name={regionByCode(selected.code)?.name ?? selected.code}
                entry={data.regions[selected.code]}
                onChange={(entry) => update(setRegion(data, selected.code, entry))}
                onClose={() => setSelected(null)}
                back={{ label: countryName(iso), onClick: () => setSelected({ kind: "country", code: iso }) }}
              />
            ) : (
              <PlacePanel
                name={countryName(iso)}
                entry={data.countries[iso]}
                onChange={(entry) => setCountry(iso, entry)}
                onClose={() => { setSelected(null); setPinFor(null); }}
              >
                <RegionList iso={iso} data={data} onPick={(code) => setSelected({ kind: "region", code })} />
                <CityList cities={data.cities.filter((c) => c.country === iso)} onChange={upsertCity} onRemove={removeCity} />
                <p class="text-xs">Add cities with the search box, or:</p>
                <button
                  type="button"
                  class={cn(btn, pinFor === iso && btnActive)}
                  aria-pressed={pinFor === iso}
                  onClick={() => setPinFor(pinFor === iso ? null : iso)}
                >
                  {pinFor === iso ? "Click the map to drop the pin… (cancel)" : "📍 Drop a custom pin"}
                </button>
              </PlacePanel>
            )}
          </div>
        ) : (
          !error && (
            <p class={cn(overlay, "pointer-events-none absolute bottom-3 left-3 z-10 px-3 py-1.5 text-sm")}>
              Click a country, or search a place, to mark it.
            </p>
          )
        )}
      </div>

      <div class={cn(container, "space-y-10")}>
        {planning && (
          <div ref={plannerRef} class="scroll-mt-24">
            <InviteBuilder stops={planning} onStopsChange={setPlanning} onClose={() => setPlanning(null)} />
          </div>
        )}
        <StatsStrip data={data} />
        <ImportExport data={data} onImport={update} onClear={() => { store.clear(); setData(emptyData()); }} />
        <MapNotes />
      </div>
    </div>
  );
}
