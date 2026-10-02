import { describe, it, expect } from "vitest";
import { COUNTRIES, KNOWN_ISO, KNOWN_REGIONS, REGIONS, countryName, regionByCode, regionsOf, searchCountries, searchRegions } from "./meta";
import { TOTAL_COUNTRIES } from "./stats";

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

  it("counts exactly the UN's 195 member and observer states", () => {
    const by = new Map(COUNTRIES.map((c) => [c.iso, c]));
    for (const iso of ["FRA", "NOR", "AUS", "JPN", "VAT", "PSX", "USA", "CHN", "CYP", "SOM"]) expect(by.get(iso)?.unState, iso).toBe(true);
    // territories, and places the UN doesn't list as states: drawn, but not counted
    for (const iso of ["HKG", "GRL", "ATC", "FRO", "JEY", "PRI", "ATA", "KOS", "TWN", "SAH"]) expect(by.get(iso)?.unState, iso).toBe(false);
    expect(COUNTRIES.filter((c) => c.unState)).toHaveLength(TOTAL_COUNTRIES);
  });

  it("draws unrecognised states as part of their UN country", () => {
    for (const iso of ["CYN", "SOL"]) expect(KNOWN_ISO.has(iso), iso).toBe(false);
    expect(countryName("FLK")).toBe("Falkland Islands (Malvinas)");
    // Crimea and Sevastopol are Ukraine's, whose states aren't tracked; Natural Earth files them under Russia
    for (const code of ["UA-43", "UA-40"]) expect(regionByCode(code), code).toBeUndefined();
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

describe("regions (Brazilian states)", () => {
  it("has the 27 Brazilian states with unique ISO 3166-2 codes", () => {
    const br = regionsOf("BRA");
    expect(br).toHaveLength(27);
    expect(new Set(br.map((r) => r.code)).size).toBe(27);
    expect(br.every((r) => /^BR-[A-Z]{2}$/.test(r.code) && r.country === "BRA")).toBe(true);
    for (const code of ["BR-SP", "BR-BA", "BR-DF", "BR-RJ", "BR-AM"]) expect(KNOWN_REGIONS.has(code), code).toBe(true);
  });
  it("names and bboxes", () => {
    expect(regionByCode("BR-SP")?.name).toBe("São Paulo");
    for (const r of REGIONS) {
      const [w, s, e, n] = r.bbox;
      expect(w).toBeLessThan(e);
      expect(s).toBeLessThan(n);
    }
  });
  it("searchRegions ignores accents", () => {
    expect(searchRegions("sao paulo")[0]?.code).toBe("BR-SP");
    expect(searchRegions("  ")).toEqual([]);
  });
});
