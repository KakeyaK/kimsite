// One-off generator for the travel map's geo assets. Output is committed; CI never runs this.
// Usage: npm run geodata   (needs network + the `unzip` binary)
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import mapshaper from "mapshaper";

const NE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const NE_ADMIN1_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson";
const NE_DISPUTED_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_breakaway_disputed_areas.geojson";
const NE_UNITS_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_units.geojson";
const GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip";
/** Label glyphs (Open Sans, OFL). Every country and state name is Latin-1, so the first range is all we need. */
const GLYPHS_URL = "https://demotiles.maplibre.org/font/Open%20Sans%20Semibold/0-255.pbf";
/** Countries whose states/provinces are tracked: every country the 50m admin-1 file covers. */
const REGION_COUNTRIES = ["AUS", "BRA", "CAN", "CHN", "IDN", "IND", "RUS", "USA", "ZAF"];
/** The UK's nations come from the map-units file, keyed by their ISO 3166-2 codes. */
const UK_NATIONS = { ENG: "GB-ENG", SCT: "GB-SCT", WLS: "GB-WLS", NIR: "GB-NIR" };
const MIN_POP = 100_000;

// Borders and names follow the UN. Natural Earth draws who controls a place on the ground; these undo that
// where the UN says otherwise. Places the UN takes no position on or that it lists separately (Kosovo,
// Taiwan, Hong Kong, Western Sahara, Kashmir's parts) stay their own areas; they just aren't countries.
/** Disputed areas (by Natural Earth BRK_A3) that belong, per the UN, to another country. */
const UN_MOVES = { B89: "UKR" /* Crimea */, B16: "SYR" /* Golan Heights */, B19: "SAH" /* Morocco-held Western Sahara */ };
/** Unrecognised states drawn as part of the country the UN recognises. */
const UN_MERGES = { CYN: "CYP" /* Northern Cyprus */, SOL: "SOM" /* Somaliland */ };
/**
 * UN names where Natural Earth's differ in a way that matters. Other names are Natural Earth's short ones,
 * spelled out where it abbreviates them ("W. Sahara" → "Western Sahara"), so they can be searched.
 */
const UN_NAMES = { FLK: "Falkland Islands (Malvinas)", TUR: "Türkiye", SWZ: "Eswatini" };
/** The 193 UN members plus its two observer states (the Vatican and Palestine). Checked below. */
const UN_STATES = 195;

const tmp = mkdtempSync(join(tmpdir(), "geodata-"));
mkdirSync("public/map", { recursive: true });

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// 1. Countries on UN borders: cut the moved areas out of whoever holds them, add them to their UN country,
// fold the merged states in, then take each country's fields (name, label point…) from its own feature.
const neFile = join(tmp, "ne.geojson");
const disputedFile = join(tmp, "disputed.geojson");
await download(NE_URL, neFile);
await download(NE_DISPUTED_URL, disputedFile);
await mapshaper.runCommands(
  `-i ${neFile} name=countries -i ${disputedFile} name=moves ` +
    `-filter target=moves '${JSON.stringify(UN_MOVES)}[BRK_A3] !== undefined' ` +
    `-each target=moves 'ADM0_A3 = ${JSON.stringify(UN_MOVES)}[BRK_A3]' ` +
    `-erase target=countries source=moves ` +
    `-merge-layers target=countries,moves name=countries force ` +
    `-each 'ADM0_A3 = ${JSON.stringify(UN_MERGES)}[ADM0_A3] || ADM0_A3' ` +
    `-dissolve2 ADM0_A3 ` +
    `-join ${neFile} keys=ADM0_A3,ADM0_A3 fields=NAME,NAME_LONG,CONTINENT,ADMIN,SOVEREIGNT,TYPE,UN_A3,LABEL_X,LABEL_Y,MIN_LABEL ` +
    `-each 'NAME = ${JSON.stringify(UN_NAMES)}[ADM0_A3] || (NAME.includes(".") ? NAME_LONG : NAME)' ` +
    `-simplify 15% keep-shapes -o public/map/countries.geojson format=geojson precision=0.001`,
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
// A UN member or observer: has a UN (M49) code, which drops Kosovo and Taiwan, and is its own sovereign's
// mainland feature (ADMIN === SOVEREIGNT), which drops territories (Hong Kong, Greenland, Jersey…).
// "Indeterminate" drops Antarctica and Western Sahara; Palestine is added back (UN observer state).
const isUnState = (p) => (p.UN_A3 !== "-099" && p.ADMIN === p.SOVEREIGNT && p.TYPE !== "Indeterminate") || p.ADM0_A3 === "PSX";
const area = ([w, s, e, n]) => (e - w) * (n - s);
const round = (v) => Math.round(v * 100) / 100;

const meta = simplified.features
  .filter((f) => f.geometry)
  .map((f) => {
    const box = polygons(f.geometry).map(bboxOf).sort((a, b) => area(b) - area(a))[0];
    const p = f.properties;
    return {
      iso: p.ADM0_A3, name: p.NAME, continent: p.CONTINENT, bbox: box.map(round), unState: isUnState(p),
      // Where to put the name on the map, and how early it earns a spot (lower = bigger/more important).
      label: [round(p.LABEL_X), round(p.LABEL_Y)], labelRank: p.MIN_LABEL,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const unStates = meta.filter((m) => m.unState).length;
if (unStates !== UN_STATES) throw new Error(`expected ${UN_STATES} UN member and observer states, got ${unStates}`);
writeFileSync("src/lib/map/countries.json", JSON.stringify(meta));
// The shipped GeoJSON only needs what the map reads; the other fields were for the meta above.
for (const f of simplified.features) {
  const { ADM0_A3, NAME, CONTINENT } = f.properties;
  f.properties = { ADM0_A3, NAME, CONTINENT };
}
writeFileSync("public/map/countries.geojson", JSON.stringify(simplified));

// 3. Regions: states from admin-1 plus the UK's nations. Skips odd codes (Jervis Bay's "AU-X02~") and states
// filed under a country the UN doesn't give them to (Crimea and Sevastopol, "UA-" codes listed under Russia).
const admin1File = join(tmp, "admin1.geojson");
const unitsFile = join(tmp, "units.geojson");
await download(NE_ADMIN1_URL, admin1File);
await download(NE_UNITS_URL, unitsFile);
const statesOut = join(tmp, "states.geojson");
const nationsOut = join(tmp, "nations.geojson");
const shapeOpts = "-filter-fields code,name,country -simplify 15% keep-shapes";
await mapshaper.runCommands(
  `-i ${admin1File} -filter '${JSON.stringify(REGION_COUNTRIES)}.includes(adm0_a3) && /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(iso_3166_2) && iso_3166_2.startsWith(iso_a2 + "-")' ` +
    `-each 'code=iso_3166_2, country=adm0_a3' ${shapeOpts} -o ${statesOut} format=geojson precision=0.001`,
);
await mapshaper.runCommands(
  `-i ${unitsFile} -filter 'GU_A3 in ${JSON.stringify(UK_NATIONS)}' ` +
    `-each 'code=${JSON.stringify(UK_NATIONS)}[GU_A3], name=GEOUNIT, country=ADM0_A3' ${shapeOpts} -o ${nationsOut} format=geojson precision=0.001`,
);
const regionShapes = {
  type: "FeatureCollection",
  features: [statesOut, nationsOut].flatMap((f) => JSON.parse(readFileSync(f, "utf8")).features),
};
writeFileSync("public/map/regions.geojson", JSON.stringify(regionShapes));
const regions = regionShapes.features
  .map((f) => {
    const box = polygons(f.geometry).map(bboxOf).sort((a, b) => area(b) - area(a))[0];
    return { code: f.properties.code, name: f.properties.name, country: f.properties.country, bbox: box.map(round) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync("src/lib/map/regions.json", JSON.stringify(regions));

// 4. Cities, each with its state when we track them (so visiting a city marks its state).
// GeoNames ISO-2 → Natural Earth ADM0_A3 via ISO_A2_EH (which is set even where ISO_A2 is -99).
// Several features can share an ISO_A2_EH (Ashmore and Cartier Is. is also "AU"), so the UN state
// wins and otherwise the first one seen is kept. Merged-away countries (Somaliland…) map to their UN country.
const iso2to3 = new Map();
for (const f of [...ne.features].sort((a, b) => Number(isUnState(b.properties)) - Number(isUnState(a.properties)))) {
  const { ISO_A2_EH: iso2, ADM0_A3: iso3 } = f.properties;
  if (iso2 && iso2 !== "-99" && !iso2to3.has(iso2)) iso2to3.set(iso2, UN_MERGES[iso3] ?? iso3);
}
const zipFile = join(tmp, "cities.zip");
await download(GEONAMES_URL, zipFile);
const tsv = execFileSync("unzip", ["-p", zipFile, "cities15000.txt"], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");

// GeoNames admin-1 ("US.CA") → ISO 3166-2 ("US-CA"). Where Natural Earth doesn't know the GeoNames
// code (Telangana, Indonesia's newer provinces), the state whose shape contains the city is used.
const gnToRegion = new Map(Object.entries(UK_NATIONS).map(([gn, code]) => [`GB.${gn}`, code]));
for (const { properties: p } of JSON.parse(readFileSync(admin1File, "utf8")).features) {
  if (REGION_COUNTRIES.includes(p.adm0_a3) && regions.some((r) => r.code === p.iso_3166_2)) gnToRegion.set(p.gn_a1_code, p.iso_3166_2);
}
const regionCountries = new Set(regions.map((r) => r.country));
/** Even-odd ray casting over every ring, so holes count as outside. */
function contains(geom, [x, y]) {
  return polygons(geom).some((rings) => {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}
function regionOf(iso2, admin1, iso3, lon, lat) {
  if (!regionCountries.has(iso3)) return undefined;
  return gnToRegion.get(`${iso2}.${admin1}`)
    ?? regionShapes.features.find((f) => f.properties.country === iso3 && contains(f.geometry, [lon, lat]))?.properties.code;
}

const cities = [];
let unmapped = 0;
let noRegion = 0;
for (const line of tsv.split("\n")) {
  const cols = line.split("\t");
  const pop = Number(cols[14]);
  if (!(pop > MIN_POP)) continue;
  const iso3 = iso2to3.get(cols[8]);
  if (!iso3) { unmapped++; continue; }
  const [lat, lon] = [Number(cols[4]), Number(cols[5])];
  const region = regionOf(cols[8], cols[10], iso3, lon, lat);
  if (regionCountries.has(iso3) && !region) noRegion++;
  cities.push([cols[1], iso3, round(lat), round(lon), pop, ...(region ? [region] : [])]);
}
cities.sort((a, b) => b[4] - a[4]);
writeFileSync("public/map/cities.json", JSON.stringify(cities));

// 5. Glyphs for the map's text labels (MapLibre can't draw text without them).
mkdirSync("public/map/fonts/sans", { recursive: true });
await download(GLYPHS_URL, "public/map/fonts/sans/0-255.pbf");

console.log(
  `countries: ${meta.length}, cities: ${cities.length} (skipped ${unmapped} with unmapped country codes, ${noRegion} without a state), ` +
    `regions: ${regions.length}`,
);
