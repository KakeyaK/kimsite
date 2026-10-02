import type { Status } from "@apps/travel-map/lib/data";

export const btn =
  "rounded border border-black/15 dark:border-white/20 px-2.5 py-1 text-sm text-black/75 dark:text-white/75 " +
  "hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none";
export const btnActive = "bg-black/10 dark:bg-white/15 text-black dark:text-white";
export const input =
  "w-full rounded border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm text-black dark:text-white";
export const card = "rounded-lg border border-black/15 dark:border-white/20 p-4";
/** Full-bleed map: spans the whole page width; page content around it uses `container`. */
export const mapBox = "h-[70vh] min-h-[420px] w-full border-y border-black/15 dark:border-white/20";
export const container = "mx-auto max-w-screen-lg px-5";
/** Solid, blurred surface for controls floating on top of the map. */
export const overlay =
  "rounded-lg border border-black/15 dark:border-white/20 bg-stone-100/95 dark:bg-stone-900/95 backdrop-blur shadow-lg";

export const STATUS_LABEL: Record<Status, string> = { visited: "Visited", lived: "Lived", want: "Want to go" };
