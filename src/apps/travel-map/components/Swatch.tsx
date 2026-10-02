import type { ColorKey } from "@apps/travel-map/lib/stats";

export function Swatch({ color }: { color: ColorKey }) {
  return <span class="inline-block size-3 rounded-sm align-middle" style={{ background: `var(--map-${color})` }} aria-hidden="true" />;
}
