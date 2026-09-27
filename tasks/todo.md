# Travel Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a travel map tool under `/projects/map` to kakeya.kim: an editable personal map (localStorage), Kim's public map (`travel.json`), shareable trip invites in the URL hash, a timeline, and compare mode.

**Architecture:** Pure, unit-tested TS in `src/lib/map/` (schemas, storage, invite codec, stats, geo math) sits under a thin `MapView` wrapper around MapLibre GL v5 (GeoJSON-only style, no tiles). Preact islands in `src/components/map/` are mounted `client:only="preact"` on three static Astro pages. Geo assets are generated once by a Node script and committed.

**Tech Stack:** Astro 5, Preact (`@astrojs/preact`), Tailwind 3, MapLibre GL 5, lz-string, zod (`astro/zod`), Vitest 3, mapshaper (dev, script only).

**Spec:** `docs/superpowers/specs/2026-09-26-travel-map-design.md`

## Global Constraints

- No server. Visitor data lives in localStorage, invites live in the URL hash (`#i=…` / `#r=…`), Kim's map is `src/data/travel.json`.
- Country ids are Natural Earth `ADM0_A3` (not `ISO_A3`, which is `-99` for France/Norway).
- `TravelData` is the one format for localStorage, export/import, and `travel.json`.
- Invite/Reply encoding: `JSON.stringify` → `lz-string` `compressToEncodedURIComponent`.
- MapLibre is loaded only on map pages; no API keys, no tile servers.
- Colors come from CSS custom properties so light and dark both work.
- `message`, `from`, notes: text only, never `innerHTML` / `dangerouslySetInnerHTML`.
- Image URLs: `https:` only, `referrerpolicy="no-referrer"`, `loading="lazy"`, hidden on error, max 6.
- Bad/undecodable hash → "this invite looks broken" + link to `/projects/map`.
- Unknown ISO codes in imports or invites are dropped and a warning is shown.
- "N / 195" uses 195 as the country total.
- Everything lives under `/projects/map`; no header change; the tool appears in the projects list via `src/content/projects/travel-map/index.md` with `demoURL: /projects/map`.
- **Git:** per Kim's CLAUDE.md, do NOT run `git add`/`git commit`/`git rm` unless Kim explicitly asks. Each task ends with a **Checkpoint** (show the diff summary and wait) instead of a commit.
- Validate with `npx vitest run`, `npm run build` (includes `astro check`), and `npm run lint`.

## Review Focus

1. **localStorage throws or is missing** (Safari private mode, blocked site data): the map must still work in memory and show a "changes won't be saved" banner, not crash or go blank. Pinned by Task 3 tests.
2. **Malformed or tampered invite hash** (random text, valid lz-string that isn't JSON, JSON with the wrong shape, `#i=` with nothing after it), and **a second invite opened in the same tab** (only the hash changes, so no reload): show the broken-invite screen for bad input and re-render on `hashchange`. Pinned by Task 4 tests (`parseHash`, `decodeInvite`) and the `hashchange` listener in Task 12.
3. **Hostile image URLs in an invite** (`javascript:`, `data:`, `http:`, more than 6): dropped when decoding, so the renderer never sees them. Pinned by Task 4 tests.
4. **Imported file from somewhere else** (wrong shape, `years` as strings, unknown/lowercase ISO codes, older export without `version`): per-field errors or migration, and unknown countries dropped with a warning; the current map is never replaced by a half-valid one. Pinned by Task 2 and Task 3 tests.
5. **Theme toggled while the map is open, and ClientRouter navigation between map pages**: the map recolors live (MutationObserver on `<html class>`), and the MapLibre instance is removed on unmount so WebGL contexts don't leak. Covered by `MapView.destroy()` + observer (Task 7) and manual checks in Task 14.

## File Structure

| File | Responsibility |
|---|---|
| `.eslintrc.cjs` | ESLint config (missing today; `npm run lint` needs it) |
| `vitest.config.ts` | Vitest via Astro's Vite config (resolves `@` aliases) |
| `scripts/build-geodata.mjs` | One-off generator for geo assets |
| `public/map/countries.geojson` | Simplified Natural Earth 50m admin-0 (`ADM0_A3`, `NAME`, `CONTINENT`) |
| `public/map/cities.json` | `[name, iso3, lat, lon, pop][]`, pop > 100k, sorted by pop desc |
| `src/lib/map/countries.json` | Small meta list `{ iso, name, continent, bbox }[]` bundled into JS |
| `src/lib/map/data.ts` | Types, zod schemas, `emptyData`, `migrate`, `dropUnknown`, `isHttpsUrl` |
| `src/lib/map/storage.ts` | `createStore` (load/save/persistent flag), `exportJson`, `importJson` |
| `src/lib/map/invite.ts` | Invite/Reply schemas, encode/decode, `parseHash`, URL builders |
| `src/lib/map/stats.ts` | Counts, continent progress, badges, `atYear`, `yearRange`, `compare` |
| `src/lib/map/geo.ts` | `bboxCenter`, `greatCircle`, `daysUntil` |
| `src/lib/map/cities.ts` | `loadCities`, `searchCities`, `cityId` |
| `src/lib/map/meta.ts` | Typed access to `countries.json` (`COUNTRIES`, `countryByIso`, `KNOWN_ISO`) |
| `src/lib/map/mapView.ts` | `MapView` class around MapLibre |
| `src/styles/global.css` | `--map-*` color tokens (light + dark) |
| `src/components/map/ui.ts` | Shared Tailwind class strings + status labels |
| `src/components/map/Swatch.tsx` | Small color square for legends |
| `src/components/map/CountryPicker.tsx` | Keyboard-accessible country `<select>` |
| `src/components/map/CityList.tsx` | Cities of the selected country |
| `src/components/map/Postcard.tsx` | Message, images, countdown on an invite |
| `src/components/map/share.ts`, `format.ts` | Share/copy helper, country list formatting |
| `src/components/map/useMapView.ts` | Hook that creates/destroys a `MapView` for a container ref |
| `src/components/map/TravelMap.tsx` | `/projects/map` shell |
| `src/components/map/CountryPanel.tsx` | Selected country editor |
| `src/components/map/CitySearch.tsx` | City search + custom pin trigger |
| `src/components/map/StatsStrip.tsx` | Counts, N/195, continents, badges |
| `src/components/map/ImportExport.tsx` | Download / upload JSON, clear |
| `src/components/map/KimMap.tsx` | `/projects/map/kim` shell (timeline + compare + "start my own") |
| `src/components/map/TimelineSlider.tsx` | Year slider |
| `src/components/map/CompareToggle.tsx` | 4-bucket legend with counts |
| `src/components/map/InviteBuilder.tsx` | Build + share an invite link |
| `src/components/map/InvitePage.tsx` | Reads the hash, picks `InviteView` / `ReplyView` / broken screen |
| `src/components/map/InviteView.tsx` | Globe intro, postcard, countdown, "I'm in", compare, make my own |
| `src/components/map/ReplyView.tsx` | Shows a friend's reply |
| `src/pages/projects/map/index.astro` | Mounts `TravelMap` |
| `src/pages/projects/map/kim.astro` | Mounts `KimMap` with `travel.json` |
| `src/pages/projects/map/invite.astro` | Mounts `InvitePage` |
| `src/data/travel.json` | Kim's map |
| `src/content/projects/travel-map/index.md` | Project write-up |

Tests live next to the code: `src/lib/map/*.test.ts`.

---

### Task 1: Tooling (Preact, Vitest, deps, ESLint)

**Files:**
- Modify: `package.json`, `astro.config.mjs`, `tsconfig.json`
- Create: `vitest.config.ts`, `.eslintrc.cjs`, `src/lib/map/smoke.test.ts` (deleted at the end of the task)

**Interfaces:**
- Produces: `npm test` (= `vitest run`), Preact JSX for `.tsx` files, `@lib/...` aliases working in tests.

- [ ] **Step 1: Install dependencies**

```bash
npm install
npx astro add preact --yes
npm install maplibre-gl@^5 lz-string@^1.5
npm install -D vitest@^3 mapshaper
```

`astro add preact` adds `preact()` to `integrations` in `astro.config.mjs` and sets `"jsx": "react-jsx", "jsxImportSource": "preact"` in `tsconfig.json`. Check both files afterwards; if either edit is missing, add it by hand:

```js
// astro.config.mjs
import preact from "@astrojs/preact";
// ...
integrations: [mdx(), sitemap(), tailwind(), preact()],
```

```json
// tsconfig.json compilerOptions
"jsx": "react-jsx",
"jsxImportSource": "preact"
```

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Write a smoke test that proves aliases + zod resolve**

`src/lib/map/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { z } from "astro/zod";
import { cn } from "@lib/utils";

describe("tooling", () => {
  it("resolves aliases and zod", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(z.string().safeParse("x").success).toBe(true);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Add `.eslintrc.cjs`** (there is no ESLint config in the repo, so `npm run lint` currently fails with "No ESLint configuration found")

```js
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint", "jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:astro/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
  },
  overrides: [
    { files: ["*.ts", "*.tsx"] }, // ESLint 8 only lints .js by default; this opts TS files in
    {
      files: ["*.astro"],
      parser: "astro-eslint-parser",
      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".astro"],
      },
    },
  ],
  ignorePatterns: ["dist/", ".astro/", "public/", "node_modules/"],
};
```

- [ ] **Step 7: Run lint and build on the untouched site**

Run: `npm run lint && npm run build`
Expected: both succeed. If lint reports errors in **pre-existing** files, do not fix them here; note them in the checkpoint and ask Kim whether to fix or relax rules.

- [ ] **Step 8: Delete `src/lib/map/smoke.test.ts`**

- [ ] **Checkpoint:** report changed files; wait for Kim.

### Task 2: Data model (`data.ts`)

**Files:**
- Create: `src/lib/map/data.ts`
- Test: `src/lib/map/data.test.ts`

**Interfaces:**
- Produces:
  - `type ISO3 = string`, `STATUSES`, `type Status = "visited" | "lived" | "want"`
  - `type CountryEntry = { status: Status; years?: number[]; note?: string }`
  - `type City = { id; name; country; lat; lon; status: "visited" | "want"; year?; note?; photo?; custom? }`
  - `type TravelData = { version: 1; countries: Record<ISO3, CountryEntry>; cities: City[] }`
  - `travelDataSchema`, `iso3Schema`
  - `emptyData(): TravelData`
  - `migrate(raw: unknown): unknown` (adds `version: 1` to pre-version objects)
  - `dropUnknown(data: TravelData, known: ReadonlySet<string>): { data: TravelData; unknown: ISO3[] }`
  - `isHttpsUrl(s: string): boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/map/data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  travelDataSchema, emptyData, migrate, dropUnknown, isHttpsUrl, type TravelData,
} from "./data";

const sample: TravelData = {
  version: 1,
  countries: {
    JPN: { status: "visited", years: [2019, 2023], note: "Ramen" },
    BRA: { status: "lived" },
    ISL: { status: "want" },
  },
  cities: [
    { id: "jpn-tokyo", name: "Tokyo", country: "JPN", lat: 35.68, lon: 139.69, status: "visited", year: 2019 },
  ],
};

describe("travelDataSchema", () => {
  it("accepts a valid document", () => {
    expect(travelDataSchema.safeParse(sample).success).toBe(true);
  });
  it("accepts the empty document", () => {
    expect(travelDataSchema.safeParse(emptyData()).success).toBe(true);
  });
  it("rejects an unknown status", () => {
    const bad = { ...sample, countries: { JPN: { status: "dreamed" } } };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects years given as strings", () => {
    const bad = { ...sample, countries: { JPN: { status: "visited", years: ["2019"] } } };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects lowercase or wrong-length country ids", () => {
    expect(travelDataSchema.safeParse({ ...sample, countries: { jpn: { status: "visited" } } }).success).toBe(false);
    expect(travelDataSchema.safeParse({ ...sample, countries: { JP: { status: "visited" } } }).success).toBe(false);
  });
  it("rejects out-of-range coordinates", () => {
    const bad = { ...sample, cities: [{ ...sample.cities[0], lat: 91 }] };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a non-https city photo", () => {
    const bad = { ...sample, cities: [{ ...sample.cities[0], photo: "http://x.com/a.jpg" }] };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
});

describe("migrate", () => {
  it("adds version 1 to an object without a version", () => {
    const { version: _v, ...old } = sample;
    const migrated = migrate(old);
    expect(travelDataSchema.safeParse(migrated).success).toBe(true);
  });
  it("adds a missing cities array", () => {
    expect(travelDataSchema.safeParse(migrate({ countries: {} })).success).toBe(true);
  });
  it("leaves non-objects alone", () => {
    expect(migrate("nope")).toBe("nope");
    expect(migrate(null)).toBe(null);
  });
});

describe("dropUnknown", () => {
  it("removes countries and cities with unknown ids and reports them once", () => {
    const data: TravelData = {
      version: 1,
      countries: { JPN: { status: "visited" }, XXX: { status: "want" } },
      cities: [
        { id: "a", name: "A", country: "XXX", lat: 0, lon: 0, status: "want" },
        { id: "b", name: "B", country: "JPN", lat: 0, lon: 0, status: "want" },
      ],
    };
    const { data: out, unknown } = dropUnknown(data, new Set(["JPN"]));
    expect(Object.keys(out.countries)).toEqual(["JPN"]);
    expect(out.cities.map((c) => c.id)).toEqual(["b"]);
    expect(unknown).toEqual(["XXX"]);
  });
});

describe("isHttpsUrl", () => {
  it.each([
    ["https://example.com/a.jpg", true],
    ["http://example.com/a.jpg", false],
    ["javascript:alert(1)", false],
    ["data:image/png;base64,AAAA", false],
    ["not a url", false],
    ["", false],
  ])("%s → %s", (input, expected) => {
    expect(isHttpsUrl(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/map/data.test.ts`
Expected: FAIL, cannot resolve `./data`.

- [ ] **Step 3: Implement `src/lib/map/data.ts`**

```ts
import { z } from "astro/zod";

export type ISO3 = string;
export const STATUSES = ["visited", "lived", "want"] as const;
export type Status = (typeof STATUSES)[number];

export function isHttpsUrl(s: string): boolean {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

export const iso3Schema = z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter uppercase country code");
const yearSchema = z.number().int().min(1900).max(2100);
const noteSchema = z.string().max(2000);

export const countryEntrySchema = z.object({
  status: z.enum(STATUSES),
  years: z.array(yearSchema).optional(),
  note: noteSchema.optional(),
});

export const citySchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  country: iso3Schema,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  status: z.enum(["visited", "want"]),
  year: yearSchema.optional(),
  note: noteSchema.optional(),
  photo: z.string().refine(isHttpsUrl, "must be an https URL").optional(),
  custom: z.boolean().optional(),
});

export const travelDataSchema = z.object({
  version: z.literal(1),
  countries: z.record(iso3Schema, countryEntrySchema),
  cities: z.array(citySchema),
});

export type CountryEntry = z.infer<typeof countryEntrySchema>;
export type City = z.infer<typeof citySchema>;
export type TravelData = z.infer<typeof travelDataSchema>;

export function emptyData(): TravelData {
  return { version: 1, countries: {}, cities: [] };
}

/** Bring older or hand-written documents up to the current shape before validating. */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  return {
    ...obj,
    version: obj.version ?? 1,
    cities: obj.cities ?? [],
  };
}

export function dropUnknown(
  data: TravelData,
  known: ReadonlySet<string>,
): { data: TravelData; unknown: ISO3[] } {
  const unknown = new Set<ISO3>();
  const countries: TravelData["countries"] = {};
  for (const [iso, entry] of Object.entries(data.countries)) {
    if (known.has(iso)) countries[iso] = entry;
    else unknown.add(iso);
  }
  const cities = data.cities.filter((c) => {
    if (known.has(c.country)) return true;
    unknown.add(c.country);
    return false;
  });
  return { data: { ...data, countries, cities }, unknown: [...unknown] };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/map/data.test.ts`
Expected: all pass.

- [ ] **Checkpoint:** wait for Kim.

### Task 3: Storage + import/export (`storage.ts`)

**Files:**
- Create: `src/lib/map/storage.ts`
- Test: `src/lib/map/storage.test.ts`

**Interfaces:**
- Consumes: `travelDataSchema`, `emptyData`, `migrate`, `dropUnknown`, `TravelData` from `./data`.
- Produces:
  - `STORAGE_KEY = "travel-map:v1"`
  - `interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }`
  - `createStore(storage?: StorageLike | null): Store` where `Store = { load(): TravelData; save(d: TravelData): void; clear(): void; isPersistent(): boolean }`
  - `exportJson(d: TravelData): string`
  - `type ImportResult = { ok: true; data: TravelData; warnings: string[] } | { ok: false; errors: string[] }`
  - `importJson(text: string, known: ReadonlySet<string>): ImportResult`
  - `downloadJson(d: TravelData, filename?: string): void` (browser only, not unit-tested)

- [ ] **Step 1: Write the failing tests**

`src/lib/map/storage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createStore, exportJson, importJson, STORAGE_KEY, type StorageLike } from "./storage";
import { emptyData, type TravelData } from "./data";

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const throwing: StorageLike = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("QuotaExceededError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};

const data: TravelData = { version: 1, countries: { JPN: { status: "visited" } }, cities: [] };
const known = new Set(["JPN", "BRA"]);

describe("createStore", () => {
  it("round-trips through storage", () => {
    const s = memoryStorage();
    createStore(s).save(data);
    expect(createStore(s).load()).toEqual(data);
  });

  it("returns empty data when nothing is stored", () => {
    expect(createStore(memoryStorage()).load()).toEqual(emptyData());
  });

  it("falls back to memory when storage throws, and says so", () => {
    const store = createStore(throwing);
    expect(store.load()).toEqual(emptyData());
    store.save(data);
    expect(store.load()).toEqual(data);
    expect(store.isPersistent()).toBe(false);
  });

  it("falls back to memory when there is no storage at all", () => {
    const store = createStore(null);
    store.save(data);
    expect(store.load()).toEqual(data);
    expect(store.isPersistent()).toBe(false);
  });

  it("keeps corrupt stored data aside instead of silently losing it", () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, "{not json");
    expect(createStore(s).load()).toEqual(emptyData());
    expect(s.map.get(`${STORAGE_KEY}:corrupt`)).toBe("{not json");
  });

  it("clear removes the stored document", () => {
    const s = memoryStorage();
    const store = createStore(s);
    store.save(data);
    store.clear();
    expect(store.load()).toEqual(emptyData());
  });
});

describe("importJson", () => {
  it("accepts its own export", () => {
    const r = importJson(exportJson(data), known);
    expect(r).toEqual({ ok: true, data, warnings: [] });
  });

  it("rejects text that is not JSON", () => {
    const r = importJson("hello", known);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/not valid JSON/i);
  });

  it("reports per-field errors with their path", () => {
    const r = importJson(JSON.stringify({ version: 1, countries: { JPN: { status: "visited", years: ["2019"] } }, cities: [] }), known);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("countries.JPN.years.0"))).toBe(true);
  });

  it("migrates a document without a version", () => {
    const r = importJson(JSON.stringify({ countries: { BRA: { status: "lived" } } }), known);
    expect(r.ok).toBe(true);
  });

  it("drops unknown countries and warns", () => {
    const r = importJson(JSON.stringify({ version: 1, countries: { JPN: { status: "visited" }, ZZZ: { status: "want" } }, cities: [] }), known);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.data.countries)).toEqual(["JPN"]);
      expect(r.warnings[0]).toMatch(/ZZZ/);
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/map/storage.test.ts`
Expected: FAIL, cannot resolve `./storage`.

- [ ] **Step 3: Implement `src/lib/map/storage.ts`**

```ts
import { dropUnknown, emptyData, migrate, travelDataSchema, type TravelData } from "./data";

export const STORAGE_KEY = "travel-map:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Store {
  load(): TravelData;
  save(data: TravelData): void;
  clear(): void;
  isPersistent(): boolean;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createStore(storage: StorageLike | null = browserStorage()): Store {
  let memory: TravelData | null = null;
  let persistent = storage !== null;

  return {
    load() {
      if (memory) return memory;
      if (!storage) return emptyData();
      let raw: string | null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        persistent = false;
        return emptyData();
      }
      if (raw === null) return emptyData();
      try {
        const parsed = travelDataSchema.safeParse(migrate(JSON.parse(raw)));
        if (parsed.success) return (memory = parsed.data);
      } catch {
        // fall through to the corrupt path
      }
      try {
        storage.setItem(`${STORAGE_KEY}:corrupt`, raw);
      } catch {
        // nothing else we can do
      }
      return emptyData();
    },
    save(data) {
      memory = data;
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        persistent = false;
      }
    },
    clear() {
      memory = null;
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        persistent = false;
      }
    },
    isPersistent: () => persistent,
  };
}

export function exportJson(data: TravelData): string {
  return JSON.stringify(data, null, 2);
}

export type ImportResult =
  | { ok: true; data: TravelData; warnings: string[] }
  | { ok: false; errors: string[] };

export function importJson(text: string, known: ReadonlySet<string>): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  const parsed = travelDataSchema.safeParse(migrate(raw));
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const { data, unknown } = dropUnknown(parsed.data, known);
  const warnings = unknown.length ? [`Ignored unknown country codes: ${unknown.join(", ")}`] : [];
  return { ok: true, data, warnings };
}

export function downloadJson(data: TravelData, filename = "travel-map.json"): void {
  const blob = new Blob([exportJson(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/map/storage.test.ts`
Expected: all pass.

- [ ] **Checkpoint:** wait for Kim.

### Task 4: Invite / reply codec (`invite.ts`)

**Files:**
- Create: `src/lib/map/invite.ts`
- Test: `src/lib/map/invite.test.ts`

**Interfaces:**
- Consumes: `iso3Schema`, `isHttpsUrl`, `ISO3` from `./data`.
- Produces:
  - `MAX_STOPS = 10`, `MAX_IMAGES = 6`, `MAX_MESSAGE = 1000`
  - `type Invite = { v: 1; from?: string; stops: ISO3[]; message?: string; images?: string[]; date?: string /* YYYY-MM-DD */; visited?: ISO3[] }`
  - `type Reply = { v: 1; from?: string; stops: ISO3[]; message?: string }`
  - `type Decoded<T> = { value: T; unknown: ISO3[] }`
  - `encodeInvite(i: Invite): string`, `decodeInvite(s: string, known: ReadonlySet<string>): Decoded<Invite> | null`
  - `encodeReply(r: Reply): string`, `decodeReply(s: string, known: ReadonlySet<string>): Decoded<Reply> | null`
  - `parseHash(hash: string): { kind: "invite" | "reply"; payload: string } | null`
  - `inviteUrl(origin: string, i: Invite): string`, `replyUrl(origin: string, r: Reply): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/map/invite.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import {
  encodeInvite, decodeInvite, encodeReply, decodeReply, parseHash, inviteUrl, replyUrl,
  MAX_IMAGES, MAX_MESSAGE, type Invite,
} from "./invite";

const known = new Set(["JPN", "KOR", "BRA", "PRT"]);
const base: Invite = { v: 1, from: "Kim", stops: ["JPN"], message: "Let's go!", date: "2027-04-01" };
const raw = (obj: unknown) => LZString.compressToEncodedURIComponent(JSON.stringify(obj));

describe("invite round-trip", () => {
  it("round-trips a simple invite", () => {
    expect(decodeInvite(encodeInvite(base), known)).toEqual({ value: base, unknown: [] });
  });

  it("round-trips unicode and emoji", () => {
    const inv = { ...base, from: "Kîm 金", message: "Vamos pro Japão! 🇯🇵 日本へ行こう" };
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });

  it("round-trips a message at the maximum length", () => {
    // 🌏 is 2 UTF-16 code units, so each repeat is 3 units long
    const inv = { ...base, message: "ã🌏".repeat(Math.floor(MAX_MESSAGE / 3)) };
    expect(inv.message.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });

  it("round-trips multiple stops and visited", () => {
    const inv = { ...base, stops: ["JPN", "KOR"], visited: ["BRA", "PRT"] };
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });

  it("produces URL-safe output", () => {
    expect(encodeInvite(base)).toMatch(/^[A-Za-z0-9+\-$]+$/);
  });
});

describe("decodeInvite rejects bad input", () => {
  it.each([
    ["empty", ""],
    ["garbage", "%%%not-lz%%%"],
    ["lz but not JSON", LZString.compressToEncodedURIComponent("not json {")],
    ["wrong version", raw({ ...base, v: 2 })],
    ["no stops", raw({ ...base, stops: [] })],
    ["stops not an array", raw({ ...base, stops: "JPN" })],
    ["message too long", raw({ ...base, message: "x".repeat(MAX_MESSAGE + 1) })],
    ["bad date", raw({ ...base, date: "next spring" })],
  ])("%s → null", (_label, input) => {
    expect(decodeInvite(input, known)).toBeNull();
  });

  it("returns null when every stop is unknown", () => {
    expect(decodeInvite(raw({ ...base, stops: ["ZZZ"] }), known)).toBeNull();
  });
});

describe("decodeInvite sanitizes", () => {
  it("drops unknown stops and visited codes and reports them", () => {
    const r = decodeInvite(raw({ ...base, stops: ["JPN", "ZZZ"], visited: ["BRA", "YYY"] }), known);
    expect(r?.value.stops).toEqual(["JPN"]);
    expect(r?.value.visited).toEqual(["BRA"]);
    expect(r?.unknown.sort()).toEqual(["YYY", "ZZZ"]);
  });

  it("keeps only https images and caps them", () => {
    const images = [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "http://example.com/a.jpg",
      ...Array.from({ length: 10 }, (_, i) => `https://example.com/${i}.jpg`),
    ];
    const r = decodeInvite(raw({ ...base, images }), known);
    expect(r?.value.images).toHaveLength(MAX_IMAGES);
    expect(r?.value.images?.every((u) => u.startsWith("https://"))).toBe(true);
  });
});

describe("reply", () => {
  it("round-trips", () => {
    const reply = { v: 1 as const, from: "Ana", stops: ["JPN"], message: "I'm in! 🎉" };
    expect(decodeReply(encodeReply(reply), known)).toEqual({ value: reply, unknown: [] });
  });
  it("rejects garbage", () => {
    expect(decodeReply("nope", known)).toBeNull();
  });
});

describe("parseHash", () => {
  it("reads invites and replies", () => {
    expect(parseHash("#i=abc")).toEqual({ kind: "invite", payload: "abc" });
    expect(parseHash("#r=xyz")).toEqual({ kind: "reply", payload: "xyz" });
  });
  it.each(["", "#", "#i=", "#x=abc", "i=abc"])("%j → null", (h) => {
    expect(parseHash(h)).toBeNull();
  });
});

describe("urls", () => {
  it("builds invite and reply URLs that parse back", () => {
    const u = new URL(inviteUrl("https://www.kakeya.kim", base));
    expect(u.pathname).toBe("/projects/map/invite");
    expect(parseHash(u.hash)?.kind).toBe("invite");
    const r = new URL(replyUrl("https://www.kakeya.kim", { v: 1, stops: ["JPN"] }));
    expect(parseHash(r.hash)?.kind).toBe("reply");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/map/invite.test.ts`
Expected: FAIL, cannot resolve `./invite`.

- [ ] **Step 3: Implement `src/lib/map/invite.ts`**

```ts
import LZString from "lz-string";
import { z } from "astro/zod";
import { iso3Schema, isHttpsUrl, type ISO3 } from "./data";

export const MAX_STOPS = 10;
export const MAX_IMAGES = 6;
export const MAX_MESSAGE = 1000;

const fromSchema = z.string().max(80);
const stopsSchema = z.array(iso3Schema).min(1).max(MAX_STOPS);
const messageSchema = z.string().max(MAX_MESSAGE);

export const inviteSchema = z.object({
  v: z.literal(1),
  from: fromSchema.optional(),
  stops: stopsSchema,
  message: messageSchema.optional(),
  images: z.array(z.string()).max(50).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  visited: z.array(iso3Schema).max(300).optional(),
});

export const replySchema = z.object({
  v: z.literal(1),
  from: fromSchema.optional(),
  stops: stopsSchema,
  message: messageSchema.optional(),
});

export type Invite = z.infer<typeof inviteSchema>;
export type Reply = z.infer<typeof replySchema>;
export type Decoded<T> = { value: T; unknown: ISO3[] };

function encode(obj: unknown): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(obj));
}

function decodeRaw(s: string): unknown {
  if (!s) return undefined;
  try {
    const json = LZString.decompressFromEncodedURIComponent(s);
    return json ? JSON.parse(json) : undefined;
  } catch {
    return undefined;
  }
}

function keepKnown(list: ISO3[], known: ReadonlySet<string>, unknown: Set<ISO3>): ISO3[] {
  return list.filter((iso) => (known.has(iso) ? true : (unknown.add(iso), false)));
}

export const encodeInvite = (i: Invite): string => encode(i);
export const encodeReply = (r: Reply): string => encode(r);

export function decodeInvite(s: string, known: ReadonlySet<string>): Decoded<Invite> | null {
  const parsed = inviteSchema.safeParse(decodeRaw(s));
  if (!parsed.success) return null;
  const unknown = new Set<ISO3>();
  const v = parsed.data;
  const stops = keepKnown(v.stops, known, unknown);
  if (stops.length === 0) return null;
  const value: Invite = { ...v, stops };
  if (v.visited) value.visited = keepKnown(v.visited, known, unknown);
  if (v.images) value.images = v.images.filter(isHttpsUrl).slice(0, MAX_IMAGES);
  return { value, unknown: [...unknown] };
}

export function decodeReply(s: string, known: ReadonlySet<string>): Decoded<Reply> | null {
  const parsed = replySchema.safeParse(decodeRaw(s));
  if (!parsed.success) return null;
  const unknown = new Set<ISO3>();
  const stops = keepKnown(parsed.data.stops, known, unknown);
  if (stops.length === 0) return null;
  return { value: { ...parsed.data, stops }, unknown: [...unknown] };
}

export function parseHash(hash: string): { kind: "invite" | "reply"; payload: string } | null {
  const m = /^#([ir])=(.+)$/.exec(hash);
  if (!m) return null;
  return { kind: m[1] === "i" ? "invite" : "reply", payload: m[2] };
}

export const inviteUrl = (origin: string, i: Invite): string =>
  `${origin}/projects/map/invite#i=${encodeInvite(i)}`;
export const replyUrl = (origin: string, r: Reply): string =>
  `${origin}/projects/map/invite#r=${encodeReply(r)}`;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/map/invite.test.ts`
Expected: all pass. If the "URL-safe output" regex fails, check the lz-string alphabet (`A-Za-z0-9+-$`) and adjust the test's character class, not the encoder.

- [ ] **Checkpoint:** wait for Kim.

### Task 5: Geo math + stats (`geo.ts`, `stats.ts`)

**Files:**
- Create: `src/lib/map/geo.ts`, `src/lib/map/stats.ts`
- Test: `src/lib/map/geo.test.ts`, `src/lib/map/stats.test.ts`

**Interfaces:**
- Consumes: `TravelData`, `ISO3`, `Status`, `STATUSES` from `./data`.
- Produces (`geo.ts`):
  - `type LonLat = [number, number]`, `type BBox = [west, south, east, north]`
  - `bboxCenter(b: BBox): LonLat`
  - `greatCircle(a: LonLat, b: LonLat, steps?: number): LonLat[]` (longitudes unwrapped, no ±360 jumps)
  - `daysUntil(date: string, now: Date): number | null`
- Produces (`stats.ts`):
  - `TOTAL_COUNTRIES = 195`
  - `interface CountryMeta { iso: ISO3; name: string; continent: string; bbox: BBox }`
  - `type ColorKey = Status | "both" | "onlyA" | "onlyB" | "stop"`
  - `counts(d): Record<Status, number>`, `beenTo(d): ISO3[]` (visited or lived, sorted)
  - `interface ContinentProgress { continent: string; been: number; total: number }`
  - `continentProgress(d, meta: CountryMeta[]): ContinentProgress[]`
  - `badges(d, meta): string[]`
  - `yearRange(d): [number, number] | null`
  - `atYear(d, year: number): TravelData`
  - `interface Comparison { both: ISO3[]; onlyA: ISO3[]; onlyB: ISO3[] }`, `compare(a: readonly ISO3[], b: readonly ISO3[]): Comparison`
  - `statusColors(d): Record<ISO3, ColorKey>`, `comparisonColors(c: Comparison): Record<ISO3, ColorKey>`

- [ ] **Step 1: Write the failing geo tests**

`src/lib/map/geo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bboxCenter, greatCircle, daysUntil } from "./geo";

describe("bboxCenter", () => {
  it("returns the middle of the box", () => {
    expect(bboxCenter([0, 0, 10, 20])).toEqual([5, 10]);
  });
});

describe("greatCircle", () => {
  it("starts and ends at the endpoints", () => {
    const line = greatCircle([-46.6, -23.5], [139.7, 35.7], 32);
    expect(line).toHaveLength(33);
    expect(line[0][0]).toBeCloseTo(-46.6);
    expect(line[0][1]).toBeCloseTo(-23.5);
    expect(line[32][1]).toBeCloseTo(35.7);
  });

  it("passes through the midpoint on the equator", () => {
    const mid = greatCircle([0, 0], [90, 0], 2)[1];
    expect(mid[0]).toBeCloseTo(45);
    expect(mid[1]).toBeCloseTo(0);
  });

  it("does not jump across the antimeridian", () => {
    const line = greatCircle([139.7, 35.7], [-122.4, 37.8]); // Tokyo → San Francisco
    for (let i = 1; i < line.length; i++) {
      expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180);
    }
  });

  it("handles identical and antipodal points without NaN", () => {
    expect(greatCircle([10, 10], [10, 10])).toEqual([[10, 10], [10, 10]]);
    const anti = greatCircle([0, 0], [180, 0]);
    expect(anti.flat().every(Number.isFinite)).toBe(true);
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 8, 26, 23, 30); // 26 Sep 2026, late evening local time
  it("counts calendar days ahead", () => {
    expect(daysUntil("2026-10-01", now)).toBe(5);
  });
  it("is 0 on the day itself", () => {
    expect(daysUntil("2026-09-26", now)).toBe(0);
  });
  it("is negative in the past", () => {
    expect(daysUntil("2026-09-20", now)).toBe(-6);
  });
  it("returns null for bad dates", () => {
    expect(daysUntil("2026-13-40", now)).toBeNull();
    expect(daysUntil("soon", now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/lib/map/geo.test.ts`
Expected: FAIL, cannot resolve `./geo`.

- [ ] **Step 3: Implement `src/lib/map/geo.ts`**

```ts
export type LonLat = [number, number];
/** [west, south, east, north] */
export type BBox = [number, number, number, number];

const RAD = Math.PI / 180;

export function bboxCenter([w, s, e, n]: BBox): LonLat {
  return [(w + e) / 2, (s + n) / 2];
}

/** Points along the great circle from a to b, with longitudes unwrapped so lines don't jump at ±180. */
export function greatCircle(a: LonLat, b: LonLat, steps = 64): LonLat[] {
  const [l1, p1] = [a[0] * RAD, a[1] * RAD];
  const [l2, p2] = [b[0] * RAD, b[1] * RAD];
  const d =
    2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (Math.sin(d) < 1e-9) return [a, b]; // same point or antipodal: no unique great circle

  const out: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD]);
  }
  for (let i = 1; i < out.length; i++) {
    while (out[i][0] - out[i - 1][0] > 180) out[i][0] -= 360;
    while (out[i][0] - out[i - 1][0] < -180) out[i][0] += 360;
  }
  return out;
}

/** Whole calendar days from `now` (local) to a YYYY-MM-DD date. */
export function daysUntil(date: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const target = new Date(Date.UTC(y, mo, d));
  if (target.getUTCMonth() !== mo || target.getUTCDate() !== d) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today) / 86_400_000);
}
```

- [ ] **Step 4: Run geo tests**

Run: `npx vitest run src/lib/map/geo.test.ts`
Expected: all pass.

- [ ] **Step 5: Write the failing stats tests**

`src/lib/map/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  counts, beenTo, continentProgress, badges, yearRange, atYear, compare,
  statusColors, comparisonColors, type CountryMeta,
} from "./stats";
import type { TravelData } from "./data";

const meta: CountryMeta[] = [
  { iso: "BRA", name: "Brazil", continent: "South America", bbox: [0, 0, 1, 1] },
  { iso: "ARG", name: "Argentina", continent: "South America", bbox: [0, 0, 1, 1] },
  { iso: "JPN", name: "Japan", continent: "Asia", bbox: [0, 0, 1, 1] },
  { iso: "KOR", name: "South Korea", continent: "Asia", bbox: [0, 0, 1, 1] },
  { iso: "ATA", name: "Antarctica", continent: "Antarctica", bbox: [0, 0, 1, 1] },
];

const d: TravelData = {
  version: 1,
  countries: {
    BRA: { status: "lived", years: [2000] },
    ARG: { status: "visited", years: [2015, 2010] },
    JPN: { status: "visited", years: [2023] },
    KOR: { status: "want" },
  },
  cities: [
    { id: "a", name: "Tokyo", country: "JPN", lat: 0, lon: 0, status: "visited", year: 2023 },
    { id: "b", name: "Seoul", country: "KOR", lat: 0, lon: 0, status: "want" },
  ],
};

describe("counts / beenTo", () => {
  it("counts each status", () => {
    expect(counts(d)).toEqual({ visited: 2, lived: 1, want: 1 });
  });
  it("beenTo is visited + lived, sorted", () => {
    expect(beenTo(d)).toEqual(["ARG", "BRA", "JPN"]);
  });
});

describe("continentProgress / badges", () => {
  it("counts been-to per continent and skips Antarctica", () => {
    expect(continentProgress(d, meta)).toEqual([
      { continent: "Asia", been: 1, total: 2 },
      { continent: "South America", been: 2, total: 2 },
    ]);
  });
  it("awards a badge for a completed continent", () => {
    expect(badges(d, meta)).toContain("Every country in South America");
    expect(badges(d, meta)).not.toContain("Every country in Asia");
  });
  it("awards milestone badges", () => {
    const many: TravelData = { version: 1, cities: [], countries: {} };
    for (let i = 0; i < 10; i++) many.countries[`A${String.fromCharCode(65 + i)}A`] = { status: "visited" };
    expect(badges(many, meta)).toContain("10 countries");
  });
});

describe("timeline", () => {
  it("yearRange covers country and city years", () => {
    expect(yearRange(d)).toEqual([2000, 2023]);
  });
  it("yearRange is null without years", () => {
    expect(yearRange({ version: 1, countries: { BRA: { status: "visited" } }, cities: [] })).toBeNull();
  });
  it("atYear keeps places first reached on or before the year, never wishes", () => {
    const at = atYear(d, 2012);
    expect(Object.keys(at.countries).sort()).toEqual(["ARG", "BRA"]);
    expect(at.cities).toEqual([]);
    expect(Object.keys(atYear(d, 2023).countries).sort()).toEqual(["ARG", "BRA", "JPN"]);
    expect(atYear(d, 2023).cities.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("compare", () => {
  it("splits into both / onlyA / onlyB", () => {
    expect(compare(["BRA", "JPN"], ["JPN", "PRT"])).toEqual({ both: ["JPN"], onlyA: ["BRA"], onlyB: ["PRT"] });
  });
  it("comparisonColors maps each bucket", () => {
    expect(comparisonColors({ both: ["JPN"], onlyA: ["BRA"], onlyB: ["PRT"] })).toEqual({
      JPN: "both", BRA: "onlyA", PRT: "onlyB",
    });
  });
});

describe("statusColors", () => {
  it("maps each country to its status", () => {
    expect(statusColors(d)).toEqual({ BRA: "lived", ARG: "visited", JPN: "visited", KOR: "want" });
  });
});
```

- [ ] **Step 6: Run to confirm failure**

Run: `npx vitest run src/lib/map/stats.test.ts`
Expected: FAIL, cannot resolve `./stats`.

- [ ] **Step 7: Implement `src/lib/map/stats.ts`**

```ts
import { STATUSES, type ISO3, type Status, type TravelData } from "./data";
import type { BBox } from "./geo";

export const TOTAL_COUNTRIES = 195;

export interface CountryMeta { iso: ISO3; name: string; continent: string; bbox: BBox }
export type ColorKey = Status | "both" | "onlyA" | "onlyB" | "stop";

const IGNORED_CONTINENTS = new Set(["Antarctica", "Seven seas (open ocean)"]);
const MILESTONES = [10, 25, 50, 100];

export function counts(d: TravelData): Record<Status, number> {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const { status } of Object.values(d.countries)) out[status]++;
  return out;
}

export function beenTo(d: TravelData): ISO3[] {
  return Object.entries(d.countries)
    .filter(([, e]) => e.status !== "want")
    .map(([iso]) => iso)
    .sort();
}

export interface ContinentProgress { continent: string; been: number; total: number }

export function continentProgress(d: TravelData, meta: CountryMeta[]): ContinentProgress[] {
  const been = new Set(beenTo(d));
  const byContinent = new Map<string, ContinentProgress>();
  for (const m of meta) {
    if (IGNORED_CONTINENTS.has(m.continent)) continue;
    const p = byContinent.get(m.continent) ?? { continent: m.continent, been: 0, total: 0 };
    p.total++;
    if (been.has(m.iso)) p.been++;
    byContinent.set(m.continent, p);
  }
  return [...byContinent.values()].sort((a, b) => a.continent.localeCompare(b.continent));
}

export function badges(d: TravelData, meta: CountryMeta[]): string[] {
  const n = beenTo(d).length;
  return [
    ...MILESTONES.filter((m) => n >= m).map((m) => `${m} countries`),
    ...continentProgress(d, meta)
      .filter((p) => p.total > 0 && p.been === p.total)
      .map((p) => `Every country in ${p.continent}`),
  ];
}

export function yearRange(d: TravelData): [number, number] | null {
  const years = [
    ...Object.values(d.countries).flatMap((e) => e.years ?? []),
    ...d.cities.flatMap((c) => (c.year === undefined ? [] : [c.year])),
  ];
  return years.length ? [Math.min(...years), Math.max(...years)] : null;
}

/** The map as it looked at the end of `year`: places first reached by then. Wishes and undated places are left out. */
export function atYear(d: TravelData, year: number): TravelData {
  const countries: TravelData["countries"] = {};
  for (const [iso, e] of Object.entries(d.countries)) {
    if (e.status !== "want" && e.years?.length && Math.min(...e.years) <= year) countries[iso] = e;
  }
  const cities = d.cities.filter((c) => c.status === "visited" && c.year !== undefined && c.year <= year);
  return { version: 1, countries, cities };
}

export interface Comparison { both: ISO3[]; onlyA: ISO3[]; onlyB: ISO3[] }

export function compare(a: readonly ISO3[], b: readonly ISO3[]): Comparison {
  const A = new Set(a);
  const B = new Set(b);
  return {
    both: [...A].filter((x) => B.has(x)),
    onlyA: [...A].filter((x) => !B.has(x)),
    onlyB: [...B].filter((x) => !A.has(x)),
  };
}

export function statusColors(d: TravelData): Record<ISO3, ColorKey> {
  return Object.fromEntries(Object.entries(d.countries).map(([iso, e]) => [iso, e.status]));
}

export function comparisonColors(c: Comparison): Record<ISO3, ColorKey> {
  return {
    ...Object.fromEntries(c.onlyA.map((iso) => [iso, "onlyA" as const])),
    ...Object.fromEntries(c.onlyB.map((iso) => [iso, "onlyB" as const])),
    ...Object.fromEntries(c.both.map((iso) => [iso, "both" as const])),
  };
}
```

- [ ] **Step 8: Run all unit tests**

Run: `npm test`
Expected: data, storage, invite, geo, stats all pass.

- [ ] **Checkpoint:** wait for Kim.

### Task 6: Geo assets (`scripts/build-geodata.mjs`)

**Files:**
- Create: `scripts/build-geodata.mjs`, `src/lib/map/meta.ts`
- Generated (committed): `public/map/countries.geojson`, `public/map/cities.json`, `src/lib/map/countries.json`
- Modify: `package.json` (add `"geodata": "node scripts/build-geodata.mjs"`)

**Interfaces:**
- Consumes: `CountryMeta` from `./stats`.
- Produces:
  - `/map/countries.geojson`: FeatureCollection, properties `{ ADM0_A3, NAME, CONTINENT }`.
  - `/map/cities.json`: `[name: string, iso3: string, lat: number, lon: number, pop: number][]`, sorted by pop desc.
  - `src/lib/map/meta.ts`: `COUNTRIES: CountryMeta[]` (sorted by name), `KNOWN_ISO: ReadonlySet<string>`, `countryByIso(iso: string): CountryMeta | undefined`, `countryName(iso: string): string` (falls back to the code).

Sources (both public domain / CC-BY; credited in the map attribution):
- `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson`
- `https://download.geonames.org/export/dump/cities15000.zip` (tab-separated; column 1 name, 4 lat, 5 lon, 8 ISO-2 country, 14 population)

- [ ] **Step 1: Write the script**

`scripts/build-geodata.mjs`:

```js
// One-off generator for the travel map's geo assets. Output is committed; CI never runs this.
// Usage: npm run geodata   (needs network + the `unzip` binary)
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import mapshaper from "mapshaper";

const NE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip";
const MIN_POP = 100_000;

const tmp = mkdtempSync(join(tmpdir(), "geodata-"));
mkdirSync("public/map", { recursive: true });

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// 1. Countries: keep 3 props, simplify, write GeoJSON.
const neFile = join(tmp, "ne.geojson");
await download(NE_URL, neFile);
await mapshaper.runCommands(
  `-i ${neFile} -filter-fields ADM0_A3,NAME,CONTINENT -simplify 15% keep-shapes ` +
    `-o public/map/countries.geojson format=geojson precision=0.001`,
);

// 2. Meta: bbox of each country's largest polygon (so Russia/Fiji/USA don't span the whole globe).
const ne = JSON.parse(readFileSync(neFile, "utf8"));
const simplified = JSON.parse(readFileSync("public/map/countries.geojson", "utf8"));

function polygons(geom) {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}
function bboxOf(rings) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of rings[0]) {
    w = Math.min(w, x); s = Math.min(s, y); e = Math.max(e, x); n = Math.max(n, y);
  }
  return [w, s, e, n];
}
const area = ([w, s, e, n]) => (e - w) * (n - s);
const round = (v) => Math.round(v * 100) / 100;

const meta = simplified.features
  .filter((f) => f.geometry)
  .map((f) => {
    const box = polygons(f.geometry).map(bboxOf).sort((a, b) => area(b) - area(a))[0];
    return { iso: f.properties.ADM0_A3, name: f.properties.NAME, continent: f.properties.CONTINENT, bbox: box.map(round) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync("src/lib/map/countries.json", JSON.stringify(meta));

// 3. Cities: GeoNames ISO-2 → Natural Earth ADM0_A3 via ISO_A2_EH (which is set even where ISO_A2 is -99).
const iso2to3 = new Map(
  ne.features
    .map((f) => [f.properties.ISO_A2_EH, f.properties.ADM0_A3])
    .filter(([iso2]) => iso2 && iso2 !== "-99"),
);
const zipFile = join(tmp, "cities.zip");
await download(GEONAMES_URL, zipFile);
const tsv = execFileSync("unzip", ["-p", zipFile, "cities15000.txt"], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");

const cities = [];
let unmapped = 0;
for (const line of tsv.split("\n")) {
  const cols = line.split("\t");
  const pop = Number(cols[14]);
  if (!(pop > MIN_POP)) continue;
  const iso3 = iso2to3.get(cols[8]);
  if (!iso3) { unmapped++; continue; }
  cities.push([cols[1], iso3, round(Number(cols[4])), round(Number(cols[5])), pop]);
}
cities.sort((a, b) => b[4] - a[4]);
writeFileSync("public/map/cities.json", JSON.stringify(cities));

console.log(`countries: ${meta.length}, cities: ${cities.length} (skipped ${unmapped} with unmapped country codes)`);
```

- [ ] **Step 2: Add the npm script and run it**

In `package.json` `scripts` add `"geodata": "node scripts/build-geodata.mjs"`, then:

Run: `npm run geodata && ls -lh public/map src/lib/map/countries.json`
Expected: a log like `countries: ~240, cities: ~4-5k`; `countries.geojson` roughly 300–600 KB, `cities.json` roughly 200–300 KB, `countries.json` roughly 20 KB. If `countries.geojson` is over ~700 KB, lower `-simplify` to `10%` and rerun.

- [ ] **Step 3: Sanity-check the data**

Run:
```bash
node -e '
const m = require("./src/lib/map/countries.json");
const by = Object.fromEntries(m.map(c => [c.iso, c]));
for (const iso of ["FRA","NOR","JPN","BRA","RUS","USA","FJI"]) console.log(iso, by[iso]?.name, by[iso]?.continent, by[iso]?.bbox);
console.log("dupes:", m.length - new Set(m.map(c => c.iso)).size);
'
```
Expected: all seven present with names; France and Norway have `FRA`/`NOR` (proves `ADM0_A3` not `ISO_A3`); Russia/USA/Fiji bboxes do not span ~-180..180; `dupes: 0`. If there are duplicates, add `-dissolve ADM0_A3 copy-fields=NAME,CONTINENT` before `-o` in the mapshaper command and rerun.

- [ ] **Step 4: Create `src/lib/map/meta.ts`**

```ts
import raw from "./countries.json";
import type { CountryMeta } from "./stats";

export const COUNTRIES = raw as CountryMeta[];
const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
export const KNOWN_ISO: ReadonlySet<string> = new Set(BY_ISO.keys());

export const countryByIso = (iso: string): CountryMeta | undefined => BY_ISO.get(iso);
export const countryName = (iso: string): string => BY_ISO.get(iso)?.name ?? iso;
```

- [ ] **Step 5: Add a test that pins the generated data**

`src/lib/map/meta.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { COUNTRIES, KNOWN_ISO, countryName } from "./meta";

describe("country meta", () => {
  it("uses ADM0_A3 so France and Norway have real codes", () => {
    expect(KNOWN_ISO.has("FRA")).toBe(true);
    expect(KNOWN_ISO.has("NOR")).toBe(true);
    expect(KNOWN_ISO.has("-99")).toBe(false);
  });
  it("has unique ids and sane bboxes", () => {
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      const [w, s, e, n] = c.bbox;
      expect(w).toBeLessThanOrEqual(e);
      expect(s).toBeLessThanOrEqual(n);
    }
  });
  it("names fall back to the code", () => {
    expect(countryName("JPN")).toBe("Japan");
    expect(countryName("ZZZ")).toBe("ZZZ");
  });
});
```

Run: `npm test`
Expected: all pass.

- [ ] **Checkpoint:** wait for Kim.

### Task 7: Color tokens, `MapView`, `useMapView`

MapLibre needs WebGL, so this task has no unit tests. It is type-checked here and verified visually in Task 8.

**Files:**
- Modify: `src/styles/global.css` (append tokens)
- Create: `src/lib/map/mapView.ts`, `src/components/map/useMapView.ts`, `src/components/map/ui.ts`, `src/components/map/Swatch.tsx`

**Interfaces:**
- Consumes: `City`, `ISO3` (`./data`); `ColorKey` (`./stats`); `bboxCenter`, `greatCircle` (`./geo`); `countryByIso` (`./meta`).
- Produces:
  - `class MapView` with `constructor({ container: HTMLElement; globe?: boolean; interactive?: boolean })`, `whenReady(): Promise<void>`, `setCountryColors(c: Record<ISO3, ColorKey>): Promise<void>`, `flyToCountry(iso: ISO3, opts?: { duration?: number }): void`, `globeIntro(iso: ISO3, spinMs?: number): Promise<void>`, `setPins(p: PinInput[]): Promise<void>`, `setArcs(stops: ISO3[]): Promise<void>`, `onCountryClick(cb: (iso: ISO3) => void): () => void`, `onMapClick(cb: (p: { lat: number; lon: number }) => void): () => void`, `destroy(): void`
  - `type PinInput = Pick<City, "id" | "name" | "lat" | "lon" | "status">`
  - `useMapView(opts: { globe?: boolean; interactive?: boolean }): { ref: RefObject<HTMLDivElement>; view: MapView | null; error: string | null }`
  - `ui.ts`: `btn`, `btnActive`, `input`, `card`, `mapBox`, `STATUS_LABEL: Record<Status, string>`
  - `Swatch.tsx`: `<Swatch color={ColorKey} />`

- [ ] **Step 1: Append color tokens to `src/styles/global.css`**

```css
/* Travel map colors (read by src/lib/map/mapView.ts; keep hex, MapLibre parses it directly) */
:root {
  --map-ocean: #e7e5e4;
  --map-land: #fafaf9;
  --map-border: #a8a29e;
  --map-visited: #0284c7;
  --map-lived: #7c3aed;
  --map-want: #d97706;
  --map-both: #059669;
  --map-onlyA: #0284c7;
  --map-onlyB: #e11d48;
  --map-stop: #e11d48;
}

html.dark {
  --map-ocean: #1c1917;
  --map-land: #44403c;
  --map-border: #78716c;
  --map-visited: #38bdf8;
  --map-lived: #a78bfa;
  --map-want: #fbbf24;
  --map-both: #34d399;
  --map-onlyA: #38bdf8;
  --map-onlyB: #fb7185;
  --map-stop: #fb7185;
}
```

- [ ] **Step 2: Create `src/lib/map/mapView.ts`**

```ts
import maplibregl, {
  type ExpressionSpecification,
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

const COLOR_KEYS: ColorKey[] = ["visited", "lived", "want", "both", "onlyA", "onlyB", "stop"];
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
  ] as ExpressionSpecification;
}
function pinColor(): ExpressionSpecification {
  return ["match", ["get", "status"], "want", token("want"), token("visited")];
}

export class MapView {
  readonly map: MLMap;
  private colored = new Set<ISO3>();
  private ready: Promise<void>;
  private themeObserver: MutationObserver;
  private cancelSpin: (() => void) | null = null;

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
          id: "pins", type: "circle", source: "pins",
          paint: { "circle-radius": 5, "circle-color": pinColor(), "circle-stroke-width": 1.5, "circle-stroke-color": token("land") },
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
    });
    if (interactive) {
      this.map.touchZoomRotate.disableRotation();
      this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    }
    this.ready = new Promise((resolve) => this.map.once("load", () => resolve()));
    this.themeObserver = new MutationObserver(() => this.applyTheme());
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  private applyTheme() {
    if (!this.map.isStyleLoaded()) return;
    this.map.setPaintProperty("background", "background-color", token("ocean"));
    this.map.setPaintProperty("country-fill", "fill-color", fillColor());
    this.map.setPaintProperty("country-line", "line-color", token("border"));
    this.map.setPaintProperty("arcs", "line-color", token("stop"));
    this.map.setPaintProperty("pins", "circle-color", pinColor());
    this.map.setPaintProperty("pins", "circle-stroke-color", token("land"));
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

  flyToCountry(iso: ISO3, { duration = 1500 }: { duration?: number } = {}): void {
    const c = countryByIso(iso);
    if (!c) return;
    const [w, s, e, n] = c.bbox;
    this.map.fitBounds([[w, s], [e, n]], { padding: 48, maxZoom: 5, duration: reducedMotion() ? 0 : duration });
  }

  /** Slow spin on the globe, then fly into the first stop. Resolves once the camera settles. */
  async globeIntro(iso: ISO3, spinMs = 3000): Promise<void> {
    await this.ready;
    if (!reducedMotion()) await this.spin(spinMs);
    const duration = 3500;
    const settled = new Promise<void>((resolve) => {
      this.map.once("moveend", () => resolve());
      setTimeout(resolve, duration + 1000); // fallback if moveend never fires
    });
    this.flyToCountry(iso, { duration });
    await settled;
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
    this.cancelSpin?.();
    this.themeObserver.disconnect();
    this.map.remove();
  }
}
```

If `astro check` rejects the `projection` expression type, cast that object `as StyleSpecification["projection"]`. If `geojson` types are missing, run `npm install -D @types/geojson`.

- [ ] **Step 3: Create `src/components/map/useMapView.ts`**

```ts
import { useEffect, useRef, useState } from "preact/hooks";
import { MapView } from "@lib/map/mapView";

export function useMapView(opts: { globe?: boolean; interactive?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let v: MapView;
    try {
      v = new MapView({ ...opts, container: ref.current });
    } catch {
      setError("Your browser can't draw the map (WebGL is unavailable).");
      return;
    }
    setView(v);
    // Runs on unmount, including ClientRouter navigations, so WebGL contexts are released.
    return () => {
      v.destroy();
      setView(null);
    };
  }, []);

  return { ref, view, error };
}
```

- [ ] **Step 4: Create `src/components/map/ui.ts` (class strings only, no JSX) and `Swatch.tsx`**

`src/components/map/ui.ts`:

```ts
import type { Status } from "@lib/map/data";

export const btn =
  "rounded border border-black/15 dark:border-white/20 px-2.5 py-1 text-sm text-black/75 dark:text-white/75 " +
  "hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none";
export const btnActive = "bg-black/10 dark:bg-white/15 text-black dark:text-white";
export const input =
  "w-full rounded border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm text-black dark:text-white";
export const card = "rounded-lg border border-black/15 dark:border-white/20 p-4";
export const mapBox =
  "h-[60vh] min-h-[320px] w-full overflow-hidden rounded-lg border border-black/15 dark:border-white/20";

export const STATUS_LABEL: Record<Status, string> = { visited: "Visited", lived: "Lived", want: "Want to go" };
```

`src/components/map/Swatch.tsx`:

```tsx
import type { ColorKey } from "@lib/map/stats";

export function Swatch({ color }: { color: ColorKey }) {
  return <span class="inline-block size-3 rounded-sm align-middle" style={{ background: `var(--map-${color})` }} aria-hidden="true" />;
}
```

- [ ] **Step 5: Type-check**

Run: `npx astro check`
Expected: 0 errors.

- [ ] **Checkpoint:** wait for Kim.

### Task 8: `/projects/map` — country panel, stats, import/export (Phase 1 ships here)

**Files:**
- Modify: `src/lib/map/data.ts` (add `parseYears`), `src/lib/map/data.test.ts`
- Create: `src/components/map/TravelMap.tsx`, `CountryPanel.tsx`, `StatsStrip.tsx`, `ImportExport.tsx`, `CountryPicker.tsx`
- Create: `src/pages/projects/map/index.astro`

**Interfaces:**
- Consumes: `createStore`, `importJson`, `downloadJson` (storage); `statusColors`, `counts`, `beenTo`, `continentProgress`, `badges`, `TOTAL_COUNTRIES` (stats); `COUNTRIES`, `KNOWN_ISO`, `countryName` (meta); `useMapView`; `btn`, `btnActive`, `input`, `card`, `mapBox`, `STATUS_LABEL` (ui); `Swatch`.
- Produces:
  - `parseYears(s: string): number[]` (unique, sorted, 1900–2100)
  - `<CountryPanel iso entry onChange={(e: CountryEntry | null) => void} onClose={() => void}>{children}</CountryPanel>` — `children` is where Task 9 puts the city list and Task 11 the "Plan a trip here" button
  - `<StatsStrip data={TravelData} />`
  - `<ImportExport data onImport={(d: TravelData) => void} onClear={() => void} />`
  - `<CountryPicker value={ISO3 | null} onPick={(iso: ISO3) => void} label="…" />`
  - `TravelMap` default export (state owner: `data`, `update(next)`, `selected`)

- [ ] **Step 1: Failing test for `parseYears`** (append to `src/lib/map/data.test.ts`)

```ts
import { parseYears } from "./data";

describe("parseYears", () => {
  it("parses commas, spaces, junk and out-of-range values", () => {
    expect(parseYears("2023, 2019 2019 abc 1850 3000 1999")).toEqual([1999, 2019, 2023]);
  });
  it("returns [] for empty input", () => {
    expect(parseYears("  ")).toEqual([]);
  });
});
```

Run: `npx vitest run src/lib/map/data.test.ts` → FAIL (`parseYears` is not exported).

- [ ] **Step 2: Implement** (append to `src/lib/map/data.ts`)

```ts
export function parseYears(s: string): number[] {
  const years = (s.match(/\d{4}/g) ?? []).map(Number).filter((y) => y >= 1900 && y <= 2100);
  return [...new Set(years)].sort((a, b) => a - b);
}
```

Run: `npx vitest run src/lib/map/data.test.ts` → PASS.

- [ ] **Step 3: `src/components/map/CountryPicker.tsx`** (keyboard/screen-reader path to every country, since the map canvas is mouse/touch only)

```tsx
import { COUNTRIES } from "@lib/map/meta";
import type { ISO3 } from "@lib/map/data";
import { input } from "./ui";

export function CountryPicker({ value, onPick, label }: { value: ISO3 | null; onPick: (iso: ISO3) => void; label: string }) {
  return (
    <label class="block text-sm">
      <span class="sr-only">{label}</span>
      <select
        class={input}
        value={value ?? ""}
        onChange={(e) => {
          const iso = (e.currentTarget as HTMLSelectElement).value;
          if (iso) onPick(iso);
        }}
      >
        <option value="">{label}</option>
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>{c.name}</option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: `src/components/map/CountryPanel.tsx`**

```tsx
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { STATUSES, parseYears, type CountryEntry, type ISO3 } from "@lib/map/data";
import { countryName } from "@lib/map/meta";
import { cn } from "@lib/utils";
import { btn, btnActive, card, input, STATUS_LABEL } from "./ui";
import { Swatch } from "./Swatch";

interface Props {
  iso: ISO3;
  entry: CountryEntry | undefined;
  onChange: (entry: CountryEntry | null) => void;
  onClose: () => void;
  children?: ComponentChildren;
}

export function CountryPanel({ iso, entry, onChange, onClose, children }: Props) {
  const [yearsText, setYearsText] = useState(entry?.years?.join(", ") ?? "");
  useEffect(() => setYearsText(entry?.years?.join(", ") ?? ""), [iso, entry?.years?.join(",")]);

  return (
    <section class={cn(card, "space-y-4")} aria-label={`${countryName(iso)} details`}>
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-lg font-semibold text-black dark:text-white">{countryName(iso)}</h2>
        <button type="button" class={btn} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div class="flex flex-wrap gap-2" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            class={cn(btn, entry?.status === s && btnActive)}
            aria-pressed={entry?.status === s}
            onClick={() => onChange({ ...entry, status: s })}
          >
            <Swatch color={s} /> {STATUS_LABEL[s]}
          </button>
        ))}
        {entry && (
          <button type="button" class={btn} onClick={() => onChange(null)}>Remove</button>
        )}
      </div>

      {entry && (
        <>
          <label class="block space-y-1 text-sm">
            <span>Years (e.g. 2019, 2023)</span>
            <input
              class={input}
              inputMode="numeric"
              value={yearsText}
              onInput={(e) => setYearsText((e.currentTarget as HTMLInputElement).value)}
              onBlur={() => {
                const years = parseYears(yearsText);
                onChange({ ...entry, years: years.length ? years : undefined });
                setYearsText(years.join(", "));
              }}
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span>Note</span>
            <textarea
              class={input}
              rows={3}
              maxLength={2000}
              value={entry.note ?? ""}
              onInput={(e) => {
                const note = (e.currentTarget as HTMLTextAreaElement).value;
                onChange({ ...entry, note: note || undefined });
              }}
            />
          </label>
        </>
      )}

      {children}
    </section>
  );
}
```

- [ ] **Step 5: `src/components/map/StatsStrip.tsx`**

```tsx
import type { TravelData } from "@lib/map/data";
import { STATUSES } from "@lib/map/data";
import { badges, beenTo, continentProgress, counts, TOTAL_COUNTRIES } from "@lib/map/stats";
import { COUNTRIES } from "@lib/map/meta";
import { STATUS_LABEL } from "./ui";
import { Swatch } from "./Swatch";

export function StatsStrip({ data }: { data: TravelData }) {
  const c = counts(data);
  const been = beenTo(data).length;
  const progress = continentProgress(data, COUNTRIES);
  const earned = badges(data, COUNTRIES);

  return (
    <section aria-label="Stats" class="space-y-3 text-sm">
      <p class="text-black dark:text-white">
        <span class="text-2xl font-semibold">{been}</span> / {TOTAL_COUNTRIES} countries
        {" "}({Math.round((been / TOTAL_COUNTRIES) * 100)}% of the world)
      </p>
      <ul class="flex flex-wrap gap-4">
        {STATUSES.map((s) => (
          <li key={s}><Swatch color={s} /> {STATUS_LABEL[s]}: {c[s]}</li>
        ))}
      </ul>
      {earned.length > 0 && (
        <ul class="flex flex-wrap gap-2" aria-label="Badges">
          {earned.map((b) => (
            <li key={b} class="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5">🏅 {b}</li>
          ))}
        </ul>
      )}
      <details>
        <summary class="cursor-pointer">By continent</summary>
        <ul class="mt-2 space-y-1">
          {progress.map((p) => (
            <li key={p.continent} class="grid grid-cols-[8rem_1fr_3rem] items-center gap-2">
              <span>{p.continent}</span>
              <span class="h-2 rounded bg-black/10 dark:bg-white/10">
                <span class="block h-2 rounded" style={{ width: `${(p.been / p.total) * 100}%`, background: "var(--map-visited)" }} />
              </span>
              <span class="text-right tabular-nums">{p.been}/{p.total}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
```

- [ ] **Step 6: `src/components/map/ImportExport.tsx`**

```tsx
import { useState } from "preact/hooks";
import type { TravelData } from "@lib/map/data";
import { downloadJson, importJson } from "@lib/map/storage";
import { KNOWN_ISO } from "@lib/map/meta";
import { btn } from "./ui";

interface Props {
  data: TravelData;
  onImport: (data: TravelData) => void;
  onClear: () => void;
}

export function ImportExport({ data, onImport, onClear }: Props) {
  const [messages, setMessages] = useState<{ kind: "error" | "warning" | "ok"; text: string }[]>([]);
  const isEmpty = Object.keys(data.countries).length === 0 && data.cities.length === 0;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const result = importJson(await file.text(), KNOWN_ISO);
    if (!result.ok) {
      setMessages(result.errors.slice(0, 10).map((text) => ({ kind: "error", text })));
      return;
    }
    if (!isEmpty && !confirm("Replace your current map with this file?")) return;
    onImport(result.data);
    setMessages([
      { kind: "ok", text: "Imported." },
      ...result.warnings.map((text) => ({ kind: "warning" as const, text })),
    ]);
  }

  return (
    <section aria-label="Import and export" class="space-y-2 text-sm">
      <div class="flex flex-wrap gap-2">
        <button type="button" class={btn} onClick={() => downloadJson(data)}>Export JSON</button>
        <label class={`${btn} cursor-pointer`}>
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            class="sr-only"
            onChange={(e) => {
              const el = e.currentTarget as HTMLInputElement;
              void handleFile(el.files?.[0]);
              el.value = "";
            }}
          />
        </label>
        <button
          type="button"
          class={btn}
          disabled={isEmpty}
          onClick={() => confirm("Clear your whole map? Export first if you want a copy.") && onClear()}
        >
          Clear map
        </button>
      </div>
      {messages.length > 0 && (
        <ul role="status" class="space-y-0.5">
          {messages.map((m, i) => (
            <li key={i} class={m.kind === "error" ? "text-rose-600 dark:text-rose-400" : m.kind === "warning" ? "text-amber-600 dark:text-amber-400" : ""}>
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 7: `src/components/map/TravelMap.tsx`** (Tasks 9 and 11 extend this file)

```tsx
import { useEffect, useMemo, useState } from "preact/hooks";
import { emptyData, type CountryEntry, type ISO3, type TravelData } from "@lib/map/data";
import { createStore } from "@lib/map/storage";
import { statusColors } from "@lib/map/stats";
import { useMapView } from "./useMapView";
import { CountryPanel } from "./CountryPanel";
import { CountryPicker } from "./CountryPicker";
import { StatsStrip } from "./StatsStrip";
import { ImportExport } from "./ImportExport";
import { mapBox } from "./ui";

export default function TravelMap() {
  const store = useMemo(() => createStore(), []);
  const [data, setData] = useState<TravelData>(() => store.load());
  const [selected, setSelected] = useState<ISO3 | null>(null);
  const { ref, view, error } = useMapView();

  function update(next: TravelData) {
    setData(next);
    store.save(next);
  }

  function setCountry(iso: ISO3, entry: CountryEntry | null) {
    const countries = { ...data.countries };
    if (entry) countries[iso] = entry;
    else delete countries[iso];
    update({ ...data, countries });
  }

  useEffect(() => {
    void view?.setCountryColors(statusColors(data));
  }, [view, data]);

  useEffect(() => (view ? view.onCountryClick(setSelected) : undefined), [view]);

  useEffect(() => {
    if (selected) view?.flyToCountry(selected);
  }, [view, selected]);

  return (
    <div class="space-y-6">
      {!store.isPersistent() && (
        <p role="status" class="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Your browser is blocking storage, so changes here won't be saved after you leave. Use Export to keep a copy.
        </p>
      )}
      <CountryPicker value={selected} onPick={setSelected} label="Find a country…" />
      <div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          {error ? <p class="p-4">{error}</p> : <div ref={ref} class={mapBox} />}
        </div>
        {selected ? (
          <CountryPanel
            iso={selected}
            entry={data.countries[selected]}
            onChange={(e) => setCountry(selected, e)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <p class="text-sm">Click a country on the map (or pick one above) to mark it.</p>
        )}
      </div>
      <StatsStrip data={data} />
      <ImportExport data={data} onImport={update} onClear={() => { store.clear(); setData(emptyData()); }} />
    </div>
  );
}
```

- [ ] **Step 8: `src/pages/projects/map/index.astro`**

```astro
---
import PageLayout from "@layouts/PageLayout.astro";
import TravelMap from "@components/map/TravelMap";
---

<PageLayout title="Travel map" description="Mark the countries you've visited, lived in, and want to see, then invite friends on a trip.">
  <div class="mx-auto max-w-screen-lg px-5 space-y-6">
    <div class="animate space-y-1">
      <h1 class="text-2xl font-semibold text-black dark:text-white">Travel map</h1>
      <p class="text-sm">
        Your map is saved in this browser only. Curious where I've been? <a class="underline underline-offset-2" href="/projects/map/kim">See my map</a>.
      </p>
    </div>
    <TravelMap client:only="preact">
      <p slot="fallback" class="text-sm">Loading map…</p>
    </TravelMap>
  </div>
</PageLayout>
```

- [ ] **Step 9: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: all pass; build output lists `/projects/map/index.html`.

Run: `npm run preview`, open `http://localhost:4321/projects/map`:
- countries render; clicking Japan opens the panel and colors it after choosing a status
- reload → Japan still colored
- years `2019 2023` → blur → shows `2019, 2023`
- Export downloads JSON; Clear empties; Import the downloaded file restores it
- toggle dark mode in the header → map recolors without reload
- navigate to `/` via the header and back → map works (no console WebGL warnings)
- DevTools → Application → block storage for the site (or Safari private window) → amber banner, map still editable

- [ ] **Checkpoint:** Phase 1 is shippable. Wait for Kim.

### Task 9: Cities — bundled search + custom pins (Phase 2)

**Files:**
- Create: `src/lib/map/cities.ts`, `src/lib/map/cities.test.ts`, `src/components/map/CitySearch.tsx`, `src/components/map/CityList.tsx`
- Modify: `src/components/map/TravelMap.tsx`

**Interfaces:**
- Consumes: `City`, `ISO3`, `TravelData` (data); `MapView.setPins`, `MapView.onMapClick`; `btn`, `btnActive`, `input` (ui).
- Produces:
  - `type CityRow = [name: string, iso3: ISO3, lat: number, lon: number, pop: number]`
  - `loadCities(): Promise<CityRow[]>` (fetches `/map/cities.json` once, cached)
  - `searchCities(rows: CityRow[], iso: ISO3, query: string, limit?: number): CityRow[]`
  - `cityId(iso: ISO3, name: string, lat: number, lon: number): string`
  - `customCityId(now?: number): string`
  - `<CitySearch iso onAdd={(c: City) => void} onStartPin={() => void} pinning={boolean} />`
  - `<CityList cities={City[]} onChange={(c: City) => void} onRemove={(id: string) => void} />`

- [ ] **Step 1: Failing tests**

`src/lib/map/cities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { searchCities, cityId, customCityId, type CityRow } from "./cities";

const rows: CityRow[] = [
  ["São Paulo", "BRA", -23.55, -46.63, 12_000_000],
  ["Rio de Janeiro", "BRA", -22.9, -43.2, 6_700_000],
  ["Salvador", "BRA", -12.97, -38.5, 2_900_000],
  ["Tokyo", "JPN", 35.68, 139.69, 37_000_000],
  ["Kyoto", "JPN", 35.01, 135.77, 1_500_000],
];

describe("searchCities", () => {
  it("only returns cities in the country", () => {
    expect(searchCities(rows, "JPN", "").map((r) => r[0])).toEqual(["Tokyo", "Kyoto"]);
  });
  it("ignores accents and case", () => {
    expect(searchCities(rows, "BRA", "sao")[0][0]).toBe("São Paulo");
    expect(searchCities(rows, "BRA", "SÃO")[0][0]).toBe("São Paulo");
  });
  it("ranks prefix matches before substring matches", () => {
    expect(searchCities(rows, "BRA", "sa").map((r) => r[0])).toEqual(["São Paulo", "Salvador"]);
    expect(searchCities(rows, "BRA", "de").map((r) => r[0])).toEqual(["Rio de Janeiro"]);
  });
  it("respects the limit", () => {
    expect(searchCities(rows, "BRA", "", 2)).toHaveLength(2);
  });
});

describe("ids", () => {
  it("cityId is stable and slugged", () => {
    expect(cityId("BRA", "São Paulo", -23.55, -46.63)).toBe("BRA-sao-paulo--23.6--46.6");
  });
  it("customCityId is unique per call time", () => {
    expect(customCityId(1)).not.toBe(customCityId(2));
    expect(customCityId(1)).toMatch(/^custom-/);
  });
});
```

Run: `npx vitest run src/lib/map/cities.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/map/cities.ts`**

```ts
import type { ISO3 } from "./data";

export type CityRow = [name: string, iso3: ISO3, lat: number, lon: number, pop: number];

let cache: Promise<CityRow[]> | null = null;

export function loadCities(): Promise<CityRow[]> {
  cache ??= fetch("/map/cities.json")
    .then((r) => {
      if (!r.ok) throw new Error(`cities.json: HTTP ${r.status}`);
      return r.json() as Promise<CityRow[]>;
    })
    .catch((e) => {
      cache = null; // allow a retry
      throw e;
    });
  return cache;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Rows are pre-sorted by population, so ties keep the bigger city first. */
export function searchCities(rows: CityRow[], iso: ISO3, query: string, limit = 8): CityRow[] {
  const q = fold(query.trim());
  const inCountry = rows.filter((r) => r[1] === iso);
  if (!q) return inCountry.slice(0, limit);
  const prefix: CityRow[] = [];
  const contains: CityRow[] = [];
  for (const r of inCountry) {
    const name = fold(r[0]);
    if (name.startsWith(q)) prefix.push(r);
    else if (name.includes(q)) contains.push(r);
  }
  return [...prefix, ...contains].slice(0, limit);
}

export function cityId(iso: ISO3, name: string, lat: number, lon: number): string {
  const slug = fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${iso}-${slug}-${lat.toFixed(1)}-${lon.toFixed(1)}`;
}

export const customCityId = (now = Date.now()): string =>
  `custom-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
```

Run: `npx vitest run src/lib/map/cities.test.ts` → PASS.

- [ ] **Step 3: `src/components/map/CitySearch.tsx`**

```tsx
import { useEffect, useState } from "preact/hooks";
import type { City, ISO3 } from "@lib/map/data";
import { cityId, loadCities, searchCities, type CityRow } from "@lib/map/cities";
import { cn } from "@lib/utils";
import { btn, btnActive, input } from "./ui";

interface Props {
  iso: ISO3;
  onAdd: (c: City) => void;
  onStartPin: () => void;
  pinning: boolean;
}

export function CitySearch({ iso, onAdd, onStartPin, pinning }: Props) {
  const [rows, setRows] = useState<CityRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadCities().then(setRows, () => setFailed(true));
  }, []);

  const results = rows ? searchCities(rows, iso, query) : [];

  return (
    <div class="space-y-2 text-sm">
      <label class="block space-y-1">
        <span>Add a city</span>
        <input
          class={input}
          type="search"
          placeholder={rows ? "Search cities…" : "Loading cities…"}
          disabled={!rows}
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      {failed && <p>Couldn't load the city list. You can still drop a custom pin.</p>}
      {query && rows && (
        <ul class="space-y-1">
          {results.length === 0 && <li>No match. Try a custom pin.</li>}
          {results.map(([name, country, lat, lon]) => (
            <li key={cityId(country, name, lat, lon)}>
              <button
                type="button"
                class={cn(btn, "w-full text-left")}
                onClick={() => {
                  onAdd({ id: cityId(country, name, lat, lon), name, country, lat, lon, status: "visited" });
                  setQuery("");
                }}
              >
                + {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" class={cn(btn, pinning && btnActive)} aria-pressed={pinning} onClick={onStartPin}>
        {pinning ? "Click the map to drop the pin… (cancel)" : "📍 Drop a custom pin"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/map/CityList.tsx`**

```tsx
import type { City } from "@lib/map/data";
import { cn } from "@lib/utils";
import { btn, btnActive, input } from "./ui";

interface Props {
  cities: City[];
  onChange: (c: City) => void;
  onRemove: (id: string) => void;
}

export function CityList({ cities, onChange, onRemove }: Props) {
  if (cities.length === 0) return null;
  return (
    <ul class="space-y-2 text-sm" aria-label="Cities">
      {cities.map((c) => (
        <li key={c.id} class="flex flex-wrap items-center gap-2">
          <span class="flex-1 text-black dark:text-white">{c.custom ? "📍 " : ""}{c.name}</span>
          {(["visited", "want"] as const).map((s) => (
            <button
              key={s}
              type="button"
              class={cn(btn, "px-2 py-0.5", c.status === s && btnActive)}
              aria-pressed={c.status === s}
              onClick={() => onChange({ ...c, status: s })}
            >
              {s === "visited" ? "Been" : "Want"}
            </button>
          ))}
          <input
            class={cn(input, "w-20")}
            inputMode="numeric"
            placeholder="Year"
            aria-label={`Year for ${c.name}`}
            value={c.year ?? ""}
            onChange={(e) => {
              const y = Number((e.currentTarget as HTMLInputElement).value);
              onChange({ ...c, year: Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : undefined });
            }}
          />
          <button type="button" class={cn(btn, "px-2 py-0.5")} aria-label={`Remove ${c.name}`} onClick={() => onRemove(c.id)}>
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Wire into `TravelMap.tsx`**

Add imports:

```tsx
import { useRef } from "preact/hooks"; // merge into the existing preact/hooks import
import type { City } from "@lib/map/data"; // merge into the existing data import
import { customCityId } from "@lib/map/cities";
import { CitySearch } from "./CitySearch";
import { CityList } from "./CityList";
```

Add state and helpers inside `TravelMap` after `setCountry`:

```tsx
  const [pinFor, setPinFor] = useState<ISO3 | null>(null);
  const pinForRef = useRef<ISO3 | null>(null);
  pinForRef.current = pinFor;

  function upsertCity(city: City) {
    const others = data.cities.filter((c) => c.id !== city.id);
    update({ ...data, cities: [...others, city] });
  }
  function removeCity(id: string) {
    update({ ...data, cities: data.cities.filter((c) => c.id !== id) });
  }

  useEffect(() => {
    void view?.setPins(data.cities);
  }, [view, data.cities]);

  useEffect(() => {
    if (!view) return;
    return view.onMapClick(({ lat, lon }) => {
      const iso = pinForRef.current;
      if (!iso) return;
      setPinFor(null);
      const name = window.prompt("Name this place", "My spot")?.trim();
      if (!name) return;
      setData((current) => {
        const next = {
          ...current,
          cities: [...current.cities, { id: customCityId(), name: name.slice(0, 200), country: iso, lat, lon, status: "visited" as const, custom: true }],
        };
        store.save(next);
        return next;
      });
    });
  }, [view]);
```

Change the country-click effect so clicks while pinning don't switch countries:

```tsx
  useEffect(
    () => (view ? view.onCountryClick((iso) => { if (!pinForRef.current) setSelected(iso); }) : undefined),
    [view],
  );
```

Pass children to `CountryPanel` (replace the self-closing `<CountryPanel … />`):

```tsx
          <CountryPanel
            iso={selected}
            entry={data.countries[selected]}
            onChange={(e) => setCountry(selected, e)}
            onClose={() => { setSelected(null); setPinFor(null); }}
          >
            <CityList
              cities={data.cities.filter((c) => c.country === selected)}
              onChange={upsertCity}
              onRemove={removeCity}
            />
            <CitySearch
              iso={selected}
              onAdd={upsertCity}
              pinning={pinFor === selected}
              onStartPin={() => setPinFor(pinFor === selected ? null : selected)}
            />
          </CountryPanel>
```

Note: the pin-drop callback uses the functional `setData` form because the handler is registered once and would otherwise see stale `data`.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build && npm run lint` → all pass.

Manual (`npm run preview`, `/projects/map`): select Brazil, search "sao" → São Paulo appears first; add it → pin shows on the map; toggle Been/Want → pin color changes; set a year; "Drop a custom pin" → click the map → name prompt → pin appears; reload → cities persist; remove works; Network tab shows `cities.json` fetched only once.

- [ ] **Checkpoint:** Phase 2 shippable. Wait for Kim.

### Task 10: `/projects/map/kim` + `travel.json` + timeline + project entry (Phase 3)

**Files:**
- Create: `src/data/travel.json`, `src/components/map/TimelineSlider.tsx`, `src/components/map/KimMap.tsx`, `src/pages/projects/map/kim.astro`, `src/content/projects/travel-map/index.md`

**Interfaces:**
- Consumes: `travelDataSchema`, `dropUnknown` (data); `atYear`, `yearRange`, `statusColors` (stats); `KNOWN_ISO` (meta); `createStore` (storage); `useMapView`, `StatsStrip`, `CountryPicker`.
- Produces:
  - `<TimelineSlider min max value={number | null} onChange={(y: number | null) => void} />` (`null` = "All", includes wishes and undated places)
  - `KimMap` default export, props `{ data: TravelData }`. Task 13 adds compare to it.

- [ ] **Step 1: `src/data/travel.json`**

Start with an empty, valid document. Kim fills it later via the Export workflow (edit on `/projects/map` → Export → replace this file). Do not invent entries.

```json
{
  "version": 1,
  "countries": {},
  "cities": []
}
```

- [ ] **Step 2: `src/components/map/TimelineSlider.tsx`**

```tsx
import { useEffect, useState } from "preact/hooks";
import { btn } from "./ui";

interface Props {
  min: number;
  max: number;
  value: number | null;
  onChange: (year: number | null) => void;
}

/** The slider's last notch (max + 1) means "All". */
export function TimelineSlider({ min, max, value, onChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const all = max + 1;
  const pos = value ?? all;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = (value ?? min - 1) + 1;
      if (next > max) {
        setPlaying(false);
        onChange(null);
      } else onChange(next);
    }, 700);
    return () => clearInterval(id);
  }, [playing, value, min, max]);

  return (
    <div class="flex items-center gap-3 text-sm">
      <button
        type="button"
        class={btn}
        onClick={() => {
          if (!playing && value === null) onChange(min);
          setPlaying(!playing);
        }}
      >
        {playing ? "⏸ Pause" : "▶ Play"}
      </button>
      <input
        type="range"
        class="flex-1"
        min={min}
        max={all}
        step={1}
        value={pos}
        aria-label="Year"
        aria-valuetext={value === null ? "All years" : String(value)}
        onInput={(e) => {
          setPlaying(false);
          const v = Number((e.currentTarget as HTMLInputElement).value);
          onChange(v >= all ? null : v);
        }}
      />
      <span class="w-12 text-right tabular-nums text-black dark:text-white">{value ?? "All"}</span>
    </div>
  );
}
```

- [ ] **Step 3: `src/components/map/KimMap.tsx`**

```tsx
import { useEffect, useMemo, useState } from "preact/hooks";
import type { ISO3, TravelData } from "@lib/map/data";
import { atYear, statusColors, yearRange } from "@lib/map/stats";
import { countryName } from "@lib/map/meta";
import { createStore } from "@lib/map/storage";
import { useMapView } from "./useMapView";
import { StatsStrip } from "./StatsStrip";
import { TimelineSlider } from "./TimelineSlider";
import { btn, card, mapBox, STATUS_LABEL } from "./ui";

export default function KimMap({ data }: { data: TravelData }) {
  const { ref, view, error } = useMapView();
  const [year, setYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<ISO3 | null>(null);
  const range = useMemo(() => yearRange(data), [data]);
  const shown = useMemo(() => (year === null ? data : atYear(data, year)), [data, year]);

  useEffect(() => {
    void view?.setCountryColors(statusColors(shown));
    void view?.setPins(shown.cities);
  }, [view, shown]);

  useEffect(() => (view ? view.onCountryClick(setSelected) : undefined), [view]);

  function startOwn() {
    const store = createStore();
    const mine = store.load();
    const hasMine = Object.keys(mine.countries).length > 0 || mine.cities.length > 0;
    if (hasMine && !confirm("Replace your own map with a copy of mine?")) return;
    store.save(structuredClone(data));
    window.location.href = "/projects/map";
  }

  const entry = selected ? data.countries[selected] : undefined;

  return (
    <div class="space-y-6">
      {error ? <p>{error}</p> : <div ref={ref} class={mapBox} />}
      {range && <TimelineSlider min={range[0]} max={range[1]} value={year} onChange={setYear} />}
      {selected && (
        <section class={card} aria-live="polite">
          <h2 class="font-semibold text-black dark:text-white">{countryName(selected)}</h2>
          {entry ? (
            <p class="text-sm">
              {STATUS_LABEL[entry.status]}
              {entry.years?.length ? ` · ${entry.years.join(", ")}` : ""}
              {entry.note ? ` · ${entry.note}` : ""}
            </p>
          ) : (
            <p class="text-sm">Not yet!</p>
          )}
        </section>
      )}
      <StatsStrip data={shown} />
      <div class="flex flex-wrap gap-2">
        <button type="button" class={btn} onClick={startOwn}>Start my own map from this</button>
        <a class={btn} href="/projects/map">Make my own map</a>
      </div>
    </div>
  );
}
```

`entry.note` is rendered as a text child, never as HTML.

- [ ] **Step 4: `src/pages/projects/map/kim.astro`** (validates `travel.json` at build time, so a bad hand-edit fails the build instead of shipping)

```astro
---
import PageLayout from "@layouts/PageLayout.astro";
import KimMap from "@components/map/KimMap";
import raw from "@data/travel.json";
import { dropUnknown, migrate, travelDataSchema } from "@lib/map/data";
import { KNOWN_ISO } from "@lib/map/meta";

const parsed = travelDataSchema.safeParse(migrate(raw));
if (!parsed.success) {
  throw new Error(`src/data/travel.json is invalid:\n${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`);
}
const { data, unknown } = dropUnknown(parsed.data, KNOWN_ISO);
if (unknown.length) console.warn(`travel.json: ignoring unknown country codes ${unknown.join(", ")}`);
---

<PageLayout title="Kim's travel map" description="Where I've been, lived, and want to go.">
  <div class="mx-auto max-w-screen-lg px-5 space-y-6">
    <div class="animate space-y-1">
      <h1 class="text-2xl font-semibold text-black dark:text-white">Where I've been</h1>
      <p class="text-sm">Drag the timeline to watch the map fill in. <a class="underline underline-offset-2" href="/projects/map">Make your own map</a>.</p>
    </div>
    <KimMap client:only="preact" data={data}>
      <p slot="fallback" class="text-sm">Loading map…</p>
    </KimMap>
  </div>
</PageLayout>
```

`@data/travel.json` resolves through the existing `@*` → `./src/*` alias.

- [ ] **Step 5: `src/content/projects/travel-map/index.md`**

```md
---
title: "Travel map"
description: "An interactive map of where I've been, plus trip invites you can send to friends."
date: "Sep 26 2026"
demoURL: "/projects/map"
---

A small tool that lives entirely in the browser: mark countries you've visited, lived in, or want to see, add cities, and watch your stats grow.

- [Open your own map](/projects/map). It's saved in your browser only; export it as JSON whenever you like.
- [See my map](/projects/map/kim), with a timeline of when I got where.
- Plan a trip from any country and send the link. It opens as a spinning globe that flies to the destination.

## How it works

There is no server. Your map lives in `localStorage`, invites are compressed into the link itself (after the `#`, so they never reach a server), and my map is a JSON file in the site's repo.

Built with Astro, Preact and MapLibre GL. Country shapes from Natural Earth, cities from GeoNames.
```

Note: the project detail page renders `demoURL` with `Link external`, which opens in a new tab. That's fine for an internal URL; leave it.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build && npm run lint` → pass; build lists `/projects/map/kim/index.html` and `/projects/travel-map/index.html`.

Manual: temporarily paste a sample into `travel.json` (e.g. `BRA` lived `[2000]`, `JPN` visited `[2019]`, `ISL` want) and run `npm run preview`:
- `/projects/map/kim` colors them; slider at 2010 shows only Brazil; "All" shows Iceland too; Play steps through years
- clicking Japan shows its card
- "Start my own map from this" asks to confirm when you already have data, then opens `/projects/map` with the copy
- `/projects` lists "Travel map"
- put `"XXX": {"status":"visited"}` in the file → build warns; put `"status":"nope"` → build fails with the path
- Restore `travel.json` to the empty document afterwards.

- [ ] **Checkpoint:** Phase 3 shippable. Wait for Kim.

### Task 11: Invite builder + "Plan a trip here" (Phase 4, part 1)

**Files:**
- Create: `src/components/map/share.ts`, `src/components/map/format.ts`, `src/components/map/InviteBuilder.tsx`
- Modify: `src/components/map/TravelMap.tsx`

**Interfaces:**
- Consumes: `Invite`, `inviteUrl`, `MAX_STOPS`, `MAX_IMAGES`, `MAX_MESSAGE` (invite); `isHttpsUrl` (data); `beenTo` (stats); `countryName` (meta); `CountryPicker`; ui classes.
- Produces:
  - `shareOrCopy(url: string, title: string): Promise<"shared" | "copied" | "failed">`
  - `placeList(isos: ISO3[]): string` (e.g. "Japan, South Korea, and Vietnam")
  - `<InviteBuilder initialStops={ISO3[]} visited={ISO3[]} onClose={() => void} />`

- [ ] **Step 1: `src/components/map/share.ts`**

```ts
export async function shareOrCopy(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "failed";
      // otherwise fall back to copying
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
```

- [ ] **Step 2: `src/components/map/format.ts`**

```ts
import type { ISO3 } from "@lib/map/data";
import { countryName } from "@lib/map/meta";

const list = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
export const placeList = (isos: ISO3[]): string => list.format(isos.map(countryName));
```

- [ ] **Step 3: `src/components/map/InviteBuilder.tsx`**

```tsx
import { useMemo, useState } from "preact/hooks";
import type { ISO3 } from "@lib/map/data";
import { isHttpsUrl } from "@lib/map/data";
import { inviteUrl, MAX_IMAGES, MAX_MESSAGE, MAX_STOPS, type Invite } from "@lib/map/invite";
import { countryName } from "@lib/map/meta";
import { cn } from "@lib/utils";
import { CountryPicker } from "./CountryPicker";
import { placeList } from "./format";
import { shareOrCopy } from "./share";
import { btn, card, input } from "./ui";

interface Props {
  initialStops: ISO3[];
  visited: ISO3[];
  onClose: () => void;
}

export function InviteBuilder({ initialStops, visited, onClose }: Props) {
  const [stops, setStops] = useState<ISO3[]>(initialStops);
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [imagesText, setImagesText] = useState("");
  const [date, setDate] = useState("");
  const [includeVisited, setIncludeVisited] = useState(false);
  const [status, setStatus] = useState("");

  const imageLines = imagesText.split(/\s+/).filter(Boolean);
  const images = imageLines.filter(isHttpsUrl).slice(0, MAX_IMAGES);
  const droppedImages = imageLines.length - images.length;

  const url = useMemo(() => {
    if (stops.length === 0) return "";
    const invite: Invite = { v: 1, stops };
    if (from.trim()) invite.from = from.trim().slice(0, 80);
    if (message.trim()) invite.message = message.trim();
    if (images.length) invite.images = images;
    if (date) invite.date = date;
    if (includeVisited && visited.length) invite.visited = visited;
    return inviteUrl(window.location.origin, invite);
  }, [stops, from, message, imagesText, date, includeVisited, visited]);

  function move(i: number, delta: number) {
    const next = [...stops];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    setStops(next);
  }

  return (
    <section class={cn(card, "space-y-4")} aria-label="Plan a trip">
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-lg font-semibold text-black dark:text-white">
          {stops.length ? `Trip to ${placeList(stops)}` : "Plan a trip"}
        </h2>
        <button type="button" class={btn} onClick={onClose} aria-label="Close trip planner">✕</button>
      </div>

      <ol class="space-y-1 text-sm">
        {stops.map((iso, i) => (
          <li key={iso} class="flex items-center gap-2">
            <span class="flex-1 text-black dark:text-white">{i + 1}. {countryName(iso)}</span>
            <button type="button" class={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${countryName(iso)} earlier`}>↑</button>
            <button type="button" class={btn} disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${countryName(iso)} later`}>↓</button>
            <button type="button" class={btn} onClick={() => setStops(stops.filter((s) => s !== iso))} aria-label={`Remove ${countryName(iso)}`}>✕</button>
          </li>
        ))}
      </ol>
      {stops.length < MAX_STOPS && (
        <CountryPicker
          value={null}
          label="Add a stop…"
          onPick={(iso) => !stops.includes(iso) && setStops([...stops, iso])}
        />
      )}

      <label class="block space-y-1 text-sm">
        <span>From (your name)</span>
        <input class={input} maxLength={80} value={from} onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="block space-y-1 text-sm">
        <span>Message</span>
        <textarea class={input} rows={3} maxLength={MAX_MESSAGE} value={message} onInput={(e) => setMessage((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <label class="block space-y-1 text-sm">
        <span>When (optional)</span>
        <input class={input} type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="block space-y-1 text-sm">
        <span>Image links (https, one per line, up to {MAX_IMAGES})</span>
        <textarea class={input} rows={2} value={imagesText} onInput={(e) => setImagesText((e.currentTarget as HTMLTextAreaElement).value)} />
        {droppedImages > 0 && (
          <span class="text-amber-600 dark:text-amber-400">
            {droppedImages} link{droppedImages > 1 ? "s" : ""} skipped (not https, or over {MAX_IMAGES}).
          </span>
        )}
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeVisited} disabled={visited.length === 0} onChange={(e) => setIncludeVisited((e.currentTarget as HTMLInputElement).checked)} />
        Include the countries I've been to (so they can compare maps)
      </label>

      {url && (
        <div class="space-y-2 text-sm">
          <input class={input} readOnly value={url} aria-label="Invite link" onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
          {url.length > 2000 && <p class="text-amber-600 dark:text-amber-400">This link is long; some chat apps may cut it. Try fewer images or a shorter message.</p>}
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class={btn}
              onClick={async () => {
                const r = await shareOrCopy(url, `Trip to ${placeList(stops)}`);
                setStatus(r === "copied" ? "Link copied!" : r === "shared" ? "Shared!" : "Couldn't share. Copy the link above.");
              }}
            >
              Share link
            </button>
            <a class={btn} href={url} target="_blank" rel="noopener">Preview</a>
          </div>
          <p role="status">{status}</p>
        </div>
      )}
    </section>
  );
}
```

`url` depends on `imagesText` rather than `images` so the memo key is a string, not a fresh array each render.

- [ ] **Step 4: Wire into `TravelMap.tsx`**

Add imports:

```tsx
import { beenTo } from "@lib/map/stats"; // merge into the existing stats import
import { InviteBuilder } from "./InviteBuilder";
import { btn } from "./ui"; // merge into the existing ui import
```

Add state next to the other `useState` calls:

```tsx
  const [planning, setPlanning] = useState<ISO3[] | null>(null);
```

Inside `<CountryPanel>` children, after `<CitySearch … />`:

```tsx
            <button type="button" class={btn} onClick={() => setPlanning([selected])}>
              ✈️ Plan a trip here
            </button>
```

Right after the map/panel grid `</div>`:

```tsx
      {planning ? (
        <InviteBuilder
          key={planning.join(",")}
          initialStops={planning}
          visited={beenTo(data)}
          onClose={() => setPlanning(null)}
        />
      ) : (
        <button type="button" class={btn} onClick={() => setPlanning([])}>✈️ Plan a trip with friends</button>
      )}
```

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint` → pass.

Manual: select Japan → "Plan a trip here" → builder shows "Trip to Japan"; add South Korea, reorder, remove; type a message with emoji; paste `http://x.com/a.jpg` and `https://picsum.photos/400` → "1 link skipped"; toggle "include countries" (disabled when you have none); Share link copies on desktop; Preview opens `/projects/map/invite#i=…` (a 404 until Task 12, that's expected).

- [ ] **Checkpoint:** wait for Kim.

### Task 12: Invite page — globe intro, postcard, countdown, reply (Phase 4, part 2)

**Files:**
- Create: `src/components/map/InvitePage.tsx`, `src/components/map/InviteView.tsx`, `src/components/map/ReplyView.tsx`, `src/components/map/Postcard.tsx`, `src/pages/projects/map/invite.astro`

**Interfaces:**
- Consumes: `parseHash`, `decodeInvite`, `decodeReply`, `replyUrl`, `Invite`, `Reply`, `MAX_MESSAGE` (invite); `daysUntil` (geo); `KNOWN_ISO` (meta); `MapView.globeIntro`, `setArcs`, `setCountryColors`; `useMapView`; `placeList`, `shareOrCopy`; ui classes.
- Produces:
  - `InvitePage` default export (no props; reads `location.hash`, re-reads on `hashchange`)
  - `<InviteView invite={Invite} unknown={ISO3[]} />` (Task 13 adds compare)
  - `<ReplyView reply={Reply} unknown={ISO3[]} />`
  - `<Postcard invite={Invite} />`

- [ ] **Step 1: `src/components/map/Postcard.tsx`**

```tsx
import { useState } from "preact/hooks";
import type { Invite } from "@lib/map/invite";
import { daysUntil } from "@lib/map/geo";
import { cn } from "@lib/utils";
import { card } from "./ui";

function countdown(date: string): string | null {
  const n = daysUntil(date, new Date());
  if (n === null) return null;
  if (n > 1) return `${n} days to go`;
  if (n === 1) return "Tomorrow!";
  if (n === 0) return "It's today!";
  return `This trip was ${-n} day${n === -1 ? "" : "s"} ago`;
}

export function Postcard({ invite }: { invite: Invite }) {
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const images = (invite.images ?? []).filter((u) => !broken.has(u));
  const when = invite.date ? countdown(invite.date) : null;

  return (
    <article class={cn(card, "not-prose space-y-3 bg-white/60 dark:bg-black/20")}>
      {when && <p class="text-sm font-semibold text-black dark:text-white">🗓 {invite.date} · {when}</p>}
      {invite.message && <p class="whitespace-pre-wrap font-serif text-black dark:text-white">{invite.message}</p>}
      {invite.from && <p class="text-right text-sm">— {invite.from}</p>}
      {images.length > 0 && (
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              class="aspect-square w-full rounded object-cover"
              onError={() => setBroken((b) => new Set(b).add(src))}
            />
          ))}
        </div>
      )}
    </article>
  );
}
```

If `astro check` rejects `referrerpolicy`, use `referrerPolicy`; both render the same attribute. `message` and `from` are text children; Preact escapes them. There is no `dangerouslySetInnerHTML` anywhere in `src/components/map/`.

- [ ] **Step 2: `src/components/map/InviteView.tsx`**

```tsx
import { useEffect, useState } from "preact/hooks";
import type { ISO3 } from "@lib/map/data";
import { replyUrl, MAX_MESSAGE, type Invite } from "@lib/map/invite";
import type { ColorKey } from "@lib/map/stats";
import { cn } from "@lib/utils";
import { useMapView } from "./useMapView";
import { Postcard } from "./Postcard";
import { placeList } from "./format";
import { shareOrCopy } from "./share";
import { btn, card, input, mapBox } from "./ui";

export function InviteView({ invite, unknown }: { invite: Invite; unknown: ISO3[] }) {
  const { ref, view, error } = useMapView({ globe: true });
  const [phase, setPhase] = useState<"intro" | "postcard">("intro");
  const [replying, setReplying] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const places = placeList(invite.stops);
  const headline = invite.from ? `${invite.from} says: let's visit ${places}!` : `Let's visit ${places}!`;

  useEffect(() => {
    if (!view) return;
    let cancelled = false;
    const colors: Record<ISO3, ColorKey> = Object.fromEntries(invite.stops.map((iso) => [iso, "stop" as const]));
    void view.setCountryColors(colors);
    void view.setArcs(invite.stops);
    view.globeIntro(invite.stops[0]).then(() => !cancelled && setPhase("postcard"));
    return () => { cancelled = true; };
  }, [view]);

  useEffect(() => {
    if (error) setPhase("postcard"); // no WebGL: skip straight to the card
  }, [error]);

  async function sendReply() {
    const url = replyUrl(window.location.origin, {
      v: 1,
      stops: invite.stops,
      ...(name.trim() ? { from: name.trim().slice(0, 80) } : {}),
      ...(note.trim() ? { message: note.trim() } : {}),
    });
    const r = await shareOrCopy(url, `I'm in for ${places}!`);
    setStatus(r === "copied" ? "Reply link copied. Send it back!" : r === "shared" ? "Sent!" : url);
  }

  return (
    <div class="space-y-6">
      <div class="relative">
        {error ? <p class="p-4">{error}</p> : <div ref={ref} class={mapBox} />}
        <h1
          class={cn(
            "pointer-events-none absolute inset-x-0 top-6 px-4 text-center text-2xl font-semibold text-black dark:text-white drop-shadow transition-opacity duration-700 sm:text-3xl",
            phase === "postcard" && !error && "opacity-0",
          )}
        >
          {headline}
        </h1>
      </div>

      {unknown.length > 0 && <p class="text-sm text-amber-600 dark:text-amber-400">Some places in this invite weren't recognized and were skipped.</p>}

      {phase === "postcard" && (
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-black dark:text-white">{headline}</h2>
          <Postcard invite={invite} />

          {replying ? (
            <div class={cn(card, "space-y-2 text-sm")}>
              <label class="block space-y-1">
                <span>Your name</span>
                <input class={input} maxLength={80} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
              </label>
              <label class="block space-y-1">
                <span>Message (optional)</span>
                <textarea class={input} rows={2} maxLength={MAX_MESSAGE} value={note} onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)} />
              </label>
              <button type="button" class={btn} onClick={sendReply}>Get reply link</button>
              <p role="status" class="break-all">{status}</p>
            </div>
          ) : (
            <div class="flex flex-wrap gap-2">
              <button type="button" class={btn} onClick={() => setReplying(true)}>🙋 I'm in!</button>
              <a class={btn} href="/projects/map">Make my own map</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `src/components/map/ReplyView.tsx`**

```tsx
import { useEffect } from "preact/hooks";
import type { ISO3 } from "@lib/map/data";
import type { Reply } from "@lib/map/invite";
import type { ColorKey } from "@lib/map/stats";
import { useMapView } from "./useMapView";
import { placeList } from "./format";
import { btn, card, mapBox } from "./ui";

export function ReplyView({ reply, unknown }: { reply: Reply; unknown: ISO3[] }) {
  const { ref, view, error } = useMapView({ globe: true });

  useEffect(() => {
    if (!view) return;
    const colors: Record<ISO3, ColorKey> = Object.fromEntries(reply.stops.map((iso) => [iso, "stop" as const]));
    void view.setCountryColors(colors);
    void view.setArcs(reply.stops);
    void view.globeIntro(reply.stops[0], 1500);
  }, [view]);

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-semibold text-black dark:text-white">
        🎉 {reply.from ?? "Your friend"} is in for {placeList(reply.stops)}!
      </h1>
      {reply.message && <p class={`${card} whitespace-pre-wrap font-serif text-black dark:text-white`}>{reply.message}</p>}
      {unknown.length > 0 && <p class="text-sm text-amber-600 dark:text-amber-400">Some places weren't recognized and were skipped.</p>}
      {error ? <p>{error}</p> : <div ref={ref} class={mapBox} />}
      <a class={btn} href="/projects/map">Plan another trip</a>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/map/InvitePage.tsx`**

```tsx
import { useEffect, useState } from "preact/hooks";
import { decodeInvite, decodeReply, parseHash } from "@lib/map/invite";
import { KNOWN_ISO } from "@lib/map/meta";
import { InviteView } from "./InviteView";
import { ReplyView } from "./ReplyView";
import { btn } from "./ui";

export default function InvitePage() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    // Opening a second invite link in the same tab only changes the hash; re-render for it.
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const parsed = parseHash(hash);
  if (parsed?.kind === "invite") {
    const d = decodeInvite(parsed.payload, KNOWN_ISO);
    if (d) return <InviteView key={parsed.payload} invite={d.value} unknown={d.unknown} />;
  }
  if (parsed?.kind === "reply") {
    const d = decodeReply(parsed.payload, KNOWN_ISO);
    if (d) return <ReplyView key={parsed.payload} reply={d.value} unknown={d.unknown} />;
  }

  return (
    <div class="space-y-4">
      <h1 class="text-2xl font-semibold text-black dark:text-white">This invite looks broken 🧭</h1>
      <p>The link may have been cut off when it was pasted. Ask your friend to send it again.</p>
      <a class={btn} href="/projects/map">Go to the travel map</a>
    </div>
  );
}
```

- [ ] **Step 5: `src/pages/projects/map/invite.astro`**

```astro
---
import PageLayout from "@layouts/PageLayout.astro";
import InvitePage from "@components/map/InvitePage";
---

<PageLayout title="You're invited" description="A trip invite from a friend. Open it to see where you're going.">
  <div class="mx-auto max-w-screen-lg px-5">
    <InvitePage client:only="preact">
      <p slot="fallback" class="text-sm">Unfolding your invite…</p>
    </InvitePage>
  </div>
</PageLayout>
```

The page's static OG tags (title/description above, default image from `Head.astro`) are what chat apps preview; per-invite previews aren't possible on static hosting.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build && npm run lint` → pass; build lists `/projects/map/invite/index.html`.

Manual (`npm run preview`):
- Build an invite on `/projects/map` for Japan → South Korea with a message, 2 https images, a date next month; open the link in a private window: globe spins, flies to Japan, flattens, headline fades, postcard shows message, images, "N days to go", dashed arc Japan→Korea
- one image URL that 404s → hidden, no broken icon
- "I'm in!" → name → reply link → open it → "🎉 Ana is in for Japan and South Korea!"
- `/projects/map/invite`, `…#i=`, `…#i=garbage`, `…#r=xyz` → broken screen with link
- with the page open, paste a different invite URL in the same tab → new invite renders
- macOS "Reduce motion" on → no spin, jumps straight to the country
- phone width (DevTools 375px): headline wraps, map and postcard fit, no horizontal scroll

- [ ] **Checkpoint:** Phase 4 shippable. Wait for Kim.

### Task 13: Compare mode (Phase 5)

**Files:**
- Create: `src/components/map/CompareToggle.tsx`
- Modify: `src/components/map/Swatch.tsx` (accept `"land"`), `src/components/map/KimMap.tsx`, `src/components/map/InviteView.tsx`

**Interfaces:**
- Consumes: `compare`, `comparisonColors`, `beenTo`, `statusColors`, `TOTAL_COUNTRIES`, `Comparison` (stats); `createStore` (storage).
- Produces: `<CompareToggle comparison={Comparison} aLabel={string} bLabel={string} on={boolean} disabledReason={string | null} onToggle={() => void} />`

- [ ] **Step 1: Let `Swatch` show the neutral land color**

In `src/components/map/Swatch.tsx` change the prop type to `{ color: ColorKey | "land" }` (the body already uses `var(--map-${color})`).

- [ ] **Step 2: `src/components/map/CompareToggle.tsx`**

```tsx
import type { Comparison } from "@lib/map/stats";
import { TOTAL_COUNTRIES } from "@lib/map/stats";
import { cn } from "@lib/utils";
import { Swatch } from "./Swatch";
import { btn, btnActive } from "./ui";

interface Props {
  comparison: Comparison;
  aLabel: string;
  bLabel: string;
  on: boolean;
  disabledReason: string | null;
  onToggle: () => void;
}

export function CompareToggle({ comparison: c, aLabel, bLabel, on, disabledReason, onToggle }: Props) {
  const neither = Math.max(0, TOTAL_COUNTRIES - c.both.length - c.onlyA.length - c.onlyB.length);
  return (
    <div class="space-y-2 text-sm">
      <button type="button" class={cn(btn, on && btnActive)} aria-pressed={on} disabled={!!disabledReason} onClick={onToggle}>
        ⇄ Compare with my map
      </button>
      {disabledReason && <p>{disabledReason}</p>}
      {on && (
        <ul class="flex flex-wrap gap-4" aria-label="Comparison legend">
          <li><Swatch color="both" /> Both: {c.both.length}</li>
          <li><Swatch color="onlyA" /> Only {aLabel}: {c.onlyA.length}</li>
          <li><Swatch color="onlyB" /> Only {bLabel}: {c.onlyB.length}</li>
          <li><Swatch color="land" /> Neither: {neither}</li>
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add compare to `KimMap.tsx`**

Imports (merge into existing ones):

```tsx
import { atYear, beenTo, compare, comparisonColors, statusColors, yearRange } from "@lib/map/stats";
import { CompareToggle } from "./CompareToggle";
```

State, after the `shown` line (it reads `shown`, so it must come after it):

```tsx
  const mine = useMemo(() => beenTo(createStore().load()), []);
  const [comparing, setComparing] = useState(false);
  const comparison = useMemo(() => compare(beenTo(shown), mine), [shown, mine]);
```

Replace the colors/pins effect:

```tsx
  useEffect(() => {
    void view?.setCountryColors(comparing ? comparisonColors(comparison) : statusColors(shown));
    void view?.setPins(comparing ? [] : shown.cities);
  }, [view, shown, comparing, comparison]);
```

Render, right after the `TimelineSlider` line:

```tsx
      <CompareToggle
        comparison={comparison}
        aLabel="me"
        bLabel="you"
        on={comparing}
        disabledReason={mine.length ? null : "Mark some countries on your own map first, then come back to compare."}
        onToggle={() => setComparing(!comparing)}
      />
```

Here "me" is Kim (`onlyA`, the page owner) and "you" is the visitor (`onlyB`).

- [ ] **Step 4: Add compare to `InviteView.tsx`** (only when the invite carries `visited`)

Imports (merge):

```tsx
import { useMemo } from "preact/hooks";
import { beenTo, compare, comparisonColors, type ColorKey } from "@lib/map/stats";
import { createStore } from "@lib/map/storage";
import { CompareToggle } from "./CompareToggle";
```

State:

```tsx
  const mine = useMemo(() => beenTo(createStore().load()), []);
  const [comparing, setComparing] = useState(false);
  const comparison = useMemo(() => compare(invite.visited ?? [], mine), [invite, mine]);
  const stopColors = useMemo<Record<ISO3, ColorKey>>(
    () => Object.fromEntries(invite.stops.map((iso) => [iso, "stop" as const])),
    [invite],
  );
```

Change the intro effect to use `stopColors` (replace the local `colors` const with `void view.setCountryColors(stopColors);`), and add:

```tsx
  useEffect(() => {
    if (!view || phase !== "postcard") return;
    void view.setCountryColors(comparing ? comparisonColors(comparison) : stopColors);
    void view.setArcs(comparing ? [] : invite.stops);
  }, [view, phase, comparing, comparison, stopColors]);
```

Render, in the postcard block after `<Postcard … />`:

```tsx
          {invite.visited && (
            <CompareToggle
              comparison={comparison}
              aLabel={invite.from ?? "them"}
              bLabel="you"
              on={comparing}
              disabledReason={mine.length ? null : "Mark your countries on your own map to compare."}
              onToggle={() => setComparing(!comparing)}
            />
          )}
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run build && npm run lint` → pass.

Manual:
- with a sample `travel.json` and some countries on your own map: `/projects/map/kim` → Compare → four-bucket legend; colors match (green both, blue only Kim, rose only you); counts add up to 195 with Neither; toggle off restores statuses; timeline still works while comparing
- with an empty own map → button disabled with the hint
- invite built with "include the countries I've been to" → opened in a browser that has its own map → Compare appears after the postcard and works; invite without `visited` → no Compare button

- [ ] **Checkpoint:** Phase 5 shippable. Wait for Kim.

### Task 14: Final verification

- [ ] **Step 1: Automated**

Run: `npm test && npm run build && npm run lint`
Expected: all green. Record the test count.

- [ ] **Step 2: Bundle check.** In `dist/`, confirm MapLibre is only in chunks loaded by `/projects/map*` pages:

```bash
grep -l "maplibre" dist/index.html dist/blog/index.html dist/projects/index.html || echo "not on non-map pages: OK"
```

- [ ] **Step 3: Manual pass** (`npm run preview`, desktop + 375px phone width, light and dark), the spec's checklist:
  - [ ] mark countries and reload (persists)
  - [ ] export, clear, import
  - [ ] add a city and a custom pin
  - [ ] create an invite and open it in a private window (globe → fly → map → postcard)
  - [ ] "I'm in" reply link
  - [ ] compare
  - [ ] timeline on `/kim`
  - [ ] a broken hash
  - [ ] localStorage blocked
  - [ ] toggle theme with a map open (recolors live)
  - [ ] navigate map page → home → map page via header links (map comes back; no WebGL warnings)

- [ ] **Step 4: Review section.** Append a `## Review` section to this file: what shipped, test count, anything deferred or surprising, and the reminder that `src/data/travel.json` is still empty for Kim to fill.

- [ ] **Step 5:** Hand off with superpowers:finishing-a-development-branch. No commits unless Kim asks.

---

## Review (2026-09-26)

**Shipped:** all 14 tasks (Phases 1–5). Built inline in one session; nothing committed, per CLAUDE.md.

**Verification**
- `npm test`: 92/92 across 7 files (data, storage, invite, geo, stats, meta, cities).
- `npm run build`: 0 errors, 0 warnings. MapLibre (1.1 MB chunk) loads only on `/projects/map*`.
- ESLint on all new files: clean. `npm run lint` still reports 8 errors, all in files this branch didn't touch (BlogFolderCard, env.d.ts, index, blog pages).
- Headless Chrome (SwiftShader WebGL): 60 scripted checks pass. They cover the spec's manual checklist plus theme recolor, ClientRouter navigation, 375px width, reduced motion, hashchange, XSS-as-text and broken image URLs.
- A whole-branch review (fresh reviewer) found 0 Critical issues. Fixed with tests written first: Australian cities were filed under Ashmore & Cartier Is.; territories counted toward N/195 and continent badges; re-adding a city wiped its data; percent-encoded invite links failed.

**Deviations from the plan**
- `@astrojs/preact@^4`, not the ^6 that `astro add` picked (v6 needs Astro 6).
- `fillColor()` needs `as unknown as ExpressionSpecification`.
- `CountryMeta` gained `sovereign`. 199 features are flagged sovereign (the count includes Taiwan, Kosovo, Somaliland and Northern Cyprus) and the denominator stays 195.

**Deferred minors:** theme recolor runs on every scroll; a theme toggle during a source reload is dropped; a corrupt saved map shows empty with no notice; a custom pin uses the selected country rather than the one clicked; "Start my own map" with storage blocked lands on an empty map; the bare `/invite` route is in the sitemap; duplicate image URLs produce duplicate keys; "Plan a trip here" resets an open builder; the invite arc can end in the sea; the city name column is narrow.

**Before deploying:** `src/data/travel.json` is still empty, so `/projects/map/kim` would show an empty map. Fill it via `/projects/map` → Export → replace the file.

---

## Round 2 — layout + Markdown (2026-09-27)

Kim's feedback: full-width map; search in the map's top-right; status buttons inside the map; a single "Plan a trip" button; Markdown trip message (with images) instead of the image-links field.

- [x] Markdown renderer (`src/components/map/markdown.tsx`): marked lexer → Preact elements, allowlisted tags only, raw HTML shown as text, links http(s)/mailto only, images https only, max 6, lazy + no-referrer, hidden on error. Tests first (render to string).
- [x] Invite: drop `images` field, `MAX_MESSAGE` 1000 → 2000; builder gets a Markdown textarea + live postcard preview + skipped-image warning; Postcard renders Markdown.
- [x] Shared name search (`search.ts`: `fold`, `rankByName`); `searchCountries` + refactor `searchCities`. Tests first.
- [x] `CountrySearch` combobox (keyboard + ARIA) replacing the `<select>` picker.
- [x] Full-bleed map on all three map pages; zoom control bottom-right; overlays: search + "Plan a trip" top-right, country panel top-left (bottom sheet on phones); `flyToCountry` padding so the country isn't hidden under the panel.
- [x] Single "✈️ Plan a trip" button: pre-fills the selected country; if the builder is already open it scrolls to it instead of resetting it.
- [x] Page-scroll trap: enable MapLibre `cooperativeGestures` (Ctrl/⌘+scroll to zoom, two fingers on touch), since a full-width map would otherwise swallow the wheel.
- [x] Verify: vitest, build, eslint on new files, browser scripts updated for the new layout, screenshots desktop/phone light/dark.

Added mid-round by Kim:
- [x] City pins are little flags (canvas-drawn icons, own colours: red = been, white with red edge = want) instead of circles.
- [x] Multi-stop invites: the intro flies from stop to stop, with a "Stop 1 of N · Country" caption.
- [x] Compare mode removed everywhere (toggle, stats helpers, `visited` in invites, the builder's "include my countries" checkbox, colour tokens).
- [x] "I'm in" and reply links replaced with "Add to my map as Want to go" (`addWants`: never downgrades a visited/lived country).

### Review (round 2)
- `npm test`: 104/104 (new: markdown renderer 10, search 3, addWants 2; removed: reply/compare tests).
- `npm run build`: 0 errors, 0 warnings. ESLint on new files clean (the same 8 pre-existing errors elsewhere).
- Headless Chrome: round2 script 24/24 (full width, search in-map top-right, one Plan button that adds the selected country without resetting the draft, Markdown preview + postcard, raw HTML as text, http image dropped, multi-stop tour captions, Add to my map keeps visited, wheel scrolls page, phone bottom sheet), plus updated phase1 15/15, phase2 10/10, phase3 9/9, phase4 9/9, Kim map dark 2/2.
- Decisions: full-width map on all three map pages; MapLibre cooperative gestures (Ctrl/⌘+scroll or two fingers to move the map) so the page still scrolls; flag colours separate from country colours after the first version's blue flags vanished on blue countries; the theme recolour now only runs on an actual dark/light switch (it would otherwise redraw the flags on every scroll).

---

## Round 3 (2026-09-27)

- [x] City pins: one colour each. Yellow pin = want to go, blue flag = been.
- [x] Stats: "N / 195 countries (x%)" and the Visited/Lived/Want counts on one line.
- [x] City row: keep the remove ✕ on the same line (compact row, name truncates).
- [x] "Search a place": countries **and** cities in the map search; picking a city adds it (and marks its country if unmarked). The in-panel city search goes (one entry point); "Drop a custom pin" stays.
- [x] Markdown images "not working": reproduced. Direct image links render; links that aren't images (share pages, 404s) were hidden silently. Show a visible note instead (with a how-to hint in the planner preview).
- [x] Invite intro faster (spin, flights, pauses).
- [x] "Add to my map": use the invite's year and a note "Travel with <from>"; existing "want" entries get the year/note merged; visited/lived untouched.

### Review (round 3)
- `npm test`: 106/106 (new: `searchPlaces` 4, `addWants` year/note 2; removed the now-unused `searchCities` and its tests). `npm run build`: 0 errors/0 warnings. ESLint on new files: clean.
- Headless Chrome: round3 14/14. Covers the place search (city → adds city and marks country), city order kept on toggle, ✕ on the same line, stats on one line, direct image renders, page link shows a note (with a how-to hint in the preview), intro ~5s incl. load (was ~9.5s), and "Add to my map" saving `{want, years:[2027], note:"Travel with Kim"}`. Plus phase1 15/15, phase2 9/9, round2 24/24, phase4 9/9.
- Image bug, root cause: rendering was fine for direct image links. Links to a page (e.g. an Unsplash photo page) or a 404 return HTML, and the renderer hid those silently. They now show a visible note.
