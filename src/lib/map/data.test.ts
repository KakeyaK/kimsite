import { describe, it, expect } from "vitest";
import {
  travelDataSchema, emptyData, migrate, dropUnknown, isHttpsUrl, addWants, type TravelData,
} from "./data";

const sample: TravelData = {
  version: 1,
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

describe("migrate", () => {
  it("adds version 1 to an object without a version", () => {
    const { version: _v, ...old } = sample;
    const migrated = migrate(old);
    expect(travelDataSchema.safeParse(migrated).success).toBe(true);
  });
  it("adds a missing cities array", () => {
    expect(travelDataSchema.safeParse(migrate({ countries: {} })).success).toBe(true);
  });
  it("leaves non-objects alone", () => {
    expect(migrate("nope")).toBe("nope");
    expect(migrate(null)).toBe(null);
  });
});

describe("dropUnknown", () => {
  it("removes countries and cities with unknown ids and reports them once", () => {
    const data: TravelData = {
      version: 1,
      countries: { JPN: { status: "visited" }, XXX: { status: "want" } },
      cities: [
        { id: "a", name: "A", country: "XXX", lat: 0, lon: 0, status: "want" },
        { id: "b", name: "B", country: "JPN", lat: 0, lon: 0, status: "want" },
      ],
    };
    const { data: out, unknown } = dropUnknown(data, new Set(["JPN"]));
    expect(Object.keys(out.countries)).toEqual(["JPN"]);
    expect(out.cities.map((c) => c.id)).toEqual(["b"]);
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

describe("addWants", () => {
  it("adds new countries as 'want' and reports which were added", () => {
    const start: TravelData = { version: 1, countries: { JPN: { status: "visited", years: [2019] } }, cities: [] };
    const { data: out, added } = addWants(start, ["JPN", "KOR", "VNM"]);
    expect(out.countries.JPN).toEqual({ status: "visited", years: [2019] }); // never downgrades a place you've been
    expect(out.countries.KOR).toEqual({ status: "want" });
    expect(out.countries.VNM).toEqual({ status: "want" });
    expect(added).toEqual(["KOR", "VNM"]);
  });
  it("records the trip year and who you'd travel with", () => {
    const start: TravelData = { version: 1, countries: { JPN: { status: "visited" } }, cities: [] };
    const { data: out } = addWants(start, ["JPN", "KOR"], { year: 2027, note: "Travel with Ana" });
    expect(out.countries.KOR).toEqual({ status: "want", years: [2027], note: "Travel with Ana" });
    expect(out.countries.JPN).toEqual({ status: "visited" });
  });
  it("merges the year and note into a country already on the want list", () => {
    const start: TravelData = { version: 1, countries: { KOR: { status: "want", years: [2030], note: "kimchi" } }, cities: [] };
    const { data: out, added } = addWants(start, ["KOR"], { year: 2027, note: "Travel with Ana" });
    expect(out.countries.KOR).toEqual({ status: "want", years: [2027, 2030], note: "kimchi\nTravel with Ana" });
    expect(added).toEqual(["KOR"]);
    // adding the same invite again changes nothing
    expect(addWants(out, ["KOR"], { year: 2027, note: "Travel with Ana" }).data).toBe(out);
  });
  it("leaves existing wants alone and returns the same object when nothing changes", () => {
    const start: TravelData = { version: 1, countries: { KOR: { status: "want", note: "kimchi" } }, cities: [] };
    const r = addWants(start, ["KOR"]);
    expect(r.added).toEqual([]);
    expect(r.data).toBe(start);
  });
});
