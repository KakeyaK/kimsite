import { useEffect, useState } from "preact/hooks";
import { decodeInvite, parseHash } from "@apps/travel-map/lib/invite";
import { KNOWN_CODES } from "@apps/travel-map/lib/meta";
import { cn } from "@lib/utils";
import { InviteView } from "./InviteView";
import { btn, container } from "./ui";

export default function InvitePage() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    // Opening a second invite link in the same tab only changes the hash; re-render for it.
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const payload = parseHash(hash);
  const decoded = payload ? decodeInvite(payload, KNOWN_CODES) : null;
  if (payload && decoded) return <InviteView key={payload} invite={decoded.value} unknown={decoded.unknown} />;

  return (
    <div class={cn(container, "space-y-4")}>
      <h1 class="text-2xl font-semibold text-black dark:text-white">This invite looks broken 🧭</h1>
      <p>The link may have been cut off when it was pasted. Ask your friend to send it again.</p>
      <a class={btn} href="/sandbox/travel-map">Go to the travel map</a>
    </div>
  );
}
