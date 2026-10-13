import { describe, expect, it } from "vitest";
import worker, { MAX_URL, rejectUrl, shorten, type Env, type Store } from "./worker";

const SITE = "https://www.kakeya.kim";
const invite = `${SITE}/sandbox/travel-map/invite#i=N4IgLg`;

function memoryStore(): Store & { data: Map<string, string>; writes: number } {
  const data = new Map<string, string>();
  return {
    data,
    writes: 0,
    async get(k) { return data.get(k) ?? null; },
    async put(k, v) { this.writes++; data.set(k, v); },
  };
}

const env = (): Env => ({ LINKS: memoryStore(), SITE });
const post = (e: Env, body: unknown) =>
  worker.fetch(new Request("https://go.kakeya.kim/", { method: "POST", body: JSON.stringify(body) }), e);
const get = (e: Env, path: string) => worker.fetch(new Request(`https://go.kakeya.kim${path}`), e);

describe("shortener", () => {
  it("shortens an invite and redirects to it, fragment included", async () => {
    const e = env();
    const res = await post(e, { url: invite });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
    const { url } = (await res.json()) as { url: string };
    expect(url).toMatch(/^https:\/\/go\.kakeya\.kim\/[0-9A-Za-z]{7}$/);

    const hop = await get(e, new URL(url).pathname);
    expect(hop.status).toBe(302);
    expect(hop.headers.get("Location")).toBe(invite);
  });

  it("gives the same invite the same code, with one write", async () => {
    const store = memoryStore();
    expect(await shorten(store, invite)).toBe(await shorten(store, invite));
    expect(store.writes).toBe(1);
  });

  it("lengthens the code when it clashes with another link", async () => {
    const store = memoryStore();
    const code = (await shorten(store, invite))!;
    store.data.set(code, `${invite}other`);
    const longer = await shorten(store, invite);
    expect(longer).toHaveLength(8);
    expect(longer!.startsWith(code)).toBe(true);
  });

  it("only takes invites on the site", () => {
    expect(rejectUrl(invite, SITE)).toBeNull();
    expect(rejectUrl("https://evil.example/sandbox/travel-map/invite#i=x", SITE)).not.toBeNull();
    expect(rejectUrl(`${SITE}/sandbox/travel-map/invite.evil.example#i=x`, SITE)).not.toBeNull();
    expect(rejectUrl(`${SITE}/blog`, SITE)).not.toBeNull();
    expect(rejectUrl(`${SITE}/sandbox/travel-map/invite#`, SITE)).not.toBeNull();
    expect(rejectUrl(`${invite}${"a".repeat(MAX_URL)}`, SITE)).not.toBeNull();
    expect(rejectUrl(42, SITE)).not.toBeNull();
  });

  it("answers bad requests without storing anything", async () => {
    const e = env();
    expect((await post(e, { url: "https://evil.example" })).status).toBe(400);
    expect((await worker.fetch(new Request("https://go.kakeya.kim/", { method: "POST", body: "{" }), e)).status).toBe(400);
    expect((await get(e, "/Zzzzzzz")).status).toBe(404);
    expect((await get(e, "/../etc")).status).toBe(404);
    expect((await worker.fetch(new Request("https://go.kakeya.kim/x", { method: "DELETE" }), e)).status).toBe(405);
    expect((e.LINKS as ReturnType<typeof memoryStore>).writes).toBe(0);
  });

  it("answers the CORS preflight and sends the bare domain to the site", async () => {
    const e = env();
    const pre = await worker.fetch(new Request("https://go.kakeya.kim/", { method: "OPTIONS" }), e);
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Methods")).toBe("POST");
    expect((await get(e, "/")).headers.get("Location")).toBe(`${SITE}/`);
  });
});
