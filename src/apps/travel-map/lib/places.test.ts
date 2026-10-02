import { describe, it, expect } from "vitest";
import { markPicked, placeToStop, searchPlaces, type Place } from "./places";
import { emptyData, type TravelData } from "./data";
import type { CityRow } from "./cities";

const cities: CityRow[] = [
  ["Kyoto", "JPN", 35.01, 135.77, 1_500_000],
  ["Salvador", "BRA", -12.97, -38.51, 2_900_000, "BR-BA"],
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
  it("still finds countries and states while the city list is loading", () => {
    // Georgia and South Georgia, then Georgia the US state
    expect(searchPlaces("georg", null).map((p) => p.name)).toEqual(["Georgia", "South Georgia and the Islands", "Georgia"]); // Georgia
  });
  it("respects the limit and returns nothing for a blank query", () => {
    expect(searchPlaces("a", cities, 5)).toHaveLength(5);
    expect(searchPlaces(" ", cities)).toEqual([]);
  });
  it("finds states between countries and cities", () => {
    const r = searchPlaces("bahia", [["Bahía Blanca", "ARG", -38.7, -62.3, 300_000]]);
    expect(r.map((p) => p.kind)).toEqual(["region", "city"]);
    expect(r[0]).toEqual({ kind: "region", code: "BR-BA", iso: "BRA", name: "Bahia" });
  });
});

describe("placeToStop", () => {
  it("turns search results into trip stops", () => {
    expect(placeToStop({ kind: "country", iso: "JPN", name: "Japan" })).toBe("JPN");
    expect(placeToStop({ kind: "region", code: "BR-BA", iso: "BRA", name: "Bahia" })).toBe("BR-BA");
    expect(placeToStop({ kind: "city", iso: "JPN", name: "Kyoto", lat: 35.01, lon: 135.77 })).toEqual({ n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 });
  });
});

describe("markPicked", () => {
  const sp: Place = { kind: "region", code: "BR-SP", iso: "BRA", name: "São Paulo" };
  const paris: Place = { kind: "city", iso: "FRA", name: "Paris", lat: 48.85, lon: 2.35 };

  it("marks an unmarked country as been", () => {
    expect(markPicked(emptyData(), { kind: "country", iso: "JPN", name: "Japan" }).countries).toEqual({ JPN: { status: "visited" } });
  });

  it("leaves an already-marked country alone", () => {
    const d: TravelData = { ...emptyData(), countries: { JPN: { status: "want", note: "someday" } } };
    expect(markPicked(d, { kind: "country", iso: "JPN", name: "Japan" })).toEqual(d);
  });

  it("marks a state and raises its country", () => {
    const d = markPicked(emptyData(), sp);
    expect(d.regions).toEqual({ "BR-SP": { status: "visited" } });
    expect(d.countries).toEqual({ BRA: { status: "visited" } });
  });

  it("leaves an already-marked state alone", () => {
    const d: TravelData = { ...emptyData(), regions: { "BR-SP": { status: "lived" } } };
    expect(markPicked(d, sp)).toBe(d);
  });

  it("adds a city with its state, marking the state and country", () => {
    const salvador = searchPlaces("salva", cities).find((p) => p.kind === "city")!;
    expect(salvador).toEqual({ kind: "city", name: "Salvador", iso: "BRA", lat: -12.97, lon: -38.51, region: "BR-BA" });
    const d = markPicked(emptyData(), salvador);
    expect(d.cities[0].region).toBe("BR-BA");
    expect(d.regions).toEqual({ "BR-BA": { status: "visited" } });
    expect(d.countries).toEqual({ BRA: { status: "visited" } });
  });

  it("adds a city as been, and its country if new", () => {
    const d = markPicked(emptyData(), paris);
    expect(d.cities).toEqual([expect.objectContaining({ name: "Paris", country: "FRA", status: "visited" })]);
    expect(d.countries).toEqual({ FRA: { status: "visited" } });
    expect(markPicked({ ...d, countries: { FRA: { status: "lived" } } }, paris).countries).toEqual({ FRA: { status: "lived" } });
  });
});
