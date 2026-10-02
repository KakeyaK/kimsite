import type { ISO3, TravelData } from "@apps/travel-map/lib/data";
import { regionNoun, regionsOf } from "@apps/travel-map/lib/meta";
import { regionProgress } from "@apps/travel-map/lib/stats";
import { Swatch } from "./Swatch";

/** A country's states (or nations, provinces…) with their status, e.g. "12 / 27 states". Renders nothing for countries without them. */
export function RegionList({ iso, data, onPick }: { iso: ISO3; data: TravelData; onPick: (code: string) => void }) {
  const states = regionsOf(iso);
  if (states.length === 0) return null;
  const { been, total } = regionProgress(data, iso);

  return (
    <div class="space-y-2 text-sm">
      <p class="font-semibold text-black dark:text-white">
        {been} / {total} {regionNoun(iso)}
      </p>
      <ul class="grid grid-cols-2 gap-x-3 gap-y-0.5" aria-label={regionNoun(iso)}>
        {states.map((r) => {
          const entry = data.regions[r.code];
          return (
            <li key={r.code}>
              <button type="button" class="flex w-full items-center gap-1.5 text-left hover:underline" onClick={() => onPick(r.code)}>
                {entry ? (
                  <Swatch color={entry.status} />
                ) : (
                  <span class="inline-block size-3 shrink-0 rounded-sm border border-black/20 dark:border-white/25" aria-hidden="true" />
                )}
                <span class="truncate">{r.name}</span>
                <span class="sr-only">{entry ? `, ${entry.status}` : ", not marked"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
