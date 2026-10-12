import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import type { TravelData } from "./data";
import { decodeSharedMap, encodeSharedMap, parseSharedHash, sharedMapUrl, withoutNotes } from "./sharedMap";

const known = { countries: new Set(["JPN", "BRA", "FRA"]), regions: new Set(["BR-BA"]) };
const data: TravelData = {
  version: 1,
  countries: { JPN: { status: "visited", years: [2019], note: "Kyoto in autumn" }, BRA: { status: "lived" }, FRA: { status: "want" } },
  regions: { "BR-BA": { status: "lived", note: "Salvador" } },
};
const raw = (obj: unknown) => LZString.compressToEncodedURIComponent(JSON.stringify(obj));

describe("shared map links", () => {
  it("leave notes out by default", () => {
    const r = decodeSharedMap(encodeSharedMap(data, { name: "Ana" }), known);
    expect(r?.value).toEqual({ v: 1, name: "Ana", data: withoutNotes(data) });
    expect(r?.value.data.countries.JPN).toEqual({ status: "visited", years: [2019] });
    expect(r?.value.data.regions["BR-BA"]).toEqual({ status: "lived" });
  });

  it("keep notes when asked", () => {
    expect(decodeSharedMap(encodeSharedMap(data, { notes: true }), known)?.value).toEqual({ v: 1, data });
  });

  it("drop a blank name and trim a long one", () => {
    expect(decodeSharedMap(encodeSharedMap(data, { name: "  " }), known)?.value.name).toBeUndefined();
    expect(decodeSharedMap(encodeSharedMap(data, { name: "x".repeat(100) }), known)?.value.name).toHaveLength(80);
  });

  it("build a /shared URL that parses back", () => {
    const u = new URL(sharedMapUrl("https://www.kakeya.kim", data, { name: "Ana" }));
    expect(u.pathname).toBe("/sandbox/travel-map/shared");
    expect(decodeSharedMap(parseSharedHash(u.hash) ?? "", known)?.value.name).toBe("Ana");
  });

  it("drop unknown places and report them", () => {
    const r = decodeSharedMap(raw({ v: 1, data: { ...data, countries: { ...data.countries, ZZZ: { status: "visited" } } } }), known);
    expect(r?.unknown).toEqual(["ZZZ"]);
    expect(Object.keys(r?.value.data.countries ?? {})).not.toContain("ZZZ");
  });

  it("survive a chat app percent-encoding the link", () => {
    const encoded = encodeSharedMap({ ...data, countries: { ...data.countries, JPN: { status: "visited", note: "日本 🇯🇵 ".repeat(40) } } }, { notes: true });
    const mangled = encoded.replace(/\$/g, "%24").replace(/\+/g, "%2B");
    expect(decodeSharedMap(mangled, known)?.value.data.countries.JPN.note).toBe("日本 🇯🇵 ".repeat(40));
  });
});

describe("decodeSharedMap rejects broken links", () => {
  const full = encodeSharedMap(data);
  it.each([
    ["empty", ""],
    ["garbage", "%%%nope"],
    ["cut off", full.slice(0, Math.floor(full.length / 2))],
    ["wrong version", raw({ v: 2, data })],
    ["no data", raw({ v: 1 })],
    ["bad status", raw({ v: 1, data: { ...data, countries: { JPN: { status: "maybe" } } } })],
  ])("%s → null", (_label, input) => {
    expect(decodeSharedMap(input, known)).toBeNull();
  });
});

describe("parseSharedHash", () => {
  it("returns the payload", () => expect(parseSharedHash("#m=abc")).toBe("abc"));
  it.each(["", "#m=", "#i=abc", "m=abc"])("%j → null", (h) => expect(parseSharedHash(h)).toBeNull());
});
