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
  `-i ${neFile} -filter-fields ADM0_A3,NAME,CONTINENT,ADMIN,SOVEREIGNT,TYPE -simplify 15% keep-shapes ` +
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
// A state's own mainland feature has ADMIN === SOVEREIGNT; territories (Hong Kong, Greenland, Jersey…) don't.
// "Indeterminate" drops Antarctica, Western Sahara and Kashmir; Palestine is added back (UN observer state, part of the 195).
const isSovereign = (p) => (p.ADMIN === p.SOVEREIGNT && p.TYPE !== "Indeterminate") || p.ADM0_A3 === "PSX";
const area = ([w, s, e, n]) => (e - w) * (n - s);
const round = (v) => Math.round(v * 100) / 100;

const meta = simplified.features
  .filter((f) => f.geometry)
  .map((f) => {
    const box = polygons(f.geometry).map(bboxOf).sort((a, b) => area(b) - area(a))[0];
    const p = f.properties;
    return { iso: p.ADM0_A3, name: p.NAME, continent: p.CONTINENT, bbox: box.map(round), sovereign: isSovereign(p) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync("src/lib/map/countries.json", JSON.stringify(meta));
// The shipped GeoJSON only needs what the map reads; the sovereignty fields were for the meta above.
for (const f of simplified.features) {
  const { ADM0_A3, NAME, CONTINENT } = f.properties;
  f.properties = { ADM0_A3, NAME, CONTINENT };
}
writeFileSync("public/map/countries.geojson", JSON.stringify(simplified));

// 3. Cities: GeoNames ISO-2 → Natural Earth ADM0_A3 via ISO_A2_EH (which is set even where ISO_A2 is -99).
// Several features can share an ISO_A2_EH (Ashmore and Cartier Is. is also "AU"), so the sovereign
// feature wins and otherwise the first one seen is kept.
const iso2to3 = new Map();
for (const f of [...ne.features].sort((a, b) => Number(isSovereign(b.properties)) - Number(isSovereign(a.properties)))) {
  const { ISO_A2_EH: iso2, ADM0_A3: iso3 } = f.properties;
  if (iso2 && iso2 !== "-99" && !iso2to3.has(iso2)) iso2to3.set(iso2, iso3);
}
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
