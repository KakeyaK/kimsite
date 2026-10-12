# Travel map

A map to mark the countries and states you've visited, lived in or want to see, and to invite
friends on a trip (to a country, a state or a city). `/sandbox/travel-map` shows Kim's map; visitors make their own at
`/sandbox/travel-map/mine`, saved in their browser only.

## Layout

- `components/` — Preact UI. Entry points: `TravelMap` (your map, with the `Onboarding` card), `MapViewer` (anyone else's map, read-only, with overlap mode: Kim's and shared ones), `SharedMapPage` (a map shared as a link), `ShareMap` (the share button), `InvitePage` (a trip invite: a globe tour, then the postcard over the map, which "Explore the map" sends below it), `Preview` (the sandbox thumbnail).
- `lib/` — everything without UI: data schema, storage, stats, search, trip invites, shared map links (`sharedMap.ts`), the overlap comparison (`overlap.ts`), and `mapView.ts` (the MapLibre wrapper). Tests sit next to the code.
- `data/travel.json` — Kim's own map, shown at `/sandbox/travel-map`; `data/kim.ts` loads and validates it.
- `styles.css` — the map's colors (`--map-*`), light and dark.
- `scripts/build-geodata.mjs` — generates the geo data (see below).

Outside this folder, because Astro needs them there:

- `src/pages/sandbox/travel-map/` — the routes (Kim's map at the root, your map at `mine`, a shared map at `shared`, an invite, and the `preview` shown in the
  sandbox card); each only picks a title and renders one component. `src/content/sandbox/travel-map/` is
  the sandbox entry (the card's title and description).
- `public/map/` — generated shapes, the city list (for trip stops) and the label font, fetched at runtime.

## Geo data

`npm run geodata` downloads Natural Earth and GeoNames data and writes `public/map/*` plus
`lib/countries.json` and `lib/regions.json`. The output is committed; CI never runs the script.

Borders, names and the count of 195 countries follow the UN. Those decisions are the `UN_*` tables at
the top of the script. States exist only for the countries in `REGION_COUNTRIES`, plus the UK's nations.
