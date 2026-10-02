import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import {
  encodeInvite, decodeInvite, parseHash, inviteUrl,
  MAX_MESSAGE, type Invite,
} from "./invite";

const known = { countries: new Set(["JPN", "KOR", "BRA", "PRT"]), regions: new Set(["BR-BA"]) };
const kyoto = { n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 };
const base: Invite = { v: 1, from: "Kim", stops: ["JPN"], message: "Let's go!", date: "2027-04-01" };
const raw = (obj: unknown) => LZString.compressToEncodedURIComponent(JSON.stringify(obj));

describe("invite round-trip", () => {
  it("round-trips a simple invite", () => {
    expect(decodeInvite(encodeInvite(base), known)).toEqual({ value: base, unknown: [] });
  });

  it("round-trips unicode and emoji", () => {
    const inv = { ...base, from: "Kîm 金", message: "Vamos pro Japão! 🇯🇵 日本へ行こう" };
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });

  it("round-trips a message at the maximum length", () => {
    expect(MAX_MESSAGE).toBe(2000); // room for Markdown image links
    // 🌏 is 2 UTF-16 code units, so each repeat is 3 units long
    const inv = { ...base, message: "ã🌏".repeat(Math.floor(MAX_MESSAGE / 3)) };
    expect(inv.message.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });

  it("round-trips countries, states and cities as stops", () => {
    const inv: Invite = { ...base, stops: [kyoto, "KOR", "BR-BA"] };
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });

  it("produces URL-safe output", () => {
    expect(encodeInvite(base)).toMatch(/^[A-Za-z0-9+\-$]+$/);
  });
});

describe("decodeInvite rejects bad input", () => {
  it.each([
    ["empty", ""],
    ["garbage", "%%%not-lz%%%"],
    ["lz but not JSON", LZString.compressToEncodedURIComponent("not json {")],
    ["wrong version", raw({ ...base, v: 2 })],
    ["no stops", raw({ ...base, stops: [] })],
    ["stops not an array", raw({ ...base, stops: "JPN" })],
    ["message too long", raw({ ...base, message: "x".repeat(MAX_MESSAGE + 1) })],
    ["bad date", raw({ ...base, date: "next spring" })],
    ["end before start", raw({ ...base, date: "2027-04-10", end: "2027-04-01" })],
    ["end without a start", raw({ ...base, date: undefined, end: "2027-04-01" })],
    ["bad email", raw({ ...base, email: "kim at example" })],
    ["city with a bad latitude", raw({ ...base, stops: [{ ...kyoto, la: 95 }] })],
  ])("%s → null", (_label, input) => {
    expect(decodeInvite(input, known)).toBeNull();
  });

  it("returns null when every stop is unknown", () => {
    expect(decodeInvite(raw({ ...base, stops: ["ZZZ"] }), known)).toBeNull();
  });
});

describe("decodeInvite sanitizes", () => {
  it("drops unknown countries, states and cities in unknown countries, and reports them", () => {
    const r = decodeInvite(raw({ ...base, stops: ["JPN", "ZZZ", "BR-XX", { ...kyoto, c: "YYY" }] }), known);
    expect(r?.value.stops).toEqual(["JPN"]);
    expect(r?.unknown).toEqual(["ZZZ", "BR-XX", "YYY"]);
  });
});

describe("parseHash", () => {
  it("returns the invite payload", () => {
    expect(parseHash("#i=abc")).toBe("abc");
  });
  it.each(["", "#", "#i=", "#r=xyz", "#x=abc", "i=abc"])("%j → null", (h) => {
    expect(parseHash(h)).toBeNull();
  });
});

describe("urls", () => {
  it("builds invite URLs that parse back", () => {
    const u = new URL(inviteUrl("https://www.kakeya.kim", base));
    expect(u.pathname).toBe("/projects/map/invite");
    expect(decodeInvite(parseHash(u.hash) ?? "", known)?.value).toEqual(base);
  });
});

describe("links mangled by chat apps", () => {
  it("decodes an invite whose '$' / '+' were percent-encoded", () => {
    // Long unicode messages make lz-string emit '$' and '+'; some apps rewrite them as %24 / %2B.
    const inv = { ...base, message: "Vamos pro Japão! 🇯🇵 ".repeat(40) };
    const encoded = encodeInvite(inv);
    expect(encoded).toMatch(/[$+]/);
    const mangled = encoded.replace(/\$/g, "%24").replace(/\+/g, "%2B");
    expect(decodeInvite(mangled, known)?.value).toEqual(inv);
  });
});

describe("trip dates and email", () => {
  it("round-trips a date range and the inviter's email", () => {
    const inv: Invite = { ...base, date: "2027-04-10", end: "2027-04-18", email: "kim@example.com" };
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });
  it("accepts a one-day trip (end equal to start)", () => {
    const inv: Invite = { ...base, date: "2027-04-10", end: "2027-04-10" };
    expect(decodeInvite(encodeInvite(inv), known)?.value).toEqual(inv);
  });
});
