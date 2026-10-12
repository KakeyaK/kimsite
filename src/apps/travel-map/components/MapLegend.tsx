import { STATUSES } from "@apps/travel-map/lib/data";
import type { ColorKey } from "@apps/travel-map/lib/stats";
import { cn } from "@lib/utils";
import { Swatch } from "./Swatch";
import { overlay, STATUS_LABEL } from "./ui";

export type LegendItem = [color: ColorKey, label: string];

export const STATUS_LEGEND: LegendItem[] = STATUSES.map((s) => [s, STATUS_LABEL[s]]);

/** Where the legend floats: the map's bottom-left corner, clear of the zoom buttons on the right. */
export const legendCorner = "pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-4.5rem)]";

/** What the map's colours mean, floating over the map. */
export function MapLegend({ items, class: className }: { items: LegendItem[]; class?: string }) {
  return (
    <ul aria-label="Legend" class={cn(overlay, "flex flex-wrap gap-x-3 gap-y-1 px-3 py-1.5 text-sm", className)}>
      {items.map(([color, label]) => (
        <li key={color}><Swatch color={color} /> {label}</li>
      ))}
    </ul>
  );
}
