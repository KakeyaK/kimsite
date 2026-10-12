import type { TravelData } from "@apps/travel-map/lib/data";
import { OVERLAP_KEYS, overlapCounts, type OverlapKey } from "@apps/travel-map/lib/overlap";
import { Swatch } from "./Swatch";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The overlap colours, with how many countries (and states) fall in each. */
export function OverlapLegend({ owner, data, mine }: { owner: string; data: TravelData; mine: TravelData }) {
  const counts = overlapCounts(data, mine);
  const label: Record<OverlapKey, string> = {
    "both-been": "Both been",
    "both-want": "Both want to go",
    "only-them": `Only ${owner}`,
    "only-you": "Only you",
  };

  return (
    <section aria-label="Your maps compared" class="space-y-3 text-sm">
      <p class="text-black dark:text-white">
        <span class="text-2xl font-semibold">{counts["both-been"].countries}</span>{" "}
        {counts["both-been"].countries === 1 ? "country" : "countries"} in common
      </p>
      <ul class="grid gap-1 sm:grid-cols-2">
        {OVERLAP_KEYS.map((key) => (
          <li key={key}>
            <Swatch color={key} /> {label[key]}: {plural(counts[key].countries, "country", "countries")}
            {counts[key].regions > 0 && `, ${plural(counts[key].regions, "state", "states")}`}
          </li>
        ))}
      </ul>
      <p class="text-xs">"Been" means visited or lived. A place only one of you wants to go to isn't coloured.</p>
    </section>
  );
}
