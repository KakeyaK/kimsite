import raw from "./travel.json";
import { dropUnknown, travelDataSchema, type TravelData } from "@apps/travel-map/lib/data";
import { KNOWN_CODES } from "@apps/travel-map/lib/meta";

/** Kim's own map (travel.json), validated at build time: an invalid file fails the build. */
export function loadKimData(): TravelData {
  const parsed = travelDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`src/apps/travel-map/data/travel.json is invalid:\n${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const { data, unknown } = dropUnknown(parsed.data, KNOWN_CODES);
  if (unknown.length) console.warn(`travel.json: ignoring unknown place codes ${unknown.join(", ")}`);
  return data;
}
