import { describe, expect, it } from "vitest";
import { encodeInvite, MAX_FROM, MAX_MESSAGE, MAX_STOPS } from "@apps/travel-map/lib/invite";
import worker, { MAX_INVITE, MAX_REDIRECT, rejectInvite, shorten, type Env, type Store } from "./worker";

const SITE = "https://www.kakeya.kim";
const invite = encodeInvite({ stops: ["JPN"], from: "Kim", message: "Let's go!" });

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

/** Text lz-string can't compress: random CJK characters, the worst case for an invite's size. */
function noise(length: number): string {
  let seed = 1;
  return Array.from({ length }, () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return String.fromCharCode(0x4e00 + (seed % 0x5000));
  }).join("");
}

describe("shortener", () => {
  it("stores an invite and redirects to it on the invite page", async () => {
    const e = env();
    const res = await post(e, { invite });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
    const { url } = (await res.json()) as { url: string };
    expect(url).toMatch(/^https:\/\/go\.kakeya\.kim\/[0-9A-Za-z]{7}$/);
    const code = new URL(url).pathname.slice(1);

    const hop = await get(e, `/${code}`);
    expect(hop.status).toBe(302);
    expect(hop.headers.get("Location")).toBe(`${SITE}/sandbox/travel-map/invite#${invite}`);
  });

  it("forwards an invite too long for a header with a page instead", async () => {
    const e = env();
    const long = encodeInvite({ stops: ["JPN"], message: noise(MAX_REDIRECT) });
    const { url } = (await (await post(e, { invite: long })).json()) as { url: string };
    const page = await get(e, new URL(url).pathname);
    expect(page.status).toBe(200);
    expect(page.headers.get("Location")).toBeNull();
    expect(await page.text()).toContain(`location.replace("${SITE}/sandbox/travel-map/invite#${long}")`);
  });

  it("gives the same invite the same code, with one write", async () => {
    const store = memoryStore();
    expect(await shorten(store, invite)).toBe(await shorten(store, invite));
    expect(store.writes).toBe(1);
  });

  it("lengthens the code when it clashes with another invite", async () => {
    const store = memoryStore();
    const code = (await shorten(store, invite))!;
    store.data.set(code, `${invite}A`);
    const longer = await shorten(store, invite);
    expect(longer).toHaveLength(8);
    expect(longer!.startsWith(code)).toBe(true);
  });

  it("takes the largest invite the planner can make", () => {
    const largest = encodeInvite({
      stops: Array.from({ length: MAX_STOPS }, () => "JPN"),
      from: noise(MAX_FROM),
      email: "someone.with.a.long.name@example.com",
      date: "2027-04-01",
      end: "2027-04-30",
      message: noise(MAX_MESSAGE),
    });
    expect(rejectInvite(largest)).toBeNull();
  });

  it("only takes invites", () => {
    expect(rejectInvite(invite)).toBeNull();
    expect(rejectInvite("https://evil.example")).not.toBeNull();
    expect(rejectInvite("i=")).not.toBeNull();
    expect(rejectInvite("i=abc<script>")).not.toBeNull();
    expect(rejectInvite(`i=${"A".repeat(MAX_INVITE)}`)).not.toBeNull();
    expect(rejectInvite(42)).not.toBeNull();
  });

  it("answers bad requests without storing anything", async () => {
    const e = env();
    expect((await post(e, { invite: "https://evil.example" })).status).toBe(400);
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
