# Travel Map — design spec

## Context
Kim wants a fun tool on kakeya.kim with two goals:
1. **Organize** countries/cities visited, lived in, and wanted.
2. **Share** something fun with friends: trip invites that open as a spinning globe, fly into the country ("Let's visit Japan!"), and flatten into a map.

Plus a public, always-in-sync personal map. The site is static on GitHub Pages (Astro 5, Tailwind, dark mode), so there is **no server**: visitor data lives in localStorage, invites live in the URL, and Kim's map is a JSON file committed to the repo.

Decisions made while brainstorming: Kim's map is stored as JSON in the repo; v1 includes all extras (wishlist + stats, postcard invite, compare mode, timeline); cities come from a bundled search plus custom pins; rendering uses MapLibre GL; everything lives under `/projects/map`.

## Routes
| Route | File | Purpose |
|---|---|---|
| `/projects/map` | `src/pages/projects/map/index.astro` | Visitor's own editable map (localStorage) |
| `/projects/map/kim` | `src/pages/projects/map/kim.astro` | Kim's read-only map from `src/data/travel.json`, with timeline slider, stats, "Compare with my map", "Start my own map from this" |
| `/projects/map/invite#…` | `src/pages/projects/map/invite.astro` | Invite / reply view. The payload is in the hash (never sent to a server) |

Static routes take priority over `src/pages/projects/[...slug].astro`. There is no header change. Instead, add `src/content/projects/travel-map/index.md` (write-up, `demoURL: /projects/map`) so the tool appears in the projects list.

## Data model (`src/lib/map/data.ts`, validated with `astro/zod`)
```ts
type ISO3 = string; // Natural Earth ADM0_A3 (ISO_A3 is -99 for France/Norway)
type Status = "visited" | "lived" | "want";
interface TravelData {
  version: 1;
  countries: Record<ISO3, { status: Status; years?: number[]; note?: string }>;
  cities: { id: string; name: string; country: ISO3; lat: number; lon: number;
            status: "visited" | "want"; year?: number; note?: string;
            photo?: string; custom?: boolean }[];
}
interface Invite { v: 1; from?: string; stops: ISO3[]; message?: string;
                   images?: string[]; date?: string; visited?: ISO3[] }
interface Reply  { v: 1; from?: string; stops: ISO3[]; message?: string }
```
localStorage, export/import files, and `src/data/travel.json` all use `TravelData`. Invite/Reply are JSON → `lz-string` `compressToEncodedURIComponent`, stored in `#i=…` / `#r=…`.

## Components
- **Geo assets** (generated once by `scripts/build-geodata.mjs` with mapshaper, output committed to `public/map/`):
  - `countries.geojson`: Natural Earth 50m admin-0, simplified (~400KB), with `ADM0_A3`, name, and continent props.
  - `cities.json`: GeoNames cities15000 filtered to pop > 100k (~5k rows: name, iso3, lat, lon, pop), lazy-loaded.
- **`src/lib/map/`** (pure TS, unit-tested):
  - `data.ts`: types, zod schemas, `migrate()`.
  - `storage.ts`: `load/save` wrapped in try/catch (falls back to in-memory with a banner), `exportJson()`, `importJson()` with per-field errors.
  - `invite.ts`: `encodeInvite/decodeInvite`, `encodeReply/decodeReply`.
  - `stats.ts`: counts per status, "N / 195", per-continent progress, badges (e.g. every country on a continent), `atYear(data, year)` for the timeline, `compare(a, b)` → both / onlyA / onlyB.
- **`MapView`** (`src/lib/map/mapView.ts`, MapLibre GL v5, GeoJSON-only style with no tiles and no API key; loaded only on map pages):
  - `setCountryColors(Record<ISO3, colorKey>)` via feature-state
  - `flyToCountry(iso)` using the bbox
  - `globeIntro()`: slow spin, then fly to the target. The globe → mercator switch on zoom is native
  - `setPins(cities)`, `setArcs(stops)` (great-circle lines)
  - `onCountryClick`, `onMapClick` (drop a custom pin)
  - Colors come from CSS tokens so light/dark both work.
- **UI islands (Preact, `@astrojs/preact`)** in `src/components/map/`:
  - `TravelMap` (the `/projects/map` shell)
  - `CountryPanel`: name, status buttons, years, note, city search + list, "Plan a trip here"
  - `CitySearch`: filters the bundled list by country, plus "drop a custom pin"
  - `StatsStrip`
  - `ImportExport`
  - `InviteBuilder`: stops, message, image URLs, date, from, "include my visited countries" toggle, copy link / native share
  - `InviteView`: intro, postcard, countdown, "I'm in" → reply link, Compare, Make my own
  - `ReplyView`
  - `TimelineSlider`
  - `CompareToggle`: 4-bucket legend with counts
- **`src/data/travel.json`**: Kim's map, imported at build time into `kim.astro`. Update workflow: edit in `/projects/map` → Export → replace the file → commit → deploy.

## Security / errors
- `message`, `from`, and notes are rendered as text only (no `innerHTML`).
- Image URLs must be `https:` and render with `referrerpolicy="no-referrer"` and `loading="lazy"`; broken images are hidden. Cap at 6 images.
- A bad or undecodable hash shows a friendly "this invite looks broken" plus a link to `/projects/map`.
- Unknown ISO codes in imports or invites are ignored and a warning is shown.
- No OG preview per invite (not possible on static hosting); the page's static OG image is used instead.

## Build phases (each shippable)
1. Deps (`maplibre-gl`, `lz-string`, `@astrojs/preact`, `vitest` dev), geodata script + assets, `MapView`, `/projects/map` with country panel, three statuses, stats, import/export.
2. Cities: bundled search + custom pins.
3. `/projects/map/kim` + `travel.json` + timeline slider + project entry.
4. Invites: builder, globe intro, postcard, multi-stop arcs, countdown, reply link.
5. Compare mode (on `/kim` and on invites that include visited countries).

## Verification
- `npx vitest run` for `src/lib/map/*` (invite round-trip including unicode and long messages, import validation, stats/timeline/compare).
- `npm run build` (runs `astro check`) and `npm run lint`.
- `npm run preview`, then check manually at desktop and phone widths in light and dark:
  - mark countries and reload (persists)
  - export, clear, import
  - add a city and a custom pin
  - create an invite and open it in a private window (globe → fly → map → postcard)
  - "I'm in" reply link
  - compare
  - timeline on `/kim`
  - a broken hash
  - localStorage blocked

## Next steps after approval
Per the brainstorming flow and CLAUDE.md:
1. Copy this spec to `docs/superpowers/specs/2026-09-26-travel-map-design.md` (not committed unless you ask).
2. You review it.
3. Invoke writing-plans to produce the step-by-step implementation plan in `tasks/todo.md`.

## Later (not v1)
- "Where should we go?" suggestions
- Per-visit photo galleries
- Real backend for short links and OG cards

## Changes after the v1 review (2026-09-27)
- **Layout:** the map spans the full page width on all map pages. Country search and the single "✈️ Plan a trip" button float in the map's top-right. The country panel (status, years, note, cities) floats top-left, or as a bottom sheet on phones. Zoom buttons are bottom-right. Cooperative gestures keep page scrolling usable.
- **Plan a trip:** there is one button. It starts a plan with the selected country, or adds it to the plan that's already open.
- **Invite message is Markdown** (up to 2000 chars), images included (`![caption](https://…)`, https only, max 6). The separate `images` field is gone. Rendering builds elements from marked tokens through an allowlist, so raw HTML shows as text.
- **City pins are flags** (red = been, white = want).
- **Multi-stop invites** tour each stop in order during the intro.
- **Removed:** compare mode (`visited` in invites, the compare legend, both/onlyA/onlyB colours) and reply links (`#r=`, `Reply`). "I'm in" is replaced by **"Add to my map as Want to go"**, which adds the invite's countries to the visitor's own map without changing countries already marked visited or lived.

## Changes after round 3 (2026-09-27)
- **Markers:** one colour each. A blue flag means been; a yellow map pin means want to go.
- **Search a place:** the map's search covers countries and the bundled cities. Picking a city adds it as "been" and marks its country as visited if the country isn't on the map yet. The in-panel city search was removed; "Drop a custom pin" stays in the panel.
- **Images that fail to load** (usually a link to a page, not the image file) show a visible note instead of vanishing. The planner preview explains how to copy the image address.
- **Faster invite intro:** 1.8 s spin, 2.5 s first flight, then 2 s between stops with 0.8 s pauses.
- **"Add to my map"** records the invite's year and a note, "Travel with <from>". Countries already on the want list get these merged in.
