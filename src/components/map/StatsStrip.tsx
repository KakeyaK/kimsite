import type { TravelData } from "@lib/map/data";
import { STATUSES } from "@lib/map/data";
import { badges, continentProgress, countedBeenTo, counts, regionProgress, TOTAL_COUNTRIES } from "@lib/map/stats";
import { COUNTRIES, REGIONS, countryName, regionByCode } from "@lib/map/meta";
import { STATUS_LABEL } from "./ui";
import { Swatch } from "./Swatch";

export function StatsStrip({ data }: { data: TravelData }) {
  const c = counts(data);
  const been = countedBeenTo(data, COUNTRIES).length;
  const progress = continentProgress(data, COUNTRIES);
  const earned = badges(data, COUNTRIES);
  // State counts for countries we track states for, once the country or one of its states is on the map.
  const withStates = [...new Set(REGIONS.map((r) => r.country))].filter(
    (iso) => data.countries[iso] || Object.keys(data.regions).some((code) => regionByCode(code)?.country === iso),
  );

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
      {withStates.map((iso) => {
        const { been, total } = regionProgress(data, iso);
        return (
          <p key={iso} class="text-black dark:text-white">
            {countryName(iso)}: <span class="font-semibold">{been}</span> / {total} states
          </p>
        );
      })}
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
