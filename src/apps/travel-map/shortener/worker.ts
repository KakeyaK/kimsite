/**
 * The invite link shortener: a Cloudflare Worker at go.kakeya.kim (see README.md). It only shortens invite links
 * on the site, so nobody can hide another address behind the domain.
 *
 *   POST /        {"url": "https://www.kakeya.kim/sandbox/travel-map/invite#i=…"}  →  {"url": "https://go.kakeya.kim/Ab3dE9x"}
 *   GET  /Ab3dE9x  →  302 to the invite
 *
 * A code is the start of the link's SHA-256, so shortening the same invite twice gives the same code and costs a
 * KV read instead of a write. On the rare clash with another link, the code grows a character.
 */

/** The parts of Cloudflare's KVNamespace used here (the full type lives in @cloudflare/workers-types). */
export interface Store {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  LINKS: Store;
  /** The site, with no trailing slash: https://www.kakeya.kim */
  SITE: string;
}

export const INVITE_PATH = "/sandbox/travel-map/invite#";
/** Well above the longest invite the planner makes. */
export const MAX_URL = 16_000;
const MIN_CODE = 7;
const MAX_CODE = 12;
const CODE_RE = new RegExp(`^/([0-9A-Za-z]{${MIN_CODE},${MAX_CODE}})$`);
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** The link's SHA-256 in base 62, MAX_CODE characters long. */
async function digest(url: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)));
  let n = hash.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
  let out = "";
  for (let i = 0; i < MAX_CODE; i++, n /= 62n) out += ALPHABET[Number(n % 62n)];
  return out;
}

/** Store the link and return its code; null in the (astronomically unlikely) case every length clashes. */
export async function shorten(store: Store, url: string): Promise<string | null> {
  const full = await digest(url);
  for (let len = MIN_CODE; len <= MAX_CODE; len++) {
    const code = full.slice(0, len);
    const existing = await store.get(code);
    if (existing === url) return code;
    if (existing === null) {
      await store.put(code, url);
      return code;
    }
  }
  return null;
}

/** Why the link can't be shortened, or null when it can. */
export function rejectUrl(url: unknown, site: string): string | null {
  if (typeof url !== "string") return "Send {\"url\": \"…\"}.";
  if (url.length > MAX_URL) return "That link is too long.";
  if (!url.startsWith(site + INVITE_PATH) || url.length === (site + INVITE_PATH).length) return "Only travel map invites can be shortened.";
  return null;
}

function cors(env: Env, headers: Record<string, string> = {}): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": env.SITE,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
    ...headers,
  });
}

const json = (env: Env, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(env, { "Content-Type": "application/json" }) });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, origin } = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });

    if (request.method === "POST" && pathname === "/") {
      const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
      const error = rejectUrl(body?.url, env.SITE);
      if (error) return json(env, { error }, 400);
      const code = await shorten(env.LINKS, body!.url as string);
      return code ? json(env, { url: `${origin}/${code}` }) : json(env, { error: "Couldn't make a code." }, 500);
    }

    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    if (pathname === "/") return Response.redirect(env.SITE, 302);

    const code = CODE_RE.exec(pathname)?.[1];
    const target = code ? await env.LINKS.get(code) : null;
    if (!target) return new Response("This link doesn't exist.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    // A code always points to the same invite, so the redirect can be cached.
    return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "public, max-age=86400" } });
  },
};
