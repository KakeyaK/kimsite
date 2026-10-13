/** The invite link shortener, a Cloudflare Worker (see shortener/README.md). */
export const SHORTENER = "https://go.kakeya.kim";

/**
 * The short form of an invite link, or null when it can't be had (offline, the shortener is down, or the link isn't
 * on the live site, as on the dev server). The full link always works, so callers fall back to it.
 */
export async function shortenLink(url: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(SHORTENER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: unknown };
    return typeof body.url === "string" && body.url.startsWith(`${SHORTENER}/`) ? body.url : null;
  } catch {
    return null;
  }
}
