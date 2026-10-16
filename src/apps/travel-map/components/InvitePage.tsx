import { useEffect, useState } from "preact/hooks";
import { loadCities } from "@apps/travel-map/lib/cities";
import type { DecodeResult } from "@apps/travel-map/lib/invite";
import { KNOWN_CODES } from "@apps/travel-map/lib/meta";
import { readInviteHash } from "@apps/travel-map/lib/shortLink";
import { cn } from "@lib/utils";
import { InviteView } from "./InviteView";
import { btn, container, MY_MAP_URL } from "./ui";

export default function InvitePage() {
  const [hash, setHash] = useState(() => window.location.hash);
  /** null while decoding: a short link's invite and a city stop's city list are fetched. */
  const [result, setResult] = useState<DecodeResult | null>(null);

  useEffect(() => {
    // Opening a second invite link in the same tab only changes the hash; re-render for it.
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void readInviteHash(hash, KNOWN_CODES, loadCities).then((r) => !cancelled && setResult(r));
    return () => { cancelled = true; };
  }, [hash]);

  if (!result) return <p class={cn(container, "text-sm")}>Unfolding your invite…</p>;
  if (result.ok) return <InviteView key={hash} invite={result.value} unknown={result.unknown} />;

  return (
    <div class={cn(container, "space-y-4")}>
      <h1 class="text-2xl font-semibold text-black dark:text-white">This invite looks broken 🧭</h1>
      <p>The link may be incomplete. Ask your friend to send it again.</p>
      <p class="text-sm">
        What's wrong: <code>{result.error.field}</code> {result.error.message}
      </p>
      <a class={btn} href={MY_MAP_URL}>Open my map</a>
    </div>
  );
}
