import { describe, it, expect, vi } from "vitest";
import type { CityRow } from "./cities";
import { decodeInvite, encodeInvite, findCity, inviteUrl, MAX_MESSAGE, MAX_STOPS, type Invite } from "./invite";

const known = { countries: new Set(["JPN", "KOR", "BRA", "PRT", "CHN"]), regions: new Set(["BR-BA"]) };
const rows: CityRow[] = [
  ["Kyoto", "JPN", 35.01, 135.77, 1460000],
  ["São Paulo", "BRA", -23.55, -46.63, 12000000],
  ["Santa Maria", "BRA", -29.68, -53.81, 280000],
  ["Santa Maria", "BRA", -1.0, -48.0, 50000],
  ["Misato, Saitama", "JPN", 35.84, 139.88, 142145],
  ["Mianzhu, Deyang, Sichuan", "CHN", 31.34, 104.22, 510000],
];
const cities = () => Promise.resolve(rows);
const kyoto = { n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 };
const base: Invite = { from: "Kim", stops: ["JPN"], message: "Let's go!", date: "2027-04-01" };
const decode = (hash: string) => decodeInvite(hash, known, cities);
const roundTrip = async (i: Invite) => decode(`#${encodeInvite(i)}`);

describe("readable invite links", () => {
  it("reads the example from the spec", async () => {
    const r = await decode("#to=Kyoto@JPN,BR-BA,KOR&from=Kim&date=2027-03-01&end=2027-03-15&msg=Let%27s%20go!");
    expect(r).toEqual({
      ok: true,
      unknown: [],
      value: { stops: [kyoto, "BR-BA", "KOR"], from: "Kim", date: "2027-03-01", end: "2027-03-15", message: "Let's go!" },
    });
  });

  it("round-trips through the builder's encoder", async () => {
    const inv: Invite = { ...base, stops: [kyoto, "KOR", "BR-BA"], email: "kim@example.com", end: "2027-04-10" };
    expect(await roundTrip(inv)).toEqual({ ok: true, value: inv, unknown: [] });
  });

  it("round-trips unicode, emoji, Markdown and characters that mean something in a URL", async () => {
    const message = "Vamos pro Japão! 🇯🇵 & = # + % , @\n\n**bold** ![Kyoto](https://example.com/k.jpg?a=1&b=2)";
    expect(await roundTrip({ ...base, from: "Kîm 金", message })).toMatchObject({ ok: true, value: { from: "Kîm 金", message } });
  });

  it("round-trips a message at the maximum length", async () => {
    const message = "ã🌏".repeat(Math.floor(MAX_MESSAGE / 3));
    expect(await roundTrip({ ...base, message })).toMatchObject({ ok: true, value: { message } });
  });

  it("round-trips a city with a comma in its name", async () => {
    const mianzhu = { n: "Mianzhu, Deyang, Sichuan", c: "CHN", la: 31.34, lo: 104.22 };
    expect(await roundTrip({ stops: [mianzhu, "JPN"] })).toEqual({ ok: true, value: { stops: [mianzhu, "JPN"] }, unknown: [] });
  });

  it("builds URLs on the invite page", () => {
    const u = new URL(inviteUrl("https://www.kakeya.kim", base));
    expect(u.pathname).toBe("/sandbox/travel-map/invite");
    expect(u.hash).toBe("#to=JPN&from=Kim&date=2027-04-01&msg=Let's%20go!");
  });

  it("only loads the city list when the link has a city", async () => {
    const load = vi.fn(cities);
    await decodeInvite("#to=JPN,BR-BA", known, load);
    expect(load).not.toHaveBeenCalled();
    await decodeInvite("#to=Kyoto@JPN", known, load);
    expect(load).toHaveBeenCalledOnce();
  });

  it("is lenient: lowercase codes, spaces, + for a space, a stray %, an empty field", async () => {
    const r = await decode("#to=jpn, kyoto@jpn&from=Kim+K&msg=100%+fun&email=");
    expect(r).toEqual({ ok: true, unknown: [], value: { stops: ["JPN", kyoto], from: "Kim K", message: "100% fun" } });
  });
});

describe("cities", () => {
  it("are found ignoring case and accents, and the most populous wins", () => {
    expect(findCity(rows, "SAO PAULO", "BRA")?.[0]).toBe("São Paulo");
    expect(findCity(rows, "santa maria", "BRA")?.[4]).toBe(280000);
  });
  it("are looked up within their country only", () => {
    expect(findCity(rows, "Kyoto", "BRA")).toBeNull();
  });
  it("match a qualified name by its first part", () => {
    expect(findCity(rows, "Misato", "JPN")?.[0]).toBe("Misato, Saitama");
  });
});

describe("skipped places", () => {
  it("drops unknown codes and cities that can't be found, and lists them", async () => {
    const r = await decode("#to=JPN,ZZZ,BR-XX,Atlantis@JPN,Kyoto@YYY");
    expect(r).toEqual({ ok: true, value: { stops: ["JPN"] }, unknown: ["ZZZ", "BR-XX", "Atlantis@JPN", "Kyoto@YYY"] });
  });

  it("skips the cities when the city list fails to load", async () => {
    const r = await decodeInvite("#to=JPN,Kyoto@JPN", known, () => Promise.reject(new Error("offline")));
    expect(r).toEqual({ ok: true, value: { stops: ["JPN"] }, unknown: ["Kyoto@JPN"] });
  });
});

describe("broken links name the field", () => {
  it.each([
    ["", "to"],
    ["#from=Kim", "to"],
    ["#to=", "to"],
    ["#to=Kyoto", "to"],
    ["#to=Kyoto%40JPN%2CKOR", "to"],
    [`#to=${Array(MAX_STOPS + 1).fill("JPN").join(",")}`, "to"],
    ["#to=ZZZ,Atlantis@JPN", "to"],
    ["#to=JPN&title=Trip", "title"],
    ["#to=JPN&to=KOR", "to"],
    ["#to=JPN&from", "from"],
    [`#to=JPN&from=${"x".repeat(81)}`, "from"],
    ["#to=JPN&email=kim%20at%20example", "email"],
    ["#to=JPN&date=next%20spring", "date"],
    ["#to=JPN&date=2027-02-30", "date"],
    ["#to=JPN&end=2027-04-01", "end"],
    ["#to=JPN&date=2027-04-10&end=2027-04-01", "end"],
    [`#to=JPN&msg=${"x".repeat(MAX_MESSAGE + 1)}`, "msg"],
    ["#to=JPN&msg=%E0%A4", "msg"],
  ])("%j → error in %s", async (hash, field) => {
    const r = await decode(hash);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe(field);
      expect(r.error.message.length).toBeGreaterThan(5);
    }
  });

  it("explains encoded commas between stops", async () => {
    const r = await decode("#to=Kyoto%40JPN%2CKOR");
    expect(!r.ok && r.error.message).toMatch(/commas between stops/);
  });
});
