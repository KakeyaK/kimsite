import { useMemo } from "preact/hooks";
import { isEmptyData } from "@apps/travel-map/lib/data";
import { createStore } from "@apps/travel-map/lib/storage";
import { cn } from "@lib/utils";
import { btn, MY_MAP_URL } from "./ui";

/** The way from a read-only map to the visitor's own: "Create my own map", or "Open my map" once they have one. */
export function MyMapLink({ class: className }: { class?: string }) {
  const hasMap = useMemo(() => !isEmptyData(createStore().load()), []);
  return (
    <a class={cn(btn, "bg-black/5 font-semibold text-black dark:bg-white/10 dark:text-white", className)} href={MY_MAP_URL}>
      {hasMap ? "Open my map" : "Create my own map"} →
    </a>
  );
}
