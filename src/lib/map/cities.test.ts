import { describe, it, expect } from "vitest";
import { cityId, customCityId, addCity } from "./cities";

describe("ids", () => {
  it("cityId is stable and slugged", () => {
    expect(cityId("BRA", "São Paulo", -23.55, -46.63)).toBe("BRA-sao-paulo--23.6--46.6");
  });
  it("customCityId is unique per call time", () => {
    expect(customCityId(1)).not.toBe(customCityId(2));
    expect(customCityId(1)).toMatch(/^custom-/);
  });
});

describe("addCity", () => {
  const tokyo = { id: "JPN-tokyo-35.7-139.7", name: "Tokyo", country: "JPN", lat: 35.68, lon: 139.69, status: "visited" as const };
  it("appends a new city", () => {
    expect(addCity([], tokyo)).toEqual([tokyo]);
  });
  it("keeps the existing entry (year, status, note) when the same city is added again", () => {
    const existing = { ...tokyo, status: "want" as const, year: 2019, note: "sushi" };
    const list = [existing];
    expect(addCity(list, tokyo)).toBe(list);
  });
});
