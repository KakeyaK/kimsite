import { describe, expect, it } from "vitest";
import type { CityRow } from "./cities";
import { encodeInvite } from "./invite";
import { readInviteHash, SHORTENER, shortenInvite } from "./shortLink";

const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const offline = (async () => { throw new TypeError("offline"); }) as typeof fetch;
const known = { countries: new Set(["JPN"]), regions: new Set<string>() };
const noCities = async (): Promise<CityRow[]> => [];
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

describe("readInviteHash", () => {
  it("fetches a short link's invite", async () => {
    let asked = "";
    const fetcher = (async (url: string) => {
      asked = url;
      return new Response(JSON.stringify({ invite }));
    }) as typeof fetch;
    const r = await readInviteHash("#s=Ab3dE9x", known, noCities, fetcher);
    expect(asked).toBe(`${SHORTENER}/api/Ab3dE9x`);
    expect(r).toMatchObject({ ok: true, value: { stops: ["JPN"], from: "Kim" } });
  });

  it("reads full invites without the network", async () => {
    expect(await readInviteHash(`#${invite}`, known, noCities, offline)).toMatchObject({ ok: true });
  });

  it("tells a missing invite from a failed fetch", async () => {
    const missing = await readInviteHash("#s=Ab3dE9x", known, noCities, respond(404, { error: "no" }));
    const failed = await readInviteHash("#s=Ab3dE9x", known, noCities, offline);
    expect(missing).toMatchObject({ ok: false, error: { field: "s", message: expect.stringContaining("no invite") } });
    expect(failed).toMatchObject({ ok: false, error: { field: "s", message: expect.stringContaining("connection") } });
  });
});
