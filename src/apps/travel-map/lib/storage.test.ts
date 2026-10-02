import { describe, it, expect } from "vitest";
import { createStore, exportJson, importJson, STORAGE_KEY, type StorageLike } from "./storage";
import { emptyData, type TravelData } from "./data";

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const throwing: StorageLike = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("QuotaExceededError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};

const data: TravelData = { version: 1, regions: {}, countries: { JPN: { status: "visited" } } };
const known = { countries: new Set(["JPN", "BRA"]), regions: new Set(["BR-SP"]) };

describe("createStore", () => {
  it("round-trips through storage", () => {
    const s = memoryStorage();
    createStore(s).save(data);
    expect(createStore(s).load()).toEqual(data);
  });

  it("returns empty data when nothing is stored", () => {
    expect(createStore(memoryStorage()).load()).toEqual(emptyData());
  });

  it("falls back to memory when storage throws, and says so", () => {
    const store = createStore(throwing);
    expect(store.load()).toEqual(emptyData());
    store.save(data);
    expect(store.load()).toEqual(data);
    expect(store.isPersistent()).toBe(false);
  });

  it("falls back to memory when there is no storage at all", () => {
    const store = createStore(null);
    store.save(data);
    expect(store.load()).toEqual(data);
    expect(store.isPersistent()).toBe(false);
  });

  it("keeps corrupt stored data aside instead of silently losing it", () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, "{not json");
    expect(createStore(s).load()).toEqual(emptyData());
    expect(s.map.get(`${STORAGE_KEY}:corrupt`)).toBe("{not json");
  });

  it("clear removes the stored document", () => {
    const s = memoryStorage();
    const store = createStore(s);
    store.save(data);
    store.clear();
    expect(store.load()).toEqual(emptyData());
  });
});

describe("importJson", () => {
  it("accepts its own export", () => {
    const r = importJson(exportJson(data), known);
    expect(r).toEqual({ ok: true, data, warnings: [] });
  });

  it("rejects text that is not JSON", () => {
    const r = importJson("hello", known);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/not valid JSON/i);
  });

  it("reports per-field errors with their path", () => {
    const r = importJson(JSON.stringify({ version: 1, regions: {}, countries: { JPN: { status: "visited", years: ["2019"] } } }), known);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("countries.JPN.years.0"))).toBe(true);
  });

  it("drops unknown countries and warns", () => {
    const r = importJson(JSON.stringify({ version: 1, regions: {}, countries: { JPN: { status: "visited" }, ZZZ: { status: "want" } } }), known);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.data.countries)).toEqual(["JPN"]);
      expect(r.warnings[0]).toMatch(/ZZZ/);
    }
  });

  it("drops unknown regions and warns", () => {
    const r = importJson(JSON.stringify({ version: 1, countries: {}, regions: { "BR-SP": { status: "visited" }, "BR-XX": { status: "want" } } }), known);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.data.regions)).toEqual(["BR-SP"]);
      expect(r.warnings[0]).toMatch(/BR-XX/);
    }
  });
});
