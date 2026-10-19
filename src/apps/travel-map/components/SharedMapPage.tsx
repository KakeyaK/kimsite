import { useEffect, useState } from "preact/hooks";
import { KNOWN_CODES } from "@apps/travel-map/lib/meta";
import { decodeSharedMap, parseSharedHash } from "@apps/travel-map/lib/sharedMap";
import { cn } from "@lib/utils";
import { MapViewer } from "./MapViewer";
import { btn, container, MY_MAP_URL } from "./ui";
import { mapIsland } from "./island";

/** A map someone shared as a link (`/shared#m=…`), shown read-only. */
export function SharedMapPage() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    // Opening a second shared link in the same tab only changes the hash; re-render for it.
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const payload = parseSharedHash(hash);
  const decoded = payload ? decodeSharedMap(payload, KNOWN_CODES) : null;

  if (!payload || !decoded) {
    return (
      <div class={cn(container, "space-y-4")}>
        <h1 class="text-2xl font-semibold text-black dark:text-white">This map link looks broken 🧭</h1>
        <p>The link may have been cut off when it was pasted. Ask your friend to send it again.</p>
        <a class={btn} href={MY_MAP_URL}>Open my map</a>
      </div>
    );
  }

  const { name } = decoded.value;
  return (
    <div class="space-y-6">
      <div class={cn(container, "space-y-1")}>
        <h1 class="text-2xl font-semibold text-black dark:text-white">{name ? `${name}'s travel map` : "A shared travel map"}</h1>
        <p class="text-sm">A snapshot{name ? ` ${name}` : ""} shared with you. Compare it with your own map to find places to go together.</p>
        {decoded.unknown.length > 0 && (
          <p class="text-sm text-amber-600 dark:text-amber-400">Some places on this map weren't recognized and were skipped.</p>
        )}
      </div>
      <MapViewer key={payload} data={decoded.value.data} owner={name ?? "Your friend"} />
    </div>
  );
}

export default mapIsland(SharedMapPage);
