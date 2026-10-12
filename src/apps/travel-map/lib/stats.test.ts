import { describe, it, expect } from "vitest";
import { yearRange, atYear, statusColors, regionColors } from "./stats";
import type { TravelData } from "./data";

const d: TravelData = {
  version: 1, regions: {},
  countries: {
    BRA: { status: "lived", years: [2000] },
    ARG: { status: "visited", years: [2015, 2010] },
    JPN: { status: "visited", years: [2023] },
    KOR: { status: "want" },
  },
};

describe("timeline", () => {
  it("yearRange covers country years", () => {
    expect(yearRange(d)).toEqual([2000, 2023]);
  });
  it("yearRange is null without years", () => {
    expect(yearRange({ version: 1, regions: {}, countries: { BRA: { status: "visited" } } })).toBeNull();
  });
  it("atYear keeps places first reached on or before the year, never wishes", () => {
    const at = atYear(d, 2012);
    expect(Object.keys(at.countries).sort()).toEqual(["ARG", "BRA"]);
    expect(Object.keys(atYear(d, 2023).countries).sort()).toEqual(["ARG", "BRA", "JPN"]);
  });
});

describe("statusColors", () => {
  it("maps each country to its status", () => {
    expect(statusColors(d)).toEqual({ BRA: "lived", ARG: "visited", JPN: "visited", KOR: "want" });
  });
});

describe("regions", () => {
  const withStates: TravelData = {
    ...d,
    regions: { "BR-SP": { status: "lived", years: [2000] }, "BR-BA": { status: "visited", years: [2015] }, "BR-AM": { status: "want" } },
  };
  it("atYear filters states like countries", () => {
    expect(Object.keys(atYear(withStates, 2010).regions)).toEqual(["BR-SP"]);
    expect(Object.keys(atYear(withStates, 2020).regions).sort()).toEqual(["BR-BA", "BR-SP"]);
  });
  it("regionColors maps each state to its status", () => {
    expect(regionColors(withStates)).toEqual({ "BR-SP": "lived", "BR-BA": "visited", "BR-AM": "want" });
  });
});
