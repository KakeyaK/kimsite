/**
 * The invite link shortener, a Cloudflare Worker (see shortener/README.md). Every invite is shared as one of its short
 * links, go.kakeya.kim/<code>, which forwards to the full invite link on the site it was made on: the live site, a
 * Cloudflare Pages preview or the dev server.
 */
export const SHORTENER = "https://go.kakeya.kim";

/**
 * A short link for an invite (what encodeInvite makes), or null when it can't be had (offline, the shortener is down,
 * or the page is on an origin the shortener doesn't take).
 */
export async function shortenInvite(invite: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(SHORTENER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: unknown };
    return typeof body.url === "string" && body.url.startsWith(`${SHORTENER}/`) ? body.url : null;
  } catch {
    return null;
  }
}
