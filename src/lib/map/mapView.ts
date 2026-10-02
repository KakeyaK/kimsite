import maplibregl, {
  type ExpressionSpecification,
  type PaddingOptions,
  type GeoJSONSource,
  type Map as MLMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import type { City, ISO3 } from "./data";
import type { ColorKey } from "./stats";
import { alongLine, greatCircle, type LonLat } from "./geo";
import { isCityStop, isRegionStop, stopCenter, type Stop } from "./stops";
import { COUNTRIES, REGIONS, countryByIso, regionByCode, regionsOf } from "./meta";

/** A marker: a city on your map (been / want) or a city on a trip ("stop"). */
export type PinInput = Pick<City, "id" | "name" | "lat" | "lon"> & { status: PinStatus };

const COLOR_KEYS: ColorKey[] = ["visited", "lived", "want", "stop"];
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--map-${name}`).trim() || "#888888";
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fill by the feature-state `color` key; features without one get `fallback`. */
function fillColor(fallback: string): ExpressionSpecification {
  return [
    "match",
    ["coalesce", ["feature-state", "color"], "none"],
    ...COLOR_KEYS.flatMap((k) => [k, token(k)]),
    fallback,
  ] as unknown as ExpressionSpecification; // spread match arms don't fit the tuple type
}
/**
 * Zooming into a country that has states (Brazil) crossfades between the two views: the country's
 * own fill fades out while its states fade in, and a border in the country's colour fades in so you
 * still see which country you're in. Flying to such a country never stops short of the end.
 */
const REGION_FADE_START = 3;
const REGION_FADE_END = 3.6;
/** States become clickable once they're at least half faded in. */
const REGION_CLICK_ZOOM = (REGION_FADE_START + REGION_FADE_END) / 2;
const TRANSPARENT = "rgba(0, 0, 0, 0)";
const COUNTRIES_WITH_STATES = [...new Set(REGIONS.map((r) => r.country))];
const hasStates = ["in", ["get", "ADM0_A3"], ["literal", COUNTRIES_WITH_STATES]];

/** A value that goes from `from` to `to` across the state fade. */
function acrossFade(from: unknown, to: unknown): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], REGION_FADE_START, from, REGION_FADE_END, to] as unknown as ExpressionSpecification;
}

/**
 * Country fill. Once its states are drawn, a country that has states is plain land underneath
 * them: the state shapes don't line up exactly with the country outline, and its colour would show
 * through at the edges.
 */
function countryFill(): ExpressionSpecification {
  return acrossFade(fillColor(token("land")), ["case", hasStates, token("land"), fillColor(token("land"))]);
}
/** Country names fade in from here, once there's room for more than a handful. */
const LABEL_FADE_START = 1.8;
const LABEL_FADE_END = 2.3;
const LABELS: FeatureCollection = {
  type: "FeatureCollection",
  features: COUNTRIES.map((c) => ({
    type: "Feature",
    properties: { name: c.name, rank: c.labelRank },
    geometry: { type: "Point", coordinates: c.label },
  })),
};
/** Line opacity for the clicked place's border (feature-state `selected`). */
const SELECTED_OPACITY: ExpressionSpecification = ["case", ["boolean", ["feature-state", "selected"], false], 1, 0];
/** Zoom for flying to a single city. */
const CITY_ZOOM = 6;

/** What a click on the map landed on: a state when one is drawn there, otherwise a country. */
export type PlaceRef = { kind: "country" | "region"; code: string };
const PIN_STATUSES = ["visited", "want", "stop"] as const;
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
  g.fillStyle = token(status === "stop" ? "stop" : `pin-${status}`);
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
    // teardrop map pin (want to go, or a city on a trip) with its tip at the bottom centre
    g.arc(9 * r, 8 * r, 6.5 * r, Math.PI * 0.8, Math.PI * 0.2);
    g.lineTo(9 * r, 23 * r);
    g.closePath();
  }
  g.fill();
  if (status !== "visited") {
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

/** Material Design "flight" icon (Apache 2.0), a 24×24 path pointing north. */
const PLANE_PATH =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";
const PLANE_SIZE = 34;

/** The plane that flies along the travel lines during the intro, in the trip colour with a land-coloured edge. */
function planeImage(): ImageData {
  const r = PIN_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PLANE_SIZE * r;
  const g = canvas.getContext("2d")!;
  g.scale((PLANE_SIZE * r) / 26, (PLANE_SIZE * r) / 26);
  g.translate(1, 1); // room for the outline
  const path = new Path2D(PLANE_PATH);
  g.lineJoin = "round";
  g.lineWidth = 2;
  g.strokeStyle = token("land");
  g.stroke(path);
  g.fillStyle = token("stop");
  g.fill(path);
  return g.getImageData(0, 0, canvas.width, canvas.height);
}

export class MapView {
  readonly map: MLMap;
  /** Feature ids currently coloured, per source, so stale colours can be cleared. */
  private colored = { countries: new Set<string>(), regions: new Set<string>() };
  private outlined: ISO3[] = [];
  private selected: PlaceRef | null = null;
  private ready: Promise<void>;
  private themeObserver: MutationObserver;
  private cancelSpin: (() => void) | null = null;
  private destroyed = false;
  private dark = document.documentElement.classList.contains("dark");

  constructor({ container, globe = false, interactive = true }: { container: HTMLElement; globe?: boolean; interactive?: boolean }) {
    const style: StyleSpecification = {
      version: 8,
      // Self-hosted (see scripts/build-geodata.mjs): Latin-1 only, which covers every place name we draw.
      glyphs: `${location.origin}/map/fonts/{fontstack}/{range}.pbf`,
      // Globe when zoomed out, flattening into mercator as the camera zooms in (MapLibre v5 projection expression).
      projection: globe
        ? { type: ["interpolate", ["linear"], ["zoom"], 2, "vertical-perspective", 3.5, "mercator"] }
        : { type: "mercator" },
      sources: {
        countries: { type: "geojson", data: "/map/countries.geojson", promoteId: "ADM0_A3", attribution: "Natural Earth" },
        regions: { type: "geojson", data: "/map/regions.geojson", promoteId: "code" },
        labels: { type: "geojson", data: LABELS },
        pins: { type: "geojson", data: EMPTY, attribution: "GeoNames" },
        arcs: { type: "geojson", data: EMPTY },
        plane: { type: "geojson", data: EMPTY },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": token("ocean") } },
        { id: "country-fill", type: "fill", source: "countries", paint: { "fill-color": countryFill() } },
        { id: "country-line", type: "line", source: "countries", paint: { "line-color": token("border"), "line-width": 0.5 } },
        // Once states are drawn they replace the country's colour: unmarked states are plain land,
        // so you can see which states you've actually been to.
        {
          id: "region-fill", type: "fill", source: "regions", minzoom: REGION_FADE_START,
          paint: { "fill-color": fillColor(token("land")), "fill-opacity": acrossFade(0, 1) },
        },
        {
          id: "region-line", type: "line", source: "regions", minzoom: REGION_FADE_START,
          paint: { "line-color": token("border"), "line-width": 0.4, "line-opacity": acrossFade(0, 1) },
        },
        // Trip maps outline the country around a city or state stop (feature-state `outline`).
        {
          id: "country-trip-outline", type: "line", source: "countries",
          paint: {
            "line-color": token("stop"),
            "line-width": 2,
            "line-opacity": ["case", ["boolean", ["feature-state", "outline"], false], 1, 0],
          },
        },
        // …while the country keeps its colour as a border.
        {
          id: "country-outline", type: "line", source: "countries", minzoom: REGION_FADE_START,
          filter: hasStates as ExpressionSpecification,
          paint: { "line-color": fillColor(TRANSPARENT), "line-width": 2.5, "line-opacity": acrossFade(0, 1) },
        },
        // The clicked country or state. States are only clickable once drawn, so their border shares their fade.
        {
          id: "country-selected", type: "line", source: "countries",
          paint: { "line-color": token("selected"), "line-width": 2, "line-opacity": SELECTED_OPACITY },
        },
        {
          id: "region-selected", type: "line", source: "regions", minzoom: REGION_FADE_START,
          paint: { "line-color": token("selected"), "line-width": 2, "line-opacity": SELECTED_OPACITY },
        },
        // Travel lines: a solid halo in the land colour under the dashed line, so the dashes stay
        // visible over a country filled in the same trip colour (e.g. two neighbouring stops).
        {
          id: "arcs-halo", type: "line", source: "arcs",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": token("land"), "line-width": 4, "line-opacity": 0.9 },
        },
        {
          id: "arcs", type: "line", source: "arcs",
          layout: { "line-join": "round" },
          paint: { "line-color": token("stop"), "line-width": 1.5, "line-dasharray": [3, 1.5] },
        },
        // Country names, most important first; ones that would overlap are left out until there's room.
        {
          id: "labels", type: "symbol", source: "labels", minzoom: LABEL_FADE_START,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["sans"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 2, 11, 6, 14],
            "text-max-width": 7,
            "text-padding": 4,
            "symbol-sort-key": ["get", "rank"],
          },
          paint: {
            "text-color": token("label"),
            "text-halo-color": token("land"),
            "text-halo-width": 1.2,
            "text-opacity": ["interpolate", ["linear"], ["zoom"], LABEL_FADE_START, 0, LABEL_FADE_END, 1],
          },
        },
        {
          id: "pins", type: "symbol", source: "pins",
          layout: {
            "icon-image": ["concat", "pin-", ["get", "status"]],
            "icon-anchor": "bottom",
            // the pin's tip is centred; the flag's pole is off to the left
            "icon-offset": ["match", ["get", "status"], "visited", ["literal", [FLAG_POLE_OFFSET, 0]], ["literal", [0, 0]]],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        },
        {
          id: "plane", type: "symbol", source: "plane",
          layout: {
            "icon-image": "plane",
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
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
      if (id === "plane" && !this.map.hasImage(id)) return this.map.addImage(id, planeImage(), { pixelRatio: PIN_RATIO });
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
    this.map.setPaintProperty("country-fill", "fill-color", countryFill());
    this.map.setPaintProperty("country-line", "line-color", token("border"));
    this.map.setPaintProperty("region-fill", "fill-color", fillColor(token("land")));
    this.map.setPaintProperty("region-line", "line-color", token("border"));
    this.map.setPaintProperty("country-outline", "line-color", fillColor(TRANSPARENT));
    this.map.setPaintProperty("country-trip-outline", "line-color", token("stop"));
    this.map.setPaintProperty("country-selected", "line-color", token("selected"));
    this.map.setPaintProperty("region-selected", "line-color", token("selected"));
    this.map.setPaintProperty("labels", "text-color", token("label"));
    this.map.setPaintProperty("labels", "text-halo-color", token("land"));
    this.map.setPaintProperty("arcs", "line-color", token("stop"));
    this.map.setPaintProperty("arcs-halo", "line-color", token("land"));
    for (const s of PIN_STATUSES) {
      if (this.map.hasImage(`pin-${s}`)) this.map.updateImage(`pin-${s}`, pinImage(s));
    }
    if (this.map.hasImage("plane")) this.map.updateImage("plane", planeImage());
  }

  setCountryColors(colors: Record<ISO3, ColorKey>): Promise<void> {
    return this.setColors("countries", colors);
  }

  setRegionColors(colors: Record<string, ColorKey>): Promise<void> {
    return this.setColors("regions", colors);
  }

  /** Outline these countries in the trip colour (and clear any outlined before). */
  async setCountryOutlines(isos: ISO3[]): Promise<void> {
    await this.ready;
    for (const id of this.outlined) this.map.setFeatureState({ source: "countries", id }, { outline: false });
    for (const id of isos) this.map.setFeatureState({ source: "countries", id }, { outline: true });
    this.outlined = isos;
  }

  /** Highlight the border of this country or state (or none), clearing the previous one. */
  async setSelected(place: PlaceRef | null): Promise<void> {
    await this.ready;
    const source = (p: PlaceRef) => (p.kind === "region" ? "regions" : "countries");
    if (this.selected) this.map.setFeatureState({ source: source(this.selected), id: this.selected.code }, { selected: false });
    if (place) this.map.setFeatureState({ source: source(place), id: place.code }, { selected: true });
    this.selected = place;
  }

  private async setColors(source: "countries" | "regions", colors: Record<string, ColorKey>): Promise<void> {
    await this.ready;
    for (const id of this.colored[source]) {
      if (!(id in colors)) this.map.removeFeatureState({ source, id }, "color");
    }
    for (const [id, color] of Object.entries(colors)) {
      this.map.setFeatureState({ source, id }, { color });
    }
    this.colored[source] = new Set(Object.keys(colors));
  }

  /**
   * `padding` keeps the country clear of panels floating over the map. A country with states
   * (Brazil) is never framed below the zoom where its states are drawn.
   */
  flyToCountry(iso: ISO3, { duration = 1500, padding = 48 }: { duration?: number; padding?: number | PaddingOptions } = {}): void {
    const c = countryByIso(iso);
    if (c) this.flyToBounds(c.bbox, { duration, padding, minZoom: regionsOf(iso).length ? REGION_FADE_END : 0 });
  }

  flyToRegion(code: string, { duration = 1500, padding = 48 }: { duration?: number; padding?: number | PaddingOptions } = {}): void {
    const r = regionByCode(code);
    if (r) this.flyToBounds(r.bbox, { duration, padding, minZoom: REGION_FADE_END });
  }

  private flyToBounds(
    [w, s, e, n]: [number, number, number, number],
    { duration, padding, minZoom }: { duration: number; padding: number | PaddingOptions; minZoom: number },
  ): void {
    const camera = this.map.cameraForBounds([[w, s], [e, n]], { padding, maxZoom: 5 });
    if (!camera) return; // padding larger than the map: nothing sensible to show
    this.map.flyTo({ ...camera, zoom: Math.max(camera.zoom ?? 0, minZoom), duration: reducedMotion() ? 0 : duration });
  }

  /**
   * Slow spin on the globe, then fly to each stop in turn, pausing at each one.
   * `onStop(i)` fires as the camera heads to stop i. Resolves once the camera settles on the last stop.
   */
  async globeIntro(
    stops: Stop[],
    { spinMs = 1800, pauseMs = 800, onStop }: { spinMs?: number; pauseMs?: number; onStop?: (i: number) => void } = {},
  ): Promise<void> {
    await this.ready;
    if (!reducedMotion()) await this.spin(spinMs);
    for (let i = 0; i < stops.length && !this.destroyed; i++) {
      onStop?.(i);
      const duration = i === 0 ? 2500 : 2000;
      // From the second stop on, a plane flies the leg while the camera follows.
      const leg = i > 0 && !reducedMotion() ? this.flyPlane(greatCircle(stopCenter(stops[i - 1]), stopCenter(stops[i])), duration) : null;
      await Promise.all([this.flyAndSettle(stops[i], duration), leg]);
      if (i < stops.length - 1 && !reducedMotion()) await sleep(pauseMs);
    }
    this.setPlane(null);
  }

  /** Move the plane along `line` over `ms`, eased like the camera. It stays at the end until the next leg. */
  private flyPlane(line: LonLat[], ms: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      const step = (now: number) => {
        if (this.destroyed) return resolve();
        const f = Math.min(1, (now - start) / ms);
        this.setPlane(alongLine(line, ease(f)));
        if (f < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private setPlane(at: { point: LonLat; bearing: number } | null): void {
    (this.map.getSource("plane") as GeoJSONSource).setData(
      at
        ? { type: "Feature", properties: { bearing: at.bearing }, geometry: { type: "Point", coordinates: at.point } }
        : EMPTY,
    );
  }

  private flyAndSettle(stop: Stop, duration: number): Promise<void> {
    const settled = new Promise<void>((resolve) => {
      this.map.once("moveend", () => resolve());
      setTimeout(resolve, duration + 1000); // fallback if moveend never fires
    });
    this.flyToStop(stop, { duration });
    return settled;
  }

  /** A city: centred at a fixed zoom. A state or country: framed by its area. */
  flyToStop(stop: Stop, { duration = 1500, padding = 48 }: { duration?: number; padding?: number | PaddingOptions } = {}): void {
    if (isCityStop(stop)) {
      this.map.flyTo({ center: stopCenter(stop), zoom: CITY_ZOOM, padding, duration: reducedMotion() ? 0 : duration });
    } else if (isRegionStop(stop)) {
      this.flyToRegion(stop, { duration, padding });
    } else {
      this.flyToCountry(stop, { duration, padding });
    }
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

  /** Dashed great-circle lines from each stop to the next. */
  async setArcs(stops: Stop[]): Promise<void> {
    await this.ready;
    const centers = stops.map(stopCenter);
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

  /** Clicks on the map: the state under the cursor when states are drawn there, otherwise the country. */
  onPlaceClick(cb: (place: PlaceRef) => void): () => void {
    const layers = ["region-fill", "country-fill"];
    const click = (e: maplibregl.MapMouseEvent) => {
      const region = this.regionAt(e.point);
      const [country] = region ? [] : this.map.queryRenderedFeatures(e.point, { layers: ["country-fill"] });
      if (region) cb({ kind: "region", code: region });
      else if (typeof country?.id === "string") cb({ kind: "country", code: country.id });
    };
    const enter = () => (this.map.getCanvas().style.cursor = "pointer");
    const leave = () => (this.map.getCanvas().style.cursor = "");
    this.map.on("click", click);
    for (const layer of layers) {
      this.map.on("mouseenter", layer, enter);
      this.map.on("mouseleave", layer, leave);
    }
    return () => {
      this.map.off("click", click);
      for (const layer of layers) {
        this.map.off("mouseenter", layer, enter);
        this.map.off("mouseleave", layer, leave);
      }
    };
  }

  /** The state drawn at this screen point, if states are shown there. */
  private regionAt(point: maplibregl.PointLike): string | undefined {
    if (this.map.getZoom() < REGION_CLICK_ZOOM) return undefined;
    const [region] = this.map.queryRenderedFeatures(point, { layers: ["region-fill"] });
    return typeof region?.id === "string" ? region.id : undefined;
  }

  /** Any click on the map, with the state under it when states are shown. */
  onMapClick(cb: (p: { lat: number; lon: number; region?: string }) => void): () => void {
    const click = (e: maplibregl.MapMouseEvent) => cb({ lat: e.lngLat.lat, lon: e.lngLat.wrap().lng, region: this.regionAt(e.point) });
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
