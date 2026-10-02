import { describe, it, expect } from "vitest";
import {
  stopSchema, stopKey, stopName, stopList, stopCountry, stopCenter, stopBounds, isKnownStop, addStops, outlinedCountries, type Stop,
} from "./stops";
import { emptyData, type TravelData } from "./data";
import { regionByCode } from "./meta";

const kyoto: Stop = { n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 };
const known = { countries: new Set(["JPN", "BRA", "KOR"]), regions: new Set(["BR-BA"]) };

describe("stopSchema", () => {
  it.each([["country", "JPN"], ["state", "BR-BA"], ["city", kyoto]])("accepts a %s", (_kind, stop) => {
    expect(stopSchema.safeParse(stop).success).toBe(true);
  });
  it.each([
    ["lowercase code", "jpn"],
    ["empty city name", { ...kyoto, n: "" }],
    ["latitude out of range", { ...kyoto, la: 100 }],
    ["bad city country", { ...kyoto, c: "jp" }],
  ])("rejects %s", (_label, stop) => {
    expect(stopSchema.safeParse(stop).success).toBe(false);
  });
});

describe("stop helpers", () => {
  it("names", () => {
    expect(stopName("JPN")).toBe("Japan");
    expect(stopName("BR-BA")).toBe("Bahia");
    expect(stopName(kyoto)).toBe("Kyoto");
  });
  it("stopList reads naturally", () => {
    expect(stopList(["JPN"])).toBe("Japan");
    expect(stopList([kyoto, "BR-BA", "KOR"])).toBe("Kyoto, Bahia, and South Korea");
  });
  it("country", () => {
    expect(stopCountry("JPN")).toBe("JPN");
    expect(stopCountry("BR-BA")).toBe("BRA");
    expect(stopCountry(kyoto)).toBe("JPN");
  });
  it("centre and bounds", () => {
    expect(stopCenter(kyoto)).toEqual([135.77, 35.01]);
    const [w, s, e, n] = regionByCode("BR-BA")!.bbox;
    expect(stopCenter("BR-BA")).toEqual([(w + e) / 2, (s + n) / 2]);
    expect(stopBounds("BR-BA")).toEqual([w, s, e, n]);
    expect(stopBounds(kyoto)).toBeNull();
  });
  it("keys tell stops apart", () => {
    expect(new Set([stopKey("JPN"), stopKey("BR-BA"), stopKey(kyoto), stopKey({ ...kyoto, n: "Osaka" })]).size).toBe(4);
    expect(stopKey({ ...kyoto })).toBe(stopKey(kyoto));
  });
  it("isKnownStop checks countries, states and a city's country", () => {
    expect(isKnownStop("JPN", known)).toBe(true);
    expect(isKnownStop("BR-SP", known)).toBe(false);
    expect(isKnownStop(kyoto, known)).toBe(true);
    expect(isKnownStop({ ...kyoto, c: "ZZZ" }, known)).toBe(false);
  });
});

describe("addStops", () => {
  const trip = { year: 2027, note: "Travel with Kim" };

  it("adds cities, states and countries as 'want to go' with the year and note", () => {
    const { data, added } = addStops(emptyData(), [kyoto, "BR-BA", "KOR"], trip);
    expect(data.cities).toEqual([
      { id: "JPN-kyoto-35.0-135.8", name: "Kyoto", country: "JPN", lat: 35.01, lon: 135.77, status: "want", year: 2027, note: "Travel with Kim" },
    ]);
    expect(data.regions["BR-BA"]).toEqual({ status: "want", years: [2027], note: "Travel with Kim" });
    for (const iso of ["JPN", "BRA", "KOR"]) expect(data.countries[iso], iso).toEqual({ status: "want", years: [2027], note: "Travel with Kim" });
    expect(added).toEqual([kyoto, "BR-BA", "KOR"]);
  });

  it("never changes places you've been, and keeps a city that's already on the map", () => {
    const start: TravelData = {
      ...emptyData(),
      countries: { JPN: { status: "visited", years: [2019] }, BRA: { status: "lived" } },
      regions: { "BR-BA": { status: "lived" } },
      cities: [{ id: "JPN-kyoto-35.0-135.8", name: "Kyoto", country: "JPN", lat: 35.01, lon: 135.77, status: "visited" }],
    };
    const { data, added } = addStops(start, [kyoto, "BR-BA"], trip);
    expect(data.countries.JPN).toEqual({ status: "visited", years: [2019] });
    expect(data.regions["BR-BA"]).toEqual({ status: "lived" });
    expect(data.cities).toEqual(start.cities);
    expect(added).toEqual([]);
    expect(data).toBe(start); // nothing to add: the same map comes back
  });

  it("merges the year and note into places already on the want list", () => {
    const start: TravelData = { ...emptyData(), countries: { KOR: { status: "want", years: [2030], note: "kimchi" } } };
    const { data } = addStops(start, ["KOR"], trip);
    expect(data.countries.KOR).toEqual({ status: "want", years: [2027, 2030], note: "kimchi\nTravel with Kim" });
    expect(addStops(data, ["KOR"], trip).data).toBe(data); // adding the same trip again changes nothing
  });

  it("works without a year or note", () => {
    expect(addStops(emptyData(), ["KOR"]).data.countries.KOR).toEqual({ status: "want" });
  });
});

describe("outlinedCountries", () => {
  it("outlines the country of each city and state stop", () => {
    expect(outlinedCountries([kyoto, "BR-BA"])).toEqual(["JPN", "BRA"]);
  });
  it("skips countries that are stops themselves (they're filled) and repeats", () => {
    expect(outlinedCountries([kyoto, "JPN", { ...kyoto, n: "Osaka" }, "BR-BA", "BR-SP"])).toEqual(["BRA"]);
    expect(outlinedCountries(["KOR"])).toEqual([]);
  });
});
