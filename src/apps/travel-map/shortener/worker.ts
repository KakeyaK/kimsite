/**
 * The invite link shortener: a Cloudflare Worker at go.kakeya.kim (see README.md). It stores invites, not links, so
 * every short link leads to the invite page and nobody can hide another address behind the domain.
 *
 *   POST /             {"invite": "i=…"}  →  {"url": "https://go.kakeya.kim/Ab3dE9x"}
 *   GET  /Ab3dE9x      →  302 to https://www.kakeya.kim/sandbox/travel-map/invite#s=Ab3dE9x
 *   GET  /api/Ab3dE9x  →  {"invite": "i=…"}, which the invite page fetches and opens
 *
 * The invite is what lib/invite.ts's encodeInvite makes. Since it never travels in a URL, it can be far longer than a
 * link a chat app would carry. A code is the start of the invite's SHA-256, so shortening the same invite twice gives
 * the same code and costs a KV read instead of a write. On the rare clash with another invite, the code grows a
 * character.
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

export const INVITE_PATH = "/sandbox/travel-map/invite";
/** Above the largest invite the planner can make (a full message of random CJK text, ~82 KB; see the tests). */
export const MAX_INVITE = 128_000;
/** encodeInvite's output: lz-string's URI-safe alphabet after "i=". */
const INVITE_RE = /^i=[A-Za-z0-9+$-]+$/;
const MIN_CODE = 7;
const MAX_CODE = 12;
const CODE = `[0-9A-Za-z]{${MIN_CODE},${MAX_CODE}}`;
const REDIRECT_RE = new RegExp(`^/(${CODE})$`);
const API_RE = new RegExp(`^/api/(${CODE})$`);
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** The invite's SHA-256 in base 62, MAX_CODE characters long. */
async function digest(invite: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(invite)));
  let n = hash.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
  let out = "";
  for (let i = 0; i < MAX_CODE; i++, n /= 62n) out += ALPHABET[Number(n % 62n)];
  return out;
}

/** Store the invite and return its code; null in the (astronomically unlikely) case every length clashes. */
export async function shorten(store: Store, invite: string): Promise<string | null> {
  const full = await digest(invite);
  for (let len = MIN_CODE; len <= MAX_CODE; len++) {
    const code = full.slice(0, len);
    const existing = await store.get(code);
    if (existing === invite) return code;
    if (existing === null) {
      await store.put(code, invite);
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

function cors(env: Env, headers: Record<string, string> = {}): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": env.SITE,
    "Access-Control-Allow-Methods": "GET, POST",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
    ...headers,
  });
}

const json = (env: Env, body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: cors(env, { "Content-Type": "application/json", ...headers }) });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, origin } = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });

    if (request.method === "POST" && pathname === "/") {
      const body = (await request.json().catch(() => null)) as { invite?: unknown } | null;
      const error = rejectInvite(body?.invite);
      if (error) return json(env, { error }, 400);
      const code = await shorten(env.LINKS, body!.invite as string);
      return code ? json(env, { url: `${origin}/${code}` }) : json(env, { error: "Couldn't make a code." }, 500);
    }

    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    if (pathname === "/") return Response.redirect(env.SITE, 302);

    // A code always holds the same invite, so both answers can be cached.
    const api = API_RE.exec(pathname)?.[1];
    if (api) {
      const invite = await env.LINKS.get(api);
      return invite
        ? json(env, { invite }, 200, { "Cache-Control": "public, max-age=86400" })
        : json(env, { error: "This invite doesn't exist." }, 404);
    }

    const code = REDIRECT_RE.exec(pathname)?.[1];
    if (!code || !(await env.LINKS.get(code))) {
      return new Response("This link doesn't exist.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response(null, {
      status: 302,
      headers: { Location: `${env.SITE}${INVITE_PATH}#s=${code}`, "Cache-Control": "public, max-age=86400" },
    });
  },
};
