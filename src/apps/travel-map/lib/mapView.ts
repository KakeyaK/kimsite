import maplibregl, {
  type ExpressionSpecification,
  type PaddingOptions,
  type GeoJSONSource,
  type Map as MLMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "../styles.css";
import type { FeatureCollection } from "geojson";
import type { ISO3 } from "./data";
import type { ColorKey } from "./stats";
import { alongLine, distanceKm, greatCircle, type LonLat } from "./geo";
import { isCityStop, isRegionStop, MODE_EMOJI, MODES, stopCenter, type CityStop, type Mode, type Stop } from "./stops";
import { COUNTRIES, REGIONS, countryByIso, regionByCode, regionsOf } from "./meta";
import { OVERLAP_KEYS } from "./overlap";

const COLOR_KEYS: ColorKey[] = ["visited", "lived", "want", "stop", ...OVERLAP_KEYS];
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
/** Padding with every side given. */
type Padding = { top: number; right: number; bottom: number; left: number };
const fullPadding = (p: number | PaddingOptions): Padding =>
  typeof p === "number" ? { top: p, right: p, bottom: p, left: p } : { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };

/** A globe map is a globe up to this zoom, then flattens until it's flat from FLAT_ZOOM on. */
const GLOBE_ZOOM = 2;
const FLAT_ZOOM = 3.5;

/** What a click on the map landed on: a state when one is drawn there, otherwise a country. */
export type PlaceRef = { kind: "country" | "region"; code: string };
const ICON_RATIO = 2; // drawn at 2x for sharp edges on retina screens

const VEHICLE_SIZE = 34;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const vehicleIcon = (mode: Mode) => `vehicle-${mode}`;
/** The ✈️ emoji points north-east: turned this much less than the line's bearing, it points along it. */
const PLANE_EMOJI_BEARING = 45;

/** What travels along a travel line while the camera follows it: the mode's emoji, with a soft land-coloured halo. */
function vehicleImage(mode: Mode): ImageData {
  const size = VEHICLE_SIZE * ICON_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.font = `${Math.round(size * 0.7)}px ${EMOJI_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = token("land");
  g.shadowBlur = 3 * ICON_RATIO;
  g.fillText(MODE_EMOJI[mode], size / 2, size / 2);
  return g.getImageData(0, 0, size, size);
}

export class MapView {
  readonly map: MLMap;
  /** Feature ids currently coloured, per source, so stale colours can be cleared. */
  private colored = { countries: new Set<string>(), regions: new Set<string>() };
  private outlined: ISO3[] = [];
  private selected: PlaceRef | null = null;
  private ready: Promise<void>;
  private themeObserver: MutationObserver;
  private destroyed = false;
  /** Bumped by every `travel`, so a vehicle still moving for an earlier one stops. */
  private trip = 0;
  /** The last route framed from the globe: its zoom, and the room it was framed in (see showRoute). */
  private routeFit: { route: string; center: maplibregl.LngLat; zoom: number; room: number } | null = null;
  private dark = document.documentElement.classList.contains("dark");

  /** `cooperative`: plain wheel and one-finger gestures scroll the page (for maps the page scrolls past). */
  constructor({ container, globe = false, interactive = true, cooperative = interactive }: { container: HTMLElement; globe?: boolean; interactive?: boolean; cooperative?: boolean }) {
    const style: StyleSpecification = {
      version: 8,
      // Self-hosted (see ../scripts/build-geodata.mjs): Latin-1 only, which covers every place name we draw.
      glyphs: `${location.origin}/map/fonts/{fontstack}/{range}.pbf`,
      // Globe when zoomed out, flattening into mercator as the camera zooms in (MapLibre v5 projection expression).
      projection: globe
        ? { type: ["interpolate", ["linear"], ["zoom"], GLOBE_ZOOM, "vertical-perspective", FLAT_ZOOM, "mercator"] }
        : { type: "mercator" },
      sources: {
        countries: { type: "geojson", data: "/map/countries.geojson", promoteId: "ADM0_A3", attribution: "Natural Earth" },
        regions: { type: "geojson", data: "/map/regions.geojson", promoteId: "code" },
        labels: { type: "geojson", data: LABELS },
        cities: { type: "geojson", data: EMPTY, attribution: "GeoNames" },
        arcs: { type: "geojson", data: EMPTY },
        endpoints: { type: "geojson", data: EMPTY },
        vehicle: { type: "geojson", data: EMPTY },
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
        // The leg being travelled (setActiveLeg), drawn solid over its dashes.
        {
          id: "arcs-active", type: "line", source: "arcs", filter: ["==", ["get", "leg"], -1],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": token("stop"), "line-width": 2.5 },
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
        // A trip's city stops: dots in the trip colour, smaller at the world view.
        {
          id: "cities", type: "circle", source: "cities",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.5, 4, 3.5, 7, 5],
            "circle-color": token("stop"),
          },
        },
        // Where a trip leaves from and comes back to: rings, as they aren't destinations.
        {
          id: "endpoints", type: "circle", source: "endpoints",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3, 4, 4.5, 7, 6],
            "circle-color": token("land"),
            "circle-stroke-color": token("stop"),
            "circle-stroke-width": 2,
          },
        },
        {
          id: "vehicle", type: "symbol", source: "vehicle",
          layout: {
            "icon-image": ["get", "icon"],
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
      // A flat map shows one world. A globe needs the copies: without them, while it's still drawn flat on the way out,
      // the camera's centre is held at 0° and a flight back to the globe ends there.
      renderWorldCopies: globe,
      attributionControl: { compact: true },
      // The map spans the page width, so plain wheel/one-finger gestures scroll the page; Ctrl/⌘ or two fingers move the map.
      cooperativeGestures: interactive && cooperative,
    });
    if (interactive) {
      this.map.touchZoomRotate.disableRotation();
      this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right"); // top-right holds the search
    }
    // Vehicle icons are added lazily, the first time their layer asks for one.
    this.map.on("styleimagemissing", ({ id }) => {
      const mode = MODES.find((m) => vehicleIcon(m) === id);
      if (mode && !this.map.hasImage(id)) this.map.addImage(id, vehicleImage(mode), { pixelRatio: ICON_RATIO });
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
    this.map.setPaintProperty("cities", "circle-color", token("stop"));
    this.map.setPaintProperty("arcs-active", "line-color", token("stop"));
    this.map.setPaintProperty("endpoints", "circle-color", token("land"));
    this.map.setPaintProperty("endpoints", "circle-stroke-color", token("stop"));
    for (const mode of MODES) {
      if (this.map.hasImage(vehicleIcon(mode))) this.map.updateImage(vehicleIcon(mode), vehicleImage(mode));
    }
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
    bounds: [number, number, number, number],
    { duration, padding, minZoom }: { duration: number; padding: number | PaddingOptions; minZoom: number },
  ): void {
    const camera = this.fit(bounds, padding, 5);
    if (!camera) return; // padding larger than the map: nothing sensible to show
    this.map.flyTo({ ...camera, zoom: Math.max(camera.zoom, minZoom), duration: reducedMotion() ? 0 : duration });
  }

  /**
   * The camera that frames a box in what `padding` leaves of the map. The padding becomes the camera's own, so the box
   * is centred in the free space; that also holds on the globe, where shifting the centre sideways instead (what
   * cameraForBounds does) can turn half the box out of sight.
   */
  private fit(
    [w, s, e, n]: [number, number, number, number],
    padding: number | PaddingOptions,
    maxZoom: number,
  ): { center: maplibregl.LngLat; zoom: number; padding: Padding } | null {
    const pad = fullPadding(padding);
    // cameraForBounds leaves out the camera's current padding as well as the one given: take the current one back off.
    const cur = fullPadding(this.map.getPadding());
    const camera = this.map.cameraForBounds([[w, s], [e, n]], {
      padding: { top: pad.top - cur.top, right: pad.right - cur.right, bottom: pad.bottom - cur.bottom, left: pad.left - cur.left },
      maxZoom,
    });
    if (camera?.zoom === undefined) return null;
    // The box's middle on a flat map, so a tall country is centred as it's drawn.
    const sw = maplibregl.MercatorCoordinate.fromLngLat([w, s]);
    const ne = maplibregl.MercatorCoordinate.fromLngLat([e, n]);
    const center = new maplibregl.MercatorCoordinate((sw.x + ne.x) / 2, (sw.y + ne.y) / 2).toLngLat();
    return { center, zoom: camera.zoom, padding: pad };
  }

  /** Frame the whole route, lines and all. Resolves once the camera settles. */
  async showRoute(stops: Stop[], { padding = 48, duration = 1500 }: { padding?: number | PaddingOptions; duration?: number } = {}): Promise<void> {
    await this.ready;
    this.stopTravel();
    if (stops.length === 1) return this.settle(() => this.flyToStop(stops[0], { duration, padding }), duration);
    // The lines' points, each line shifted by whole turns to start where the one before ended, so a route across the
    // date line is framed across it rather than around the world.
    const points: LonLat[] = [stopCenter(stops[0])];
    for (const stop of stops.slice(1)) {
      const line = greatCircle(points[points.length - 1], stopCenter(stop));
      const shift = Math.round((points[points.length - 1][0] - line[0][0]) / 360) * 360;
      points.push(...line.map(([lon, lat]): LonLat => [lon + shift, lat]));
    }
    const lons = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const camera = this.fit([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)], padding, CITY_ZOOM);
    if (!camera) return;
    // cameraForBounds (in `fit`) is only a first guess on the globe, so while the map is drawn as one, the route is
    // measured on it. Zoomed in, the map is flat and can't be measured that way: a route measured on the globe keeps
    // that camera, its zoom scaled to the room there is now (zoom is the log of size).
    const { clientWidth: w, clientHeight: h } = this.map.getContainer();
    const room = Math.min(w - camera.padding.left - camera.padding.right, h - camera.padding.top - camera.padding.bottom);
    const key = JSON.stringify(stops.map(stopCenter));
    if (this.map.getZoom() <= GLOBE_ZOOM) {
      Object.assign(camera, this.measureFit(points, camera));
      this.routeFit = { route: key, center: camera.center, zoom: camera.zoom, room };
    } else if (this.routeFit?.route === key && room > 0) {
      camera.center = this.routeFit.center;
      camera.zoom = this.routeFit.zoom + Math.log2(room / this.routeFit.room);
    }
    return this.settle(() => this.map.flyTo({ ...camera, duration: reducedMotion() ? 0 : duration }), duration);
  }

  /**
   * Refine a camera so `points` fill the room its padding leaves, by trying it: jump there, see where the points land,
   * zoom by how much bigger they could be and centre on them, a few times over, then jump back. Nothing is drawn in
   * between, so none of it shows.
   */
  private measureFit(points: LonLat[], camera: { center: maplibregl.LngLat; zoom: number; padding: Padding }) {
    const saved = { center: this.map.getCenter(), zoom: this.map.getZoom(), padding: this.map.getPadding() };
    const { clientWidth: w, clientHeight: h } = this.map.getContainer();
    const { top, right, bottom, left } = camera.padding;
    let { center, zoom } = camera;
    for (let i = 0; i < 3; i++) {
      this.map.jumpTo({ center, zoom, padding: camera.padding });
      const px = points.map((p) => this.map.project(p));
      const xs = px.map((p) => p.x);
      const ys = px.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const scale = Math.min((w - left - right) / Math.max(1, x1 - x0), (h - top - bottom) / Math.max(1, y1 - y0));
      center = this.map.unproject([(x0 + x1) / 2, (y0 + y1) / 2]);
      zoom = Math.min(CITY_ZOOM, zoom + Math.log2(scale * 0.9));
    }
    this.map.jumpTo(saved);
    return { center, zoom };
  }

  /**
   * Fly to `to`. Coming from `from`, a vehicle (`mode`, a plane when not said) travels the line between them while the
   * camera follows, for longer the farther it goes. Resolves once there; a later `travel` or `showRoute` cuts it short.
   */
  async travel(
    to: Stop,
    { from, mode, padding = 48 }: { from?: Stop; mode?: Mode | null; padding?: number | PaddingOptions } = {},
  ): Promise<void> {
    await this.ready;
    const trip = ++this.trip;
    this.setVehicle(null);
    const km = from ? distanceKm(stopCenter(from), stopCenter(to)) : 0;
    // Lyon to Paris takes about a second and a quarter; the other side of the world, at most 2.6s.
    const duration = Math.round(Math.min(2600, 900 + 1700 * Math.sqrt(km / 10_000)));
    const leg = from && km > 0 && !reducedMotion()
      ? this.moveVehicle(trip, mode ?? "plane", greatCircle(stopCenter(from), stopCenter(to)), duration)
      : null;
    await Promise.all([this.settle(() => this.flyToStop(to, { duration, padding }), duration), leg]);
    if (trip === this.trip && !this.destroyed) this.setVehicle(null);
  }

  /** Stop any vehicle moving and the camera with it. */
  stopTravel(): void {
    this.trip++;
    this.map.stop();
    if (this.map.getSource("vehicle")) this.setVehicle(null);
  }

  /** Move the vehicle along `line` over `ms`, eased like the camera, until `trip` is no longer the current one. */
  private moveVehicle(trip: number, mode: Mode, line: LonLat[], ms: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      const step = (now: number) => {
        if (this.destroyed || trip !== this.trip) return resolve();
        const f = Math.min(1, (now - start) / ms);
        this.setVehicle({ mode, ...alongLine(line, ease(f)) });
        if (f < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private setVehicle(at: { mode: Mode; point: LonLat; bearing: number } | null): void {
    // Only the plane turns with the line; the other emojis are side or front views, which would tip over if turned.
    const properties = at && { icon: vehicleIcon(at.mode), bearing: at.mode === "plane" ? at.bearing - PLANE_EMOJI_BEARING : 0 };
    (this.map.getSource("vehicle") as GeoJSONSource).setData(
      at ? { type: "Feature", properties, geometry: { type: "Point", coordinates: at.point } } : EMPTY,
    );
  }

  /** Start a camera move and resolve once it ends (or a little after it should have, if `moveend` never comes). */
  private settle(move: () => void, duration: number): Promise<void> {
    const settled = new Promise<void>((resolve) => {
      this.map.once("moveend", () => resolve());
      setTimeout(resolve, (reducedMotion() ? 0 : duration) + 1000);
    });
    move();
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

  /** Dots for a trip's city stops. */
  async setCityStops(cities: CityStop[]): Promise<void> {
    await this.ready;
    (this.map.getSource("cities") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: cities.map((c) => ({
        type: "Feature",
        properties: { name: c.n },
        geometry: { type: "Point", coordinates: stopCenter(c) },
      })),
    });
  }

  /** Rings where a trip leaves from and comes back to. */
  async setEndpoints(stops: Stop[]): Promise<void> {
    await this.ready;
    (this.map.getSource("endpoints") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: stops.map((s) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: stopCenter(s) } })),
    });
  }

  /** Draw leg `i` of the lines (from stop i to i + 1) solid; null for none. */
  async setActiveLeg(i: number | null): Promise<void> {
    await this.ready;
    this.map.setFilter("arcs-active", ["==", ["get", "leg"], i ?? -1]);
  }

  /** Dashed great-circle lines from each stop to the next. */
  async setArcs(stops: Stop[]): Promise<void> {
    await this.ready;
    const centers = stops.map(stopCenter);
    const features: FeatureCollection["features"] = [];
    for (let i = 1; i < centers.length; i++) {
      features.push({
        type: "Feature",
        properties: { leg: i - 1 },
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

  destroy(): void {
    this.destroyed = true;
    this.themeObserver.disconnect();
    this.map.remove();
  }
}
