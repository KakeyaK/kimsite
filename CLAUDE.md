# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal website built on Astro 5 (static output), based on the [Astro Nano](https://github.com/markhorn-dev/astro-nano) template. Deployed to GitHub Pages via `.github/workflows/` on every push to `main` (uses `withastro/action`). Site URL is configured in `astro.config.mjs` (`site: https://www.kakeya.kim/`).

## Commands

- `npm run dev` — dev server at `localhost:4321`
- `npm run build` — runs `astro check` (type-check) then `astro build`. Use this to validate changes, together with `npm test`.
- `npm run preview` — preview the production build locally
- `npm run lint` / `npm run lint:fix` — ESLint (Astro + TS + jsx-a11y)
- `npm test` — Vitest (`src/**/*.test.ts`; today only the apps have tests)
- `npm run geodata` — regenerates the travel map's geo data (needs network; output is committed)
- `npm run shortener:deploy` — deploys the invite link shortener, a Cloudflare Worker outside the Astro build (see `src/apps/travel-map/shortener/README.md`)
- `npm run astro -- --help` — Astro CLI

Path alias: `@*` maps to `./src/*` (e.g. `@components/...`, `@lib/...`, `@layouts/...`, `@consts`, `@types`). Defined in `tsconfig.json`, which extends `astro/tsconfigs/strict`.

## Content architecture

Content lives in `src/content/` as Astro content collections defined in [src/content/config.ts](src/content/config.ts): `blog`, `projects`, `sandbox`. Schemas are Zod-validated — changing frontmatter shape requires editing the schema there. Entries with `draft: true` are filtered out of all listings.

### The blog folder system (most important / non-obvious part)

The blog supports arbitrary **nested folders**, unlike the flat `projects`/`sandbox` collections. This is a custom extension on top of the template.

- The `blog` collection schema is a **union** of two shapes (see `config.ts`): a normal post (`folder` absent or `false`) and a folder index (`folder: true`). A folder is just a markdown file (conventionally `index.md`) with `folder: true` plus `title`/`description` — it carries no body content, only metadata used to label/describe the folder in listings and breadcrumbs.
- The on-disk directory structure under `src/content/blog/` *is* the folder hierarchy. An entry's `slug` (e.g. `usp/MAC0470/Tutorials/tutorial_1`) encodes its path. Folder index files have slugs ending in `/index`, normalized by stripping `/index`.
- [src/lib/blogEntries.ts](src/lib/blogEntries.ts) provides the type guards `isBlogFolderEntry` / `isBlogPostEntry` and the `BlogPostEntry` / `BlogFolderEntry` types. **Always use these guards** to distinguish folders from posts rather than checking `entry.data.folder` ad hoc.
- [src/pages/blog/[...slug].astro](src/pages/blog/[...slug].astro) is the heart of navigation. Its `getStaticPaths` generates a route for every post slug **and** every folder prefix. At render time the same slug either matches a post (renders the article) or is treated as a folder (renders sub-folder cards + post list for that level). Duplicate folder indexes for the same path throw an error at build time.
- [src/pages/blog/index.astro](src/pages/blog/index.astro) renders the blog root: top-level folder cards plus top-level posts grouped by year (descending).

When adding nested blog content, place markdown under the appropriate directory and add an `index.md` with `folder: true` for any new folder you want labeled in the UI.

## Apps (`src/apps/`)

Self-contained projects that live inside the site each get a folder under `src/apps/<name>/` holding their components, logic, data, styles, scripts and tests. Current apps: `travel-map` (see its [README](src/apps/travel-map/README.md)) and `typing-test` (the typing game on the homepage).

- Only what Astro requires elsewhere stays outside: thin route files in `src/pages/` (title + one component) and static files in `public/<app>/`.
- Apps visitors open on their own page are listed in the **sandbox** (`/sandbox`, in the header). Each one has an entry in `src/content/sandbox/<slug>/index.md` (frontmatter only: title, description, date, `preview`), its routes in `src/pages/sandbox/<slug>/`, and a `preview.astro` there: a bare page (`EmbedLayout`) that `SandboxCard` shows as a live, scaled-down iframe, CodePen-style. Keep previews non-interactive and light, they load on the listing page.
- An app may import from the site (`@layouts`, `@lib/utils`, …). The site imports an app only from that app's route files or the page that embeds it. Apps never import from each other.
- Import with the alias: `@apps/travel-map/lib/...`.
- Both import rules are enforced by ESLint (`import/no-restricted-paths` in `.eslintrc.cjs`).
- **Isolation.** Apps share the page with the site, so they keep to themselves:
  - Each component a route mounts as an island is wrapped with its framework's helper in `src/lib/islands/` (today `preact.tsx`: `island(App, { name, class })`), which adds an error boundary so a crash shows a message instead of a blank space. A new framework gets its own helper there.
  - Styles go in CSS modules (`*.module.css`), hung on the class passed to `island()`. A `<style>` in an `.astro` component is already scoped and fine too. No global selectors (`:root`, `body`, bare tags) except through `:global(html.dark)` for dark mode. Tailwind utilities are fine.
  - Storage keys are prefixed with the app's name (`travel-map:...`); never `localStorage.clear()`.
  - Each JSX framework integration in `astro.config.mjs` has an `include` list of the JSX files written in it (`src/apps/<app>/**/*.{jsx,tsx}`); a new app adds its glob there. An app on a framework other than Preact also needs a `/** @jsxImportSource ... */` pragma in its files, since `tsconfig.json` defaults JSX to Preact.
- `src/components/` and `src/lib/` are for the site itself (header, cards, blog helpers), not app code.

## Search palette

Shift+Esc (or the search icon in the header) opens a Spotlight-style palette on every page, showing the 3 best matches.

- [src/pages/search.json.ts](src/pages/search.json.ts) builds the index at build time: the sections, every blog folder, every post, project and sandbox app. A new top-level page has to be added there by hand.
- [src/lib/search.ts](src/lib/search.ts) holds the `SearchItem` type and the pure matching/ranking (`searchItems`), tested in `search.test.ts`.
- [src/components/SearchPalette.astro](src/components/SearchPalette.astro) (rendered by `PageLayout`) is the `<dialog>` and its script; it fetches `/search.json` the first time it opens.
- The shortcut must never be a key that types a character: the homepage typing test (and any text field) has to receive every letter.

## Layout & styling

- [src/layouts/PageLayout.astro](src/layouts/PageLayout.astro) is the single page shell (`Head` + `Header` + `<slot/>` + `Footer`), takes `title`/`description`. Page `<title>` becomes `${title} | ${SITE.NAME}`.
- Site-wide config (name, email, socials, homepage item counts) and per-page metadata live in [src/consts.ts](src/consts.ts), typed by [src/types.ts](src/types.ts). Homepage counts like `NUM_POSTS_ON_HOMEPAGE` control how many items `index.astro` shows.
- Tailwind (`@astrojs/tailwind` + typography plugin). Use the `cn()` helper in [src/lib/utils.ts](src/lib/utils.ts) (clsx + tailwind-merge) for conditional classes. `utils.ts` also has `formatDate`, `readingTime`, and `dateRange`.
- Dark mode is supported throughout via `dark:` variants and a theme toggle (Sun/Moon/System icons in `src/components/icons/`).
