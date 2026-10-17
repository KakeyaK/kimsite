import { describe, it, expect } from "vitest";
import { createInviteStore, SAVED_INVITES_KEY, type SavedInvite } from "./savedInvites";
import type { StorageLike } from "./storage";

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const entry = (id: string, title = "Japan"): SavedInvite => ({
  id,
  invite: "i=N4Ig",
  url: `https://go.kakeya.kim/${id}abcdefg`,
  title,
  saved: "2026-10-17T12:00:00.000Z",
});

describe("createInviteStore", () => {
  it("is empty when nothing is stored", () => {
    expect(createInviteStore(memoryStorage()).list()).toEqual([]);
  });

  it("keeps invites newest first, across stores", () => {
    const s = memoryStorage();
    createInviteStore(s).put(entry("a"));
    createInviteStore(s).put(entry("b"));
    expect(createInviteStore(s).list().map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("replaces an invite saved again under its id, and moves it to the top", () => {
    const store = createInviteStore(memoryStorage());
    store.put(entry("a"));
    store.put(entry("b"));
    store.put(entry("a", "Japan and Korea"));
    expect(store.list().map((e) => [e.id, e.title])).toEqual([["a", "Japan and Korea"], ["b", "Japan"]]);
  });

  it("removes an invite", () => {
    const store = createInviteStore(memoryStorage());
    store.put(entry("a"));
    store.put(entry("b"));
    store.remove("a");
    expect(store.list().map((e) => e.id)).toEqual(["b"]);
  });

  it("leaves out entries that don't parse, and survives corrupt storage", () => {
    const s = memoryStorage();
    s.map.set(SAVED_INVITES_KEY, JSON.stringify([entry("a"), { id: "b" }, "nope"]));
    expect(createInviteStore(s).list().map((e) => e.id)).toEqual(["a"]);
    s.map.set(SAVED_INVITES_KEY, "{not json");
    expect(createInviteStore(s).list()).toEqual([]);
  });

  it("says when it can't save", () => {
    const full: StorageLike = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} };
    expect(createInviteStore(full).put(entry("a"))).toBe(false);
    expect(createInviteStore(null).put(entry("a"))).toBe(false);
  });
});
