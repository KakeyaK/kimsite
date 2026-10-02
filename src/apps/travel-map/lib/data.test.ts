import { describe, it, expect } from "vitest";
import { travelDataSchema, emptyData, dropUnknown, isHttpsUrl, setRegion, type TravelData } from "./data";

const sample: TravelData = {
  version: 1, regions: {},
  countries: {
    JPN: { status: "visited", years: [2019, 2023], note: "Ramen" },
    BRA: { status: "lived" },
    ISL: { status: "want" },
  },
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
  it("ignores the city list of maps saved before cities were removed", () => {
    const old = { ...sample, cities: [{ id: "jpn-tokyo", name: "Tokyo", country: "JPN", lat: 35.68, lon: 139.69, status: "visited" }] };
    expect(travelDataSchema.parse(old)).toEqual(sample);
  });
});

describe("dropUnknown", () => {
  it("removes countries with unknown ids and reports them", () => {
    const data: TravelData = { version: 1, regions: {}, countries: { JPN: { status: "visited" }, XXX: { status: "want" } } };
    const { data: out, unknown } = dropUnknown(data, { countries: new Set(["JPN"]), regions: new Set() });
    expect(Object.keys(out.countries)).toEqual(["JPN"]);
    expect(unknown).toEqual(["XXX"]);
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
