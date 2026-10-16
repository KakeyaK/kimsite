/**
 * The invite link shortener: a Cloudflare Worker at go.kakeya.kim (see README.md). It stores invites, not arbitrary
 * links, so every short link leads to an invite page on one of the site's own origins (the live site, its Cloudflare
 * Pages previews, the dev server) and nobody can hide another address behind the domain.
 *
 *   POST /         {"invite": "i=…"}  →  {"url": "https://go.kakeya.kim/Ab3dE9x"}
 *   GET  /Ab3dE9x  →  <the page that asked>/sandbox/travel-map/invite#i=…
 *
 * The invite is what lib/invite.ts's encodeInvite makes. A short link opens on the origin it was made on (taken from
 * the request's Origin header), so one made on a preview tests that preview's code. Only the short link is shared, so
 * the invite can be far longer than a link a chat app would carry. Most go out as a 302; one too long for a header
 * (Cloudflare caps them) gets a tiny page that forwards the browser instead.
 *
 * A code is the start of the invite link's SHA-256, so shortening the same invite twice gives the same code and costs
 * a KV read instead of a write. On the rare clash with another link, the code grows a character.
 */

/** The parts of Cloudflare's KVNamespace used here (the full type lives in @cloudflare/workers-types). */
export interface Store {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  LINKS: Store;
  /** The live site, with no trailing slash: https://www.kakeya.kim. The bare go.kakeya.kim redirects there. */
  SITE: string;
  /**
   * The origins that may make short links, separated by spaces. `*` stands for one subdomain label, so
   * `https://*.kimsite.pages.dev` covers every preview.
   */
  ORIGINS: string;
}

export const INVITE_PATH = "/sandbox/travel-map/invite";
/** Above the largest invite the planner can make (a full message of random CJK text, ~82 KB; see the tests). */
export const MAX_INVITE = 128_000;
/** encodeInvite's output: lz-string's URI-safe alphabet after "i=". */
const INVITE_RE = /^i=[A-Za-z0-9+$-]+$/;
const MIN_CODE = 7;
const MAX_CODE = 12;
const CODE_RE = new RegExp(`^/([0-9A-Za-z]{${MIN_CODE},${MAX_CODE}})$`);
/** The longest invite URL sent in a Location header; longer ones get the forwarding page. */
export const MAX_REDIRECT = 8_000;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** The link's SHA-256 in base 62, MAX_CODE characters long. */
async function digest(link: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(link)));
  let n = hash.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
  let out = "";
  for (let i = 0; i < MAX_CODE; i++, n /= 62n) out += ALPHABET[Number(n % 62n)];
  return out;
}

/** Store the invite link and return its code; null in the (astronomically unlikely) case every length clashes. */
export async function shorten(store: Store, link: string): Promise<string | null> {
  const full = await digest(link);
  for (let len = MIN_CODE; len <= MAX_CODE; len++) {
    const code = full.slice(0, len);
    const existing = await store.get(code);
    if (existing === link) return code;
    if (existing === null) {
      await store.put(code, link);
      return code;
    }
  }
  return null;
}

/** Why the invite can't be stored, or null when it can. */
export function rejectInvite(invite: unknown): string | null {
  if (typeof invite !== "string") return "Send {\"invite\": \"i=…\"}.";
  if (invite.length > MAX_INVITE) return "That invite is too long.";
  if (!INVITE_RE.test(invite)) return "That isn't an invite.";
  return null;
}

/** Whether an Origin header is one of `ORIGINS`. */
export function isAllowedOrigin(origin: string | null, origins: string): boolean {
  if (!origin) return false;
  return origins.split(/\s+/).filter(Boolean).some((pattern) => {
    const re = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]+");
    return new RegExp(`^${re}$`).test(origin);
  });
}

function cors(origin: string | null, env: Env, headers: Record<string, string> = {}): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin, env.ORIGINS) ? origin : env.SITE,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
    ...headers,
  });
}

/** A code always holds the same link, so the answer can be cached. */
const CACHE = { "Cache-Control": "public, max-age=86400" };

/** Send the browser to the invite. The link is an allowed origin plus lz-string's alphabet, so it needs no escaping in HTML. */
function forward(link: string): Response {
  if (link.length <= MAX_REDIRECT) return new Response(null, { status: 302, headers: { Location: link, ...CACHE } });
  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Trip invite</title>
<meta http-equiv="refresh" content="0;url=${link}"><script>location.replace(${JSON.stringify(link)})</script>
<p><a href="${link}">Open the invite</a></p>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...CACHE } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, origin: self } = new URL(request.url);
    const origin = request.headers.get("Origin");
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: cors(origin, env, { "Content-Type": "application/json" }) });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin, env) });

    if (request.method === "POST" && pathname === "/") {
      if (!isAllowedOrigin(origin, env.ORIGINS)) return json({ error: "Short links are made from the site." }, 403);
      const body = (await request.json().catch(() => null)) as { invite?: unknown } | null;
      const error = rejectInvite(body?.invite);
      if (error) return json({ error }, 400);
      const code = await shorten(env.LINKS, `${origin}${INVITE_PATH}#${body!.invite as string}`);
      return code ? json({ url: `${self}/${code}` }) : json({ error: "Couldn't make a code." }, 500);
    }

    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    if (pathname === "/") return Response.redirect(env.SITE, 302);

    const code = CODE_RE.exec(pathname)?.[1];
    const link = code ? await env.LINKS.get(code) : null;
    if (!link) return new Response("This link doesn't exist.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    return forward(link);
  },
};
