import type { TravelData } from "@apps/travel-map/lib/data";
import { STATUSES } from "@apps/travel-map/lib/data";
import { continentProgress, countedBeenTo, counts, TOTAL_COUNTRIES } from "@apps/travel-map/lib/stats";
import { COUNTRIES } from "@apps/travel-map/lib/meta";
import { STATUS_LABEL } from "./ui";
import { Swatch } from "./Swatch";

export function StatsStrip({ data }: { data: TravelData }) {
  const c = counts(data);
  const been = countedBeenTo(data, COUNTRIES).length;
  const progress = continentProgress(data, COUNTRIES);

  return (
    <section aria-label="Stats" class="space-y-3 text-sm">
      <div class="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p class="text-black dark:text-white">
          <span class="text-2xl font-semibold">{been}</span> / {TOTAL_COUNTRIES} countries
          {" "}({Math.round((been / TOTAL_COUNTRIES) * 100)}%)
        </p>
        <ul class="flex flex-wrap gap-4">
          {STATUSES.map((s) => (
            <li key={s}><Swatch color={s} /> {STATUS_LABEL[s]}: {c[s]}</li>
          ))}
        </ul>
      </div>
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
