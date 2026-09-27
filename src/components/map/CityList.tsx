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
        <li key={c.id} class="flex items-center gap-1.5">
          <span class="min-w-0 flex-1 truncate text-black dark:text-white" title={c.name}>{c.custom ? "📍 " : ""}{c.name}</span>
          {(["visited", "want"] as const).map((s) => (
            <button
              key={s}
              type="button"
              class={cn(btn, "shrink-0 px-1.5 py-0.5 text-xs", c.status === s && btnActive)}
              aria-pressed={c.status === s}
              onClick={() => onChange({ ...c, status: s })}
            >
              {s === "visited" ? "Been" : "Want"}
            </button>
          ))}
          <input
            class={cn(input, "w-14 shrink-0 px-1.5 py-0.5 text-xs")}
            inputMode="numeric"
            placeholder="Year"
            aria-label={`Year for ${c.name}`}
            value={c.year ?? ""}
            onChange={(e) => {
              const y = Number((e.currentTarget as HTMLInputElement).value);
              onChange({ ...c, year: Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : undefined });
            }}
          />
          <button type="button" class={cn(btn, "shrink-0 px-1.5 py-0.5 text-xs")} aria-label={`Remove ${c.name}`} onClick={() => onRemove(c.id)}>
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
