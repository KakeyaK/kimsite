import { describe, expect, it } from "vitest";
import { SHORTENER, shortenLink } from "./shortLink";

const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("shortenLink", () => {
  it("returns the short link", async () => {
    expect(await shortenLink("https://x", respond(200, { url: `${SHORTENER}/Ab3dE9x` }))).toBe(`${SHORTENER}/Ab3dE9x`);
  });

  it("gives up on errors, odd answers and no network", async () => {
    expect(await shortenLink("https://x", respond(400, { error: "no" }))).toBeNull();
    expect(await shortenLink("https://x", respond(200, { url: "https://evil.example/x" }))).toBeNull();
    expect(await shortenLink("https://x", (async () => { throw new TypeError("offline"); }) as typeof fetch)).toBeNull();
  });
});
