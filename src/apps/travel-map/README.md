# Travel map

A map to mark the countries and states you've visited, lived in or want to see, and to invite
friends on a trip (to a country, a state or a city). `/sandbox/travel-map` shows Kim's map; visitors make their own at
`/sandbox/travel-map/mine`, saved in their browser only.

## Layout

- `components/` — Preact UI. Entry points: `TravelMap` (your map, with the `Onboarding` card), `MapViewer` (anyone else's map, read-only, with overlap mode: Kim's and shared ones), `SharedMapPage` (a map shared as a link), `ShareMap` (the share button), `InvitePage` (a trip invite, told one place at a time over the map: `InviteView`, with the cover from `Postcard`), `Preview` (the sandbox thumbnail).
- `lib/` — everything without UI: data schema, storage, stats, search, trip invites, shared map links (`sharedMap.ts`), the overlap comparison (`overlap.ts`), and `mapView.ts` (the MapLibre wrapper). Tests sit next to the code.
- `data/travel.json` — Kim's own map, shown at `/sandbox/travel-map`; `data/kim.ts` loads and validates it.
- `styles.css` — the map's colors (`--map-*`), light and dark.
- `scripts/build-geodata.mjs` — generates the geo data (see below).
- `shortener/` — the invite link shortener at `go.kakeya.kim`, a Cloudflare Worker deployed on its own (see its [README](shortener/README.md)).

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

Cities (trip stops) are those over 100,000 people, every capital, and the travel destinations listed by GeoNames id
in `scripts/extra-cities.mjs` (Venice, Hallstatt, Oia…). To add one, find its id on geonames.org.

A country is pinned on the map (trip lines, the vehicle, distances) at its capital: the GeoNames capital, saved as
`point` in `lib/countries.json`. A country without one (Antarctica, a few territories) is pinned at its label point.

## Invites

An invite has destinations, and may say where the trip leaves from and comes back to (`start`, `return`): those are on
the route and the map (as rings), but aren't destinations, so "Add to my map" leaves them out. The invite page opens on
the cover (title, dates, route, message) over the whole route, then steps through the route with Next or the arrow keys:
the map travels each leg (the vehicle and the camera take longer for longer legs) and the panel shows the inviter's note
on that place. `lib/mapView.ts` has the camera moves (`showRoute`, `travel`).

An invite is a link: `/sandbox/travel-map/invite#i=…`, its fields compressed with lz-string (see `lib/invite.ts`).
A city stop is written `Name@ISO3` and looked up in `public/map/cities.json`, so decoding is asynchronous. A stop
may end with how you get there from the one before (`Kyoto@JPN by train`: plane, train, bus or boat), which picks
what travels that leg (a plane when not said). When a
link is broken, the invite page names the field that's wrong. Shared maps (`#m=…` on `/shared`) are compressed the
same way (`lib/sharedMap.ts`).

That link is never shared: the trip planner's "Create link" stores the invite with the shortener (`shortener/`) and
shows `go.kakeya.kim/<code>`, which forwards to it (`lib/shortLink.ts`). So an invite can be much longer than a
link a chat app would carry.

Every link made is saved in the visitor's browser (`lib/savedInvites.ts`) and listed under "Your invites"
(`SavedInvites`), to share again or reopen in the planner with Edit. A code is a hash of the invite, so an edited
invite gets a new link, saved over the old one in the list; the old link still opens the invite as it was, and
deleting from the list doesn't remove the link.

Nobody writes the link by hand: the trip planner (`InviteBuilder`) does. What is written by hand, or by an AI, is
the invite as a document (`lib/inviteDoc.ts`): the same fields as a frontmatter, then the message in Markdown, then
a note for any place under a heading that is the place as written (`## Kyoto@JPN`).
The planner's source view (the code button) shows the invite that way and reads it back into the form.
