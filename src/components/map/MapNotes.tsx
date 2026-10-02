import { REGIONS, countryName, regionsOf } from "@lib/map/meta";
import { TOTAL_COUNTRIES } from "@lib/map/stats";

const link = "underline underline-offset-2";
const byName = (a: string, b: string) => a.localeCompare(b);
/** Countries split into states or provinces. The UK is listed apart: its regions are its four nations. */
const WITH_STATES = [...new Set(REGIONS.map((r) => r.country))].filter((iso) => iso !== "GBR").map(countryName).sort(byName);
const UK_NATIONS = regionsOf("GBR").map((r) => r.name).sort(byName);

/** Where the data comes from and which conventions the map follows. Goes at the end of the page. */
export function MapNotes() {
  return (
    <section aria-label="About the data" class="space-y-1 border-t border-black/10 dark:border-white/15 pt-4 text-xs">
      <p>
        Country and state shapes come from <a class={link} href="https://www.naturalearthdata.com/">Natural Earth</a>; cities (those
        with more than 100,000 people) from <a class={link} href="https://www.geonames.org/">GeoNames</a>.
      </p>
      <p>
        Borders, names and the count of {TOTAL_COUNTRIES} countries follow the United Nations: its 193 members plus its 2 observer
        states (the Holy See and Palestine). Other places, such as Kosovo, Taiwan or Hong Kong, can be marked but aren't counted.
      </p>
      <p>
        To keep the map quick to load, only some countries are split into states or provinces: {WITH_STATES.join(", ")}. The
        United Kingdom is split into its nations: {UK_NATIONS.join(", ")}.
      </p>
    </section>
  );
}
