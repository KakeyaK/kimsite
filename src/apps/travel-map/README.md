# Travel map

A map to mark the countries, states and cities you've visited, lived in or want to see, and to
invite friends on a trip. Lives at `/projects/map`; data is saved in the visitor's browser only.

## Layout

- `components/` — Preact UI. Entry points: `TravelMap` (your map), `KimMap` (Kim's read-only map), `InvitePage` (a trip invite).
- `lib/` — everything without UI: data schema, storage, stats, search, trip invites, and `mapView.ts` (the MapLibre wrapper). Tests sit next to the code.
- `data/travel.json` — Kim's own map, shown at `/projects/map/kim`.
- `styles.css` — the map's colors (`--map-*`), light and dark.
- `scripts/build-geodata.mjs` — generates the geo data (see below).

Outside this folder, because Astro needs them there:

- `src/pages/projects/map/` — the three routes; each only picks a title and renders one component.
- `public/map/` — generated shapes, the city list and the label font, fetched at runtime.

## Geo data

`npm run geodata` downloads Natural Earth and GeoNames data and writes `public/map/*` plus
`lib/countries.json` and `lib/regions.json`. The output is committed; CI never runs the script.

Borders, names and the count of 195 countries follow the UN. Those decisions are the `UN_*` tables at
the top of the script. States exist only for the countries in `REGION_COUNTRIES`, plus the UK's nations.
