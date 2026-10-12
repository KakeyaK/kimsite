import { describe, it, expect } from "vitest";
import type { Status, TravelData } from "./data";
import { describeOverlap, overlapColors, overlapKey } from "./overlap";

const map = (countries: Record<string, Status>, regions: Record<string, Status> = {}): TravelData => ({
  version: 1,
  countries: Object.fromEntries(Object.entries(countries).map(([k, status]) => [k, { status }])),
  regions: Object.fromEntries(Object.entries(regions).map(([k, status]) => [k, { status }])),
});

describe("overlapKey", () => {
  it.each([
    ["visited", "visited", "both-been"],
    ["lived", "visited", "both-been"],
    ["visited", "lived", "both-been"],
    ["want", "want", "both-want"],
    ["visited", undefined, "only-them"],
    ["lived", "want", "only-them"],
    [undefined, "visited", "only-you"],
    ["want", "lived", "only-you"],
    ["want", undefined, null],
    [undefined, "want", null],
    [undefined, undefined, null],
  ] as const)("owner %s, visitor %s → %s", (owner, visitor, expected) => {
    expect(overlapKey(owner, visitor)).toBe(expected);
  });
});

describe("overlapColors", () => {
  const owner = map({ JPN: "visited", BRA: "lived", FRA: "want", ITA: "want", USA: "visited" }, { "BR-BA": "lived", "BR-SP": "want" });
  const visitor = map({ JPN: "lived", FRA: "want", PRT: "visited", ITA: "visited", DEU: "want" }, { "BR-BA": "visited", "BR-SP": "want" });

  it("colours countries and states alike", () => {
    expect(overlapColors(owner, visitor)).toEqual({
      countries: { JPN: "both-been", BRA: "only-them", FRA: "both-want", ITA: "only-you", USA: "only-them", PRT: "only-you" },
      regions: { "BR-BA": "both-been", "BR-SP": "both-want" },
    });
  });
});

describe("describeOverlap", () => {
  it("puts both statuses in words", () => {
    expect(describeOverlap("Ana", "visited", "want")).toBe("Ana has been · you want to go");
    expect(describeOverlap("Kim", undefined, "lived")).toBe("Kim hasn't been · you've lived there");
  });
});
