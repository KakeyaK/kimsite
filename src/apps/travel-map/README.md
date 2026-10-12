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
- `src/pages/sandbox/travel-map/invite-guide.astro` — an unlisted page (no links, not in the sitemap or search,
  `noindex`) that is a prompt for an AI to write invite documents (see below). Its content comes from `lib/inviteGuide.ts`.
- `public/map/` — generated shapes, the city list (for trip stops) and the label font, fetched at runtime.

## Geo data

`npm run geodata` downloads Natural Earth and GeoNames data and writes `public/map/*` plus
`lib/countries.json` and `lib/regions.json`. The output is committed; CI never runs the script.

Borders and names follow the UN. Those decisions are the `UN_*` tables at
the top of the script. States exist only for the countries in `REGION_COUNTRIES`, plus the UK's nations.

## Invites

An invite is a link: `/sandbox/travel-map/invite#i=…`, its fields compressed with lz-string so a long message
still fits (see `lib/invite.ts`). Older links spell the fields out (`#to=Kyoto@JPN,BR-BA,KOR&from=Kim&msg=…`) and
still open. A city stop is written `Name@ISO3` and looked up in `public/map/cities.json`, so decoding is
asynchronous. When a link is broken, the invite page names the field that's wrong. Shared maps (`#m=…` on
`/shared`) are compressed the same way (`lib/sharedMap.ts`).

Nobody writes the link by hand: the trip planner (`InviteBuilder`) does. What is written by hand, or by an AI, is
the invite as a document (`lib/inviteDoc.ts`): the same fields as a frontmatter, then the message in Markdown.
The planner's source view (the code button) shows the invite that way and reads it back into the form.
