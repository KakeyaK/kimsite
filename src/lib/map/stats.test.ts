import { describe, it, expect } from "vitest";
import {
  counts, beenTo, countedBeenTo, continentProgress, badges, yearRange, atYear,
  statusColors, type CountryMeta,
} from "./stats";
import type { TravelData } from "./data";

const meta: CountryMeta[] = [
  { iso: "BRA", name: "Brazil", continent: "South America", bbox: [0, 0, 1, 1], sovereign: true },
  { iso: "ARG", name: "Argentina", continent: "South America", bbox: [0, 0, 1, 1], sovereign: true },
  { iso: "JPN", name: "Japan", continent: "Asia", bbox: [0, 0, 1, 1], sovereign: true },
  { iso: "KOR", name: "South Korea", continent: "Asia", bbox: [0, 0, 1, 1], sovereign: true },
  { iso: "ATA", name: "Antarctica", continent: "Antarctica", bbox: [0, 0, 1, 1], sovereign: false },
  { iso: "FLK", name: "Falkland Is.", continent: "South America", bbox: [0, 0, 1, 1], sovereign: false },
];

const d: TravelData = {
  version: 1,
  countries: {
    BRA: { status: "lived", years: [2000] },
    ARG: { status: "visited", years: [2015, 2010] },
    JPN: { status: "visited", years: [2023] },
    KOR: { status: "want" },
  },
  cities: [
    { id: "a", name: "Tokyo", country: "JPN", lat: 0, lon: 0, status: "visited", year: 2023 },
    { id: "b", name: "Seoul", country: "KOR", lat: 0, lon: 0, status: "want" },
  ],
};

describe("counts / beenTo", () => {
  it("counts each status", () => {
    expect(counts(d)).toEqual({ visited: 2, lived: 1, want: 1 });
  });
  it("beenTo is visited + lived, sorted", () => {
    expect(beenTo(d)).toEqual(["ARG", "BRA", "JPN"]);
  });
});

describe("continentProgress / badges", () => {
  it("counts been-to per continent and skips Antarctica", () => {
    expect(continentProgress(d, meta)).toEqual([
      { continent: "Asia", been: 1, total: 2 },
      { continent: "South America", been: 2, total: 2 },
    ]);
  });
  it("awards a badge for a completed continent", () => {
    expect(badges(d, meta)).toContain("Every country in South America");
    expect(badges(d, meta)).not.toContain("Every country in Asia");
  });
  it("leaves territories out of continent totals, so a continent can be completed", () => {
    // FLK is a territory in South America; BRA + ARG must still complete the continent
    expect(continentProgress(d, meta).find((p) => p.continent === "South America")).toEqual({ continent: "South America", been: 2, total: 2 });
  });
  it("countedBeenTo only counts sovereign states", () => {
    const withTerritory: TravelData = { ...d, countries: { ...d.countries, FLK: { status: "visited" } } };
    expect(countedBeenTo(withTerritory, meta)).toEqual(["ARG", "BRA", "JPN"]);
  });
  it("awards milestone badges", () => {
    const many: TravelData = { version: 1, cities: [], countries: {} };
    const big: CountryMeta[] = [];
    for (let i = 0; i < 10; i++) {
      const iso = `A${String.fromCharCode(65 + i)}A`;
      many.countries[iso] = { status: "visited" };
      big.push({ iso, name: iso, continent: "Asia", bbox: [0, 0, 1, 1], sovereign: true });
    }
    expect(badges(many, big)).toContain("10 countries");
  });
});

describe("timeline", () => {
  it("yearRange covers country and city years", () => {
    expect(yearRange(d)).toEqual([2000, 2023]);
  });
  it("yearRange is null without years", () => {
    expect(yearRange({ version: 1, countries: { BRA: { status: "visited" } }, cities: [] })).toBeNull();
  });
  it("atYear keeps places first reached on or before the year, never wishes", () => {
    const at = atYear(d, 2012);
    expect(Object.keys(at.countries).sort()).toEqual(["ARG", "BRA"]);
    expect(at.cities).toEqual([]);
    expect(Object.keys(atYear(d, 2023).countries).sort()).toEqual(["ARG", "BRA", "JPN"]);
    expect(atYear(d, 2023).cities.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("statusColors", () => {
  it("maps each country to its status", () => {
    expect(statusColors(d)).toEqual({ BRA: "lived", ARG: "visited", JPN: "visited", KOR: "want" });
  });
});
