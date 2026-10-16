import { describe, expect, it } from "vitest";
import { encodeInvite } from "./invite";
import { SHORTENER, shortenInvite } from "./shortLink";

const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const offline = (async () => { throw new TypeError("offline"); }) as typeof fetch;
const invite = encodeInvite({ stops: ["JPN"], from: "Kim" });

describe("shortenInvite", () => {
  it("returns the short link", async () => {
    expect(await shortenInvite(invite, respond(200, { url: `${SHORTENER}/Ab3dE9x` }))).toBe(`${SHORTENER}/Ab3dE9x`);
  });

  it("gives up on errors, odd answers and no network", async () => {
    expect(await shortenInvite(invite, respond(400, { error: "no" }))).toBeNull();
    expect(await shortenInvite(invite, respond(200, { url: "https://evil.example/x" }))).toBeNull();
    expect(await shortenInvite(invite, offline)).toBeNull();
  });
});
