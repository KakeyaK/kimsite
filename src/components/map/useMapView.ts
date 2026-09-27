import { useEffect, useRef, useState } from "preact/hooks";
import { MapView } from "@lib/map/mapView";

export function useMapView(opts: { globe?: boolean; interactive?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let v: MapView;
    try {
      v = new MapView({ ...opts, container: ref.current });
    } catch {
      setError("Your browser can't draw the map (WebGL is unavailable).");
      return;
    }
    setView(v);
    // Runs on unmount, including ClientRouter navigations, so WebGL contexts are released.
    return () => {
      v.destroy();
      setView(null);
    };
  }, []);

  return { ref, view, error };
}
