import { useEffect } from "preact/hooks";
import type { TravelData } from "@apps/travel-map/lib/data";
import { regionColors, statusColors } from "@apps/travel-map/lib/stats";
import { useMapView } from "./useMapView";

/** Kim's map as a still thumbnail for the sandbox card: no controls, fills the whole frame. */
export default function Preview({ data }: { data: TravelData }) {
  const { ref, view, error } = useMapView({ interactive: false });

  useEffect(() => {
    void view?.setCountryColors(statusColors(data));
    void view?.setRegionColors(regionColors(data));
  }, [view, data]);

  return error ? <p class="p-4 text-sm">{error}</p> : <div ref={ref} class="h-screen w-full" />;
}
