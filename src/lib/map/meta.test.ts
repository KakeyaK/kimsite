import { describe, it, expect } from "vitest";
import { COUNTRIES, KNOWN_ISO, countryName, searchCountries } from "./meta";

describe("country meta", () => {
  it("uses ADM0_A3 so France and Norway have real codes", () => {
    expect(KNOWN_ISO.has("FRA")).toBe(true);
    expect(KNOWN_ISO.has("NOR")).toBe(true);
    expect(KNOWN_ISO.has("-99")).toBe(false);
  });
  it("has unique ids and sane bboxes", () => {
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      const [w, s, e, n] = c.bbox;
      expect(w).toBeLessThanOrEqual(e);
      expect(s).toBeLessThanOrEqual(n);
    }
  });
  it("names fall back to the code", () => {
    expect(countryName("JPN")).toBe("Japan");
    expect(countryName("ZZZ")).toBe("ZZZ");
  });
});

describe("generated data (review fixes)", () => {
  it("files Australian cities under AUS, not Ashmore and Cartier Is. (shared ISO-2 'AU')", async () => {
    const { readFileSync } = await import("node:fs");
    const cities: [string, string][] = JSON.parse(readFileSync("public/map/cities.json", "utf8"));
    const sydney = cities.find((c) => c[0] === "Sydney");
    expect(sydney?.[1]).toBe("AUS");
    expect(cities.some((c) => c[1] === "ATC")).toBe(false);
    expect(cities.every((c) => KNOWN_ISO.has(c[1]))).toBe(true);
  });

  it("flags sovereign states so territories don't count toward totals", () => {
    const by = new Map(COUNTRIES.map((c) => [c.iso, c]));
    for (const iso of ["FRA", "NOR", "AUS", "JPN", "VAT", "PSX", "USA", "CHN"]) expect(by.get(iso)?.sovereign, iso).toBe(true);
    for (const iso of ["HKG", "GRL", "ATC", "FRO", "JEY", "PRI", "ATA"]) expect(by.get(iso)?.sovereign, iso).toBe(false);
    const n = COUNTRIES.filter((c) => c.sovereign).length;
    expect(n).toBeGreaterThanOrEqual(193);
    expect(n).toBeLessThanOrEqual(200);
  });
});

describe("searchCountries", () => {
  it("ranks prefix matches first and ignores accents/case", () => {
    const names = searchCountries("ja").map((c) => c.name);
    expect(names[0]).toBe("Jamaica");
    expect(names).toContain("Japan");
    expect(searchCountries("COTE")[0]?.iso).toBe("CIV"); // Côte d'Ivoire
  });
  it("finds substring matches after prefix matches", () => {
    const found = searchCountries("land", 50);
    expect(found.map((c) => c.iso)).toContain("FIN");
    expect(found.every((c) => c.name.toLowerCase().includes("land"))).toBe(true);
  });
  it("returns nothing for an empty query and respects the limit", () => {
    expect(searchCountries("  ")).toEqual([]);
    expect(searchCountries("a", 5)).toHaveLength(5);
  });
});
