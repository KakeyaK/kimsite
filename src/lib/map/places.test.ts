import { describe, it, expect } from "vitest";
import { searchPlaces } from "./places";
import type { CityRow } from "./cities";

const cities: CityRow[] = [
  ["Kyoto", "JPN", 35.01, 135.77, 1_500_000],
  ["Japurá", "BRA", -1.8, -66.6, 120_000],
  ["Georgetown", "GUY", 6.8, -58.16, 235_000],
];

describe("searchPlaces", () => {
  it("lists matching countries before cities", () => {
    const r = searchPlaces("jap", cities);
    expect(r[0]).toMatchObject({ kind: "country", iso: "JPN", name: "Japan" });
    expect(r.find((p) => p.kind === "city")).toMatchObject({ kind: "city", name: "Japurá", iso: "BRA" });
  });
  it("finds cities by name, ignoring accents", () => {
    expect(searchPlaces("kyo", cities)).toEqual([
      { kind: "city", name: "Kyoto", iso: "JPN", lat: 35.01, lon: 135.77 },
    ]);
  });
  it("still finds countries while the city list is loading", () => {
    expect(searchPlaces("georg", null).map((p) => p.kind)).toEqual(["country"]); // Georgia
  });
  it("respects the limit and returns nothing for a blank query", () => {
    expect(searchPlaces("a", cities, 5)).toHaveLength(5);
    expect(searchPlaces(" ", cities)).toEqual([]);
  });
});
