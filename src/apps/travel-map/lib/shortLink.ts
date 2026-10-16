import type { KnownCodes } from "./data";
import type { CityRow } from "./cities";
import { decodeInvite, type DecodeResult } from "./invite";

/**
 * The invite link shortener, a Cloudflare Worker (see shortener/README.md). Every invite is shared as one of its short
 * links: go.kakeya.kim/<code> leads to the invite page at #s=<code>, which fetches the invite from it.
 */
export const SHORTENER = "https://go.kakeya.kim";

const SHORT_HASH_RE = /^#s=([0-9A-Za-z]{7,12})$/;

/**
 * A short link for an invite (what encodeInvite makes), or null when it can't be had (offline, the shortener is down,
 * or on the dev server, which the shortener doesn't answer).
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

/** The invite behind a short link's code; why not, when it can't be had. */
async function loadShortInvite(code: string, fetcher: typeof fetch): Promise<{ invite: string } | { missing: boolean }> {
  try {
    const res = await fetcher(`${SHORTENER}/api/${code}`);
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { missing: false };
    const body = (await res.json()) as { invite?: unknown };
    return typeof body.invite === "string" ? { invite: body.invite } : { missing: false };
  } catch {
    return { missing: false };
  }
}

/**
 * Read an invite page's hash: a short link's `#s=<code>`, fetched from the shortener, or a full invite (`#i=…`, or an
 * older `#to=…`), as decodeInvite reads it.
 */
export async function readInviteHash(
  hash: string,
  known: KnownCodes,
  loadCities: () => Promise<CityRow[]>,
  fetcher: typeof fetch = fetch,
): Promise<DecodeResult> {
  const code = SHORT_HASH_RE.exec(hash)?.[1];
  if (!code) return decodeInvite(hash, known, loadCities);
  const r = await loadShortInvite(code, fetcher);
  if ("invite" in r) return decodeInvite(`#${r.invite}`, known, loadCities);
  return {
    ok: false,
    error: {
      field: "s",
      message: r.missing
        ? "isn't an invite: no invite has this code"
        : "couldn't be loaded. Check your connection and reload the page",
    },
  };
}
