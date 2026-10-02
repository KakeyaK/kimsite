import { describe, it, expect } from "vitest";
import {
  travelDataSchema, emptyData, dropUnknown, isHttpsUrl, setCity, setRegion, type City, type TravelData,
} from "./data";

const sample: TravelData = {
  version: 1, regions: {},
  countries: {
    JPN: { status: "visited", years: [2019, 2023], note: "Ramen" },
    BRA: { status: "lived" },
    ISL: { status: "want" },
  },
  cities: [
    { id: "jpn-tokyo", name: "Tokyo", country: "JPN", lat: 35.68, lon: 139.69, status: "visited", year: 2019 },
  ],
};

describe("travelDataSchema", () => {
  it("accepts a valid document", () => {
    expect(travelDataSchema.safeParse(sample).success).toBe(true);
  });
  it("accepts the empty document", () => {
    expect(travelDataSchema.safeParse(emptyData()).success).toBe(true);
  });
  it("rejects an unknown status", () => {
    const bad = { ...sample, countries: { JPN: { status: "dreamed" } } };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects years given as strings", () => {
    const bad = { ...sample, countries: { JPN: { status: "visited", years: ["2019"] } } };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects lowercase or wrong-length country ids", () => {
    expect(travelDataSchema.safeParse({ ...sample, countries: { jpn: { status: "visited" } } }).success).toBe(false);
    expect(travelDataSchema.safeParse({ ...sample, countries: { JP: { status: "visited" } } }).success).toBe(false);
  });
  it("rejects out-of-range coordinates", () => {
    const bad = { ...sample, cities: [{ ...sample.cities[0], lat: 91 }] };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a non-https city photo", () => {
    const bad = { ...sample, cities: [{ ...sample.cities[0], photo: "http://x.com/a.jpg" }] };
    expect(travelDataSchema.safeParse(bad).success).toBe(false);
  });
});

describe("dropUnknown", () => {
  it("removes countries and cities with unknown ids and reports them once", () => {
    const data: TravelData = {
      version: 1, regions: {},
      countries: { JPN: { status: "visited" }, XXX: { status: "want" } },
      cities: [
        { id: "a", name: "A", country: "XXX", lat: 0, lon: 0, status: "want" },
        { id: "b", name: "B", country: "JPN", lat: 0, lon: 0, status: "want" },
      ],
    };
    const { data: out, unknown } = dropUnknown(data, { countries: new Set(["JPN"]), regions: new Set() });
    expect(Object.keys(out.countries)).toEqual(["JPN"]);
    expect(out.cities.map((c) => c.id)).toEqual(["b"]);
    expect(unknown).toEqual(["XXX"]);
  });
  it("keeps a city in an unknown state, without the state", () => {
    const data: TravelData = {
      ...emptyData(),
      cities: [{ id: "a", name: "A", country: "JPN", region: "JP-13", lat: 0, lon: 0, status: "visited" }],
    };
    const { data: out, unknown } = dropUnknown(data, { countries: new Set(["JPN"]), regions: new Set() });
    expect(out.cities.map((c) => [c.id, c.region])).toEqual([["a", undefined]]);
    expect(unknown).toEqual(["JP-13"]);
  });
});

describe("isHttpsUrl", () => {
  it.each([
    ["https://example.com/a.jpg", true],
    ["http://example.com/a.jpg", false],
    ["javascript:alert(1)", false],
    ["data:image/png;base64,AAAA", false],
    ["not a url", false],
    ["", false],
  ])("%s → %s", (input, expected) => {
    expect(isHttpsUrl(input)).toBe(expected);
  });
});

import { parseYears } from "./data";

describe("parseYears", () => {
  it("parses commas, spaces, junk and out-of-range values", () => {
    expect(parseYears("2023, 2019 2019 abc 1850 3000 1999")).toEqual([1999, 2019, 2023]);
  });
  it("returns [] for empty input", () => {
    expect(parseYears("  ")).toEqual([]);
  });
});

describe("regions in the data model", () => {
  it("requires a regions record keyed by ISO 3166-2 codes", () => {
    expect(travelDataSchema.safeParse({ ...sample, regions: { "BR-SP": { status: "visited" } } }).success).toBe(true);
    expect(travelDataSchema.safeParse({ ...sample, regions: { SP: { status: "visited" } } }).success).toBe(false);
    expect(travelDataSchema.safeParse({ ...sample, regions: { "br-sp": { status: "visited" } } }).success).toBe(false);
    const { regions: _regions, ...withoutRegions } = sample;
    expect(travelDataSchema.safeParse(withoutRegions).success).toBe(false);
  });

  it("dropUnknown drops unknown regions and reports them", () => {
    const data: TravelData = { ...emptyData(), regions: { "BR-SP": { status: "visited" }, "BR-XX": { status: "want" } } };
    const { data: out, unknown } = dropUnknown(data, { countries: new Set(), regions: new Set(["BR-SP"]) });
    expect(Object.keys(out.regions)).toEqual(["BR-SP"]);
    expect(unknown).toEqual(["BR-XX"]);
  });
});

describe("setRegion", () => {
  it("marking a state visited marks its country visited", () => {
    const out = setRegion(emptyData(), "BR-SP", { status: "visited", years: [2020] });
    expect(out.regions["BR-SP"]).toEqual({ status: "visited", years: [2020] });
    expect(out.countries.BRA).toEqual({ status: "visited" });
  });
  it("raises a country that was only 'want' to visited, keeping its years and note", () => {
    const start: TravelData = { ...emptyData(), countries: { BRA: { status: "want", note: "carnival" } } };
    expect(setRegion(start, "BR-BA", { status: "visited" }).countries.BRA).toEqual({ status: "visited", note: "carnival" });
  });
  it("marking a state lived makes the country lived", () => {
    const start: TravelData = { ...emptyData(), countries: { BRA: { status: "visited", years: [2019] } } };
    expect(setRegion(start, "BR-SP", { status: "lived" }).countries.BRA).toEqual({ status: "lived", years: [2019] });
  });
  it("never lowers the country", () => {
    const start: TravelData = { ...emptyData(), countries: { BRA: { status: "lived" } } };
    expect(setRegion(start, "BR-SP", { status: "visited" }).countries.BRA).toEqual({ status: "lived" });
    expect(setRegion(start, "BR-SP", { status: "want" }).countries.BRA).toEqual({ status: "lived" });
  });
  it("a 'want' state puts an unmarked country on the want list", () => {
    expect(setRegion(emptyData(), "BR-BA", { status: "want" }).countries.BRA).toEqual({ status: "want" });
  });
  it("clearing a state leaves the country as it is", () => {
    const start = setRegion(emptyData(), "BR-SP", { status: "visited" });
    const out = setRegion(start, "BR-SP", null);
    expect(out.regions).toEqual({});
    expect(out.countries.BRA).toEqual({ status: "visited" });
  });
});

describe("setCity", () => {
  const sp: City = { id: "sp", name: "São Paulo", country: "BRA", region: "BR-SP", lat: -23.55, lon: -46.64, status: "visited" };

  it("a visited city marks its state and country visited", () => {
    const out = setCity(emptyData(), sp);
    expect(out.cities).toEqual([sp]);
    expect(out.regions).toEqual({ "BR-SP": { status: "visited" } });
    expect(out.countries).toEqual({ BRA: { status: "visited" } });
  });
  it("raises a 'want' state and country, keeping their notes, and never lowers 'lived'", () => {
    const start: TravelData = {
      ...emptyData(),
      regions: { "BR-SP": { status: "want", note: "museums" } },
      countries: { BRA: { status: "lived" } },
    };
    const out = setCity(start, sp);
    expect(out.regions["BR-SP"]).toEqual({ status: "visited", note: "museums" });
    expect(out.countries.BRA).toEqual({ status: "lived" });
  });
  it("a city without a state still marks its country", () => {
    const tokyo: City = { id: "t", name: "Tokyo", country: "JPN", lat: 35.68, lon: 139.69, status: "visited" };
    const out = setCity(emptyData(), tokyo);
    expect(out.regions).toEqual({});
    expect(out.countries).toEqual({ JPN: { status: "visited" } });
  });
  it("a city you want to go to changes nothing else", () => {
    const out = setCity(emptyData(), { ...sp, status: "want" });
    expect(out.regions).toEqual({});
    expect(out.countries).toEqual({});
  });
  it("updates an existing city in place, marking its state once it's been visited", () => {
    const start = setCity(emptyData(), { ...sp, status: "want" });
    const out = setCity(start, sp);
    expect(out.cities).toEqual([sp]);
    expect(out.regions["BR-SP"]).toEqual({ status: "visited" });
  });
});
