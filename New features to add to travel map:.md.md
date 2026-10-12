# Travel map: new features

Spec for four changes to the travel map app (`src/apps/travel-map/`, routes in `src/pages/sandbox/travel-map/`).
Read the app's README and the repo's CLAUDE.md first. The site is static (GitHub Pages): there is no
backend, so anything shared between people travels inside a link.

Backwards compatibility is not a concern: old URLs and old invite links may break. The one thing to
keep is a visitor's saved map in `localStorage`.

Build as four PRs, in this order: 1, 3.1, 2, 3.2. Each one must pass `npm run build`, `npm test` and
`npm run lint`. Pure logic goes in `lib/` with tests next to it, as the app already does.

## 1. App flow: visitors land on Kim's map

Today `/sandbox/travel-map` is the visitor's own map and `/sandbox/travel-map/kim` is Kim's. Swap them.

Routes

- `/sandbox/travel-map` shows Kim's map (read-only).
- `/sandbox/travel-map/mine` shows the visitor's own map (editable; today's `TravelMap`).
- Delete the `/sandbox/travel-map/kim` route and the old `/projects/map` forwarding pages (and their
  sitemap filter in `astro.config.mjs`). No redirects are needed.
- Every internal link to "my map" points to `/mine`: the invite page ("Open my map", the broken-invite
  page), the sandbox preview if it links anywhere, and the search index if it lists the app's pages.

Kim's map page

- One main button leads to `/mine`. It reads "Create my own map" when the visitor has no saved map and
  "Open my map" when they have one. Visitors are never redirected automatically.
- Remove "Start my own map from this" (copying Kim's map into the visitor's).

Onboarding on `/mine`

- A dismissible card over the map, shown when the visitor arrives with an empty map and has not
  dismissed it before. Remember the dismissal in `localStorage`. A "?" button reopens it at any time.
- It says, briefly:
  - Click a country to mark it as visited, lived or want to go; zoom in to mark states.
  - The map is saved only in this browser. Clearing browser data, or switching device, loses it.
  - Export the map to a file to keep a copy or move it. Put the export button in the card.
- If the browser blocks storage (`store.isPersistent()` is false), say so in the card.

## 2. Sharing a map, and overlap mode

Sharing

- On `/mine`, a "Share my map" button builds a link and shares it with the existing `shareOrCopy`.
- The link carries the map itself, compressed into the hash like invites are:
  `/sandbox/travel-map/shared#m=<payload>`. Payload: a version, the sharer's optional name, and the
  travel data.
- Notes are left out by default. A checkbox "Include my notes" adds them.
- The link is a snapshot. Tell the sharer in the share UI that later edits need a new link.
- A broken or truncated link shows a clear error page, like the invite one.

One viewer for every read-only map

- Build one read-only viewer that takes travel data and an owner name. Use it for Kim's map (data
  bundled with the site) and for shared links (data from the hash). It replaces `KimMap`.
- It keeps what `KimMap` has today: the place panel, the timeline slider, the stats and the notes.

Overlap mode

- A toggle in the viewer compares the owner's map with the visitor's own saved map. It therefore works
  on Kim's map too.
- If the visitor has no saved map, the toggle is replaced by "Make your map to compare", linking to
  `/mine`.
- "Been" means visited or lived. Colors, for countries and states alike:

  | Color           | Owner | Visitor |
  | ---------------- | ----- | ------- |
  | Both been        | been  | been    |
  | Both want to go  | want  | want    |
  | Only them        | been  | not been (may want it) |
  | Only you         | not been (may want it) | been |

  A place only one person wants, and nobody has been to, is not colored.
- Show a legend and a count per category (for example "12 countries in common").
- Clicking a place shows both statuses in words (for example "Ana has been · you want to go").
- A "Both want to go" place offers "Plan a trip", which opens the invite builder on `/mine` with that
  place as the first stop.
- New colors go in `styles.css` as `--map-*` variables, for light and dark.
- The timeline slider is hidden while overlap mode is on.

Out of scope: saving a friend's map, comparing more than two maps, links that update live.

## 3.1 Invite: put the postcard in focus

Today, after the globe tour, the postcard renders below the map (`InviteView`).

- When the tour ends, the postcard appears centred over the map, on a dimmed backdrop.
- An "Explore the map" button, Esc or a click on the backdrop dismisses it: the card moves down to
  where it sits today and the map becomes interactive.
- "Add to Google Calendar" and "Add to my map" do not dismiss the card; they confirm in place as now.
- A "Skip" button is visible during the tour and jumps straight to the postcard.
- With `prefers-reduced-motion`, there is no tour and no slide animation: the card is shown at once.
- Without WebGL the card is shown at once, as today.
- On a phone the card must fit the screen and scroll inside; a message can be 2,000 characters with
  images.
- Focus moves to the card when it appears and back to the page when it is dismissed.

## 3.2 Invites an AI can write

Today an invite link is `#i=` plus lz-string-compressed JSON, and a city stop needs its coordinates. A
language model cannot produce that by hand. Replace it with a readable link format, and add a hidden
page that teaches it.

Readable link format

- `/sandbox/travel-map/invite#to=Kyoto@JPN,BR-BA,KOR&from=Kim&date=2027-03-01&end=2027-03-15&msg=...`
- Fields map to the existing invite schema: `to` (stops, required), `from`, `email`, `date`, `end`,
  `msg` (Markdown). Values are percent-encoded. The same limits apply (`MAX_STOPS`, `MAX_MESSAGE`).
- A stop is a country code (`JPN`), a state code (`BR-BA`) or a city written `Name@ISO3`.
- A city is looked up by name in `public/map/cities.json`, ignoring case and accents, within that
  country; if several match, the most populous wins. This makes decoding asynchronous for this format.
- Stops that cannot be resolved are skipped with the existing "some places were skipped" warning.
- When a readable link is invalid, the error page says which field is wrong. This is what Kim will
  use to debug a model's output.
- This is the only invite format. Remove the `#i=` format and its lz-string code from invites; the
  invite builder produces readable links too. Old `#i=` links may stop working.

Hidden guide page

- One page, for example `/sandbox/travel-map/invite-guide`, with two parts:
  1. The format reference: fields, limits, the stop syntax, which countries have states, how to
     percent-encode, and two full example links.
  2. A ready prompt with a copy button. The prompt contains the whole reference, so it works in a
     model that cannot browse. It asks the model for the places, the dates and who the invite is
     from, and tells it to write a message that sells the trip: the best things to do in each place,
     in Markdown, within the length limit. It tells the model to return only the link, and not to
     invent image URLs.
- Generate the limits and the list of countries with states from the code, so the page cannot drift.
- The page is unlisted: no link to it anywhere on the site, not in the sandbox listing, not in
  `search.json`, excluded from the sitemap in `astro.config.mjs`, and marked `noindex`.
