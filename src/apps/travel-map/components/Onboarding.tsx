import { useEffect, useRef } from "preact/hooks";
import type { TravelData } from "@apps/travel-map/lib/data";
import { downloadJson } from "@apps/travel-map/lib/storage";
import { cn } from "@lib/utils";
import { btn, overlay } from "./ui";

interface Props {
  data: TravelData;
  /** False when the browser blocks storage. */
  persistent: boolean;
  onClose: () => void;
}

/** The welcome card over an empty map: how to mark places, and where the map is (not) kept. */
export function Onboarding({ data, persistent, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="onboarding-title"
      class={cn(overlay, "absolute left-1/2 top-1/2 z-20 max-h-[calc(100%-1.5rem)] w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 space-y-3 overflow-y-auto p-5 text-sm focus:outline-none")}
    >
      <div class="flex items-start justify-between gap-2">
        <h2 id="onboarding-title" class="text-lg font-semibold text-black dark:text-white">Make your travel map</h2>
        <button type="button" class={btn} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <ul class="list-disc space-y-1.5 pl-5">
        <li>Click a country to mark it as visited, lived or want to go. Zoom in to mark states.</li>
        <li>
          Your map is saved only in this browser. Clearing your browser data, or switching device, loses it.
        </li>
        <li>Export it to a file to keep a copy, or to move it to another browser (Import is below the map).</li>
      </ul>
      {!persistent && (
        <p role="status" class="rounded border border-amber-500/40 bg-amber-500/10 p-2">
          Your browser is blocking storage right now, so this map won't be kept when you leave. Export it before you go.
        </p>
      )}
      <div class="flex flex-wrap gap-2">
        <button type="button" class={btn} onClick={() => downloadJson(data)}>Export my map</button>
        <button type="button" class={cn(btn, "font-semibold text-black dark:text-white")} onClick={onClose}>Got it</button>
      </div>
    </section>
  );
}
