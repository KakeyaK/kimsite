import type { ISO3 } from "@lib/map/data";
import { countryName } from "@lib/map/meta";

const list = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
export const placeList = (isos: ISO3[]): string => list.format(isos.map(countryName));
