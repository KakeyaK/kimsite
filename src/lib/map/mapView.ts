import maplibregl, {
  type ExpressionSpecification,
  type PaddingOptions,
  type GeoJSONSource,
  type Map as MLMap,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import type { City, ISO3 } from "./data";
import type { ColorKey } from "./stats";
import { bboxCenter, greatCircle } from "./geo";
import { countryByIso } from "./meta";

export type PinInput = Pick<City, "id" | "name" | "lat" | "lon" | "status">;

const COLOR_KEYS: ColorKey[] = ["visited", "lived", "want", "stop"];
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--map-${name}`).trim() || "#888888";
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fillColor(): ExpressionSpecification {
  return [
    "match",
    ["coalesce", ["feature-state", "color"], "none"],
    ...COLOR_KEYS.flatMap((k) => [k, token(k)]),
    token("land"),
  ] as unknown as ExpressionSpecification; // spread match arms don't fit the tuple type
}
const PIN_STATUSES = ["visited", "want"] as const;
type PinStatus = (typeof PIN_STATUSES)[number];
const PIN_RATIO = 2; // drawn at 2x for sharp edges on retina screens
/** The flag's pole sits this many px left of the image centre; shift it so the pole's foot is on the city. */
const FLAG_POLE_OFFSET = 6;

/**
 * One-colour city markers, drawn on a canvas so they follow the theme tokens:
 * a blue flag for places you've been, a yellow map pin for places you want to go.
 * A soft shadow keeps them readable on a country filled with a similar colour.
 */
function pinImage(status: PinStatus): ImageData {
  const r = PIN_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = 18 * r;
  canvas.height = 24 * r;
  const g = canvas.getContext("2d")!;
  g.fillStyle = token(`pin-${status}`);
  g.shadowColor = "rgba(0, 0, 0, 0.35)";
  g.shadowBlur = 2 * r;
  g.beginPath();
  if (status === "visited") {
    // pole + swallow-tail flag + foot
    g.rect(2 * r, 1 * r, 1.5 * r, 21.5 * r);
    g.moveTo(3.5 * r, 1.5 * r);
    g.lineTo(16 * r, 1.5 * r);
    g.lineTo(12 * r, 6 * r);
    g.lineTo(16 * r, 10.5 * r);
    g.lineTo(3.5 * r, 10.5 * r);
    g.closePath();
    g.moveTo(4.25 * r, 22.5 * r);
    g.arc(2.75 * r, 22.5 * r, 1.5 * r, 0, Math.PI * 2);
  } else {
    // teardrop map pin with its tip at the bottom centre
    g.arc(9 * r, 8 * r, 6.5 * r, Math.PI * 0.8, Math.PI * 0.2);
    g.lineTo(9 * r, 23 * r);
    g.closePath();
  }
  g.fill();
  if (status === "want") {
    // punch the classic hole so it stays one colour
    g.shadowColor = "transparent";
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(9 * r, 8 * r, 2.5 * r, 0, Math.PI * 2);
    g.fill();
  }
  return g.getImageData(0, 0, canvas.width, canvas.height);
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MapView {
  readonly map: MLMap;
  private colored = new Set<ISO3>();
  private ready: Promise<void>;
  private themeObserver: MutationObserver;
  private cancelSpin: (() => void) | null = null;
  private destroyed = false;
  private dark = document.documentElement.classList.contains("dark");

  constructor({ container, globe = false, interactive = true }: { container: HTMLElement; globe?: boolean; interactive?: boolean }) {
    const style: StyleSpecification = {
      version: 8,
      // Globe when zoomed out, flattening into mercator as the camera zooms in (MapLibre v5 projection expression).
      projection: globe
        ? { type: ["interpolate", ["linear"], ["zoom"], 2, "vertical-perspective", 3.5, "mercator"] }
        : { type: "mercator" },
      sources: {
        countries: { type: "geojson", data: "/map/countries.geojson", promoteId: "ADM0_A3", attribution: "Natural Earth" },
        pins: { type: "geojson", data: EMPTY, attribution: "GeoNames" },
        arcs: { type: "geojson", data: EMPTY },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": token("ocean") } },
        { id: "country-fill", type: "fill", source: "countries", paint: { "fill-color": fillColor() } },
        { id: "country-line", type: "line", source: "countries", paint: { "line-color": token("border"), "line-width": 0.5 } },
        { id: "arcs", type: "line", source: "arcs", paint: { "line-color": token("stop"), "line-width": 2.5, "line-dasharray": [2, 1] } },
        {
          id: "pins", type: "symbol", source: "pins",
          layout: {
            "icon-image": ["match", ["get", "status"], "want", "pin-want", "pin-visited"],
            "icon-anchor": "bottom",
            // the pin's tip is centred; the flag's pole is off to the left
            "icon-offset": ["match", ["get", "status"], "want", ["literal", [0, 0]], ["literal", [FLAG_POLE_OFFSET, 0]]],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        },
      ],
    };

    this.map = new maplibregl.Map({
      container,
      style,
      center: [0, 20],
      zoom: globe ? 1.2 : 1,
      minZoom: 0.5,
      maxZoom: 8,
      interactive,
      dragRotate: false,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      // The map spans the page width, so plain wheel/one-finger gestures scroll the page; Ctrl/⌘ or two fingers move the map.
      cooperativeGestures: interactive,
    });
    if (interactive) {
      this.map.touchZoomRotate.disableRotation();
      this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right"); // top-right holds the search
    }
    // Marker icons are added lazily, the first time the pins layer asks for them.
    this.map.on("styleimagemissing", ({ id }) => {
      const status = PIN_STATUSES.find((s) => id === `pin-${s}`);
      if (status && !this.map.hasImage(id)) this.map.addImage(id, pinImage(status), { pixelRatio: PIN_RATIO });
    });
    this.ready = new Promise((resolve) => this.map.once("load", () => resolve()));
    this.themeObserver = new MutationObserver(() => this.applyTheme());
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  private applyTheme() {
    // The site also toggles classes on <html> while scrolling; only a dark/light switch matters here.
    const dark = document.documentElement.classList.contains("dark");
    if (dark === this.dark) return;
    this.dark = dark;
    if (!this.map.isStyleLoaded()) {
      this.map.once("idle", () => { this.dark = !dark; this.applyTheme(); });
      return;
    }
    this.map.setPaintProperty("background", "background-color", token("ocean"));
    this.map.setPaintProperty("country-fill", "fill-color", fillColor());
    this.map.setPaintProperty("country-line", "line-color", token("border"));
    this.map.setPaintProperty("arcs", "line-color", token("stop"));
    for (const s of PIN_STATUSES) {
      if (this.map.hasImage(`pin-${s}`)) this.map.updateImage(`pin-${s}`, pinImage(s));
    }
  }

  async setCountryColors(colors: Record<ISO3, ColorKey>): Promise<void> {
    await this.ready;
    for (const iso of this.colored) {
      if (!(iso in colors)) this.map.removeFeatureState({ source: "countries", id: iso }, "color");
    }
    for (const [iso, color] of Object.entries(colors)) {
      this.map.setFeatureState({ source: "countries", id: iso }, { color });
    }
    this.colored = new Set(Object.keys(colors));
  }

  /** `padding` keeps the country clear of panels floating over the map. */
  flyToCountry(iso: ISO3, { duration = 1500, padding = 48 }: { duration?: number; padding?: number | PaddingOptions } = {}): void {
    const c = countryByIso(iso);
    if (!c) return;
    const [w, s, e, n] = c.bbox;
    this.map.fitBounds([[w, s], [e, n]], { padding, maxZoom: 5, duration: reducedMotion() ? 0 : duration });
  }

  /**
   * Slow spin on the globe, then fly to each stop in turn, pausing at each one.
   * `onStop(i)` fires as the camera heads to stop i. Resolves once the camera settles on the last stop.
   */
  async globeIntro(
    stops: ISO3[],
    { spinMs = 1800, pauseMs = 800, onStop }: { spinMs?: number; pauseMs?: number; onStop?: (i: number) => void } = {},
  ): Promise<void> {
    await this.ready;
    if (!reducedMotion()) await this.spin(spinMs);
    for (let i = 0; i < stops.length && !this.destroyed; i++) {
      onStop?.(i);
      await this.flyAndSettle(stops[i], i === 0 ? 2500 : 2000);
      if (i < stops.length - 1 && !reducedMotion()) await sleep(pauseMs);
    }
  }

  private flyAndSettle(iso: ISO3, duration: number): Promise<void> {
    const settled = new Promise<void>((resolve) => {
      this.map.once("moveend", () => resolve());
      setTimeout(resolve, duration + 1000); // fallback if moveend never fires
    });
    this.flyToCountry(iso, { duration });
    return settled;
  }

  private spin(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const lng0 = this.map.getCenter().lng;
      let raf = 0;
      const step = (t: number) => {
        const f = Math.min(1, (t - start) / ms);
        this.map.jumpTo({ center: [lng0 + 120 * f, 20] });
        if (f < 1) raf = requestAnimationFrame(step);
        else {
          this.cancelSpin = null;
          resolve();
        }
      };
      this.cancelSpin = () => {
        cancelAnimationFrame(raf);
        resolve();
      };
      raf = requestAnimationFrame(step);
    });
  }

  async setPins(pins: PinInput[]): Promise<void> {
    await this.ready;
    (this.map.getSource("pins") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: pins.map((p) => ({
        type: "Feature",
        properties: { id: p.id, name: p.name, status: p.status },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    });
  }

  async setArcs(stops: ISO3[]): Promise<void> {
    await this.ready;
    const centers = stops.flatMap((iso) => {
      const c = countryByIso(iso);
      return c ? [bboxCenter(c.bbox)] : [];
    });
    const features: FeatureCollection["features"] = [];
    for (let i = 1; i < centers.length; i++) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: greatCircle(centers[i - 1], centers[i]) },
      });
    }
    (this.map.getSource("arcs") as GeoJSONSource).setData({ type: "FeatureCollection", features });
  }

  onCountryClick(cb: (iso: ISO3) => void): () => void {
    const click = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id;
      if (typeof id === "string") cb(id);
    };
    const enter = () => (this.map.getCanvas().style.cursor = "pointer");
    const leave = () => (this.map.getCanvas().style.cursor = "");
    this.map.on("click", "country-fill", click);
    this.map.on("mouseenter", "country-fill", enter);
    this.map.on("mouseleave", "country-fill", leave);
    return () => {
      this.map.off("click", "country-fill", click);
      this.map.off("mouseenter", "country-fill", enter);
      this.map.off("mouseleave", "country-fill", leave);
    };
  }

  onMapClick(cb: (p: { lat: number; lon: number }) => void): () => void {
    const click = (e: maplibregl.MapMouseEvent) => cb({ lat: e.lngLat.lat, lon: e.lngLat.wrap().lng });
    this.map.on("click", click);
    return () => this.map.off("click", click);
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelSpin?.();
    this.themeObserver.disconnect();
    this.map.remove();
  }
}
