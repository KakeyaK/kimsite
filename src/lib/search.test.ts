import { describe, expect, it } from "vitest";
import { searchItems, type SearchItem } from "./search";

const item = (title: string, extra: Partial<SearchItem> = {}): SearchItem => ({
  title,
  description: "",
  href: `/${title}`,
  kind: "Post",
  ...extra,
});

const titles = (items: SearchItem[]) => items.map((i) => i.title);

describe("searchItems", () => {
  it("returns every item, in order, for an empty query", () => {
    const items = [item("Blog"), item("Projects")];
    expect(searchItems(items, "")).toEqual(items);
    expect(searchItems(items, "   ")).toEqual(items);
  });

  it("returns nothing when no item matches", () => {
    expect(searchItems([item("Blog"), item("Projects")], "xyz")).toEqual([]);
  });

  it("ignores case and accents", () => {
    const items = [item("University of São Paulo"), item("Travel map")];
    expect(titles(searchItems(items, "SAO"))).toEqual([
      "University of São Paulo",
    ]);
  });

  it("ranks title prefix, then word start, then substring, then description, then loose letters", () => {
    const items = [
      item("My tmux app"),
      item("Notes", { description: "about my map" }),
      item("Roadmaps"),
      item("Travel map"),
      item("Map of things"),
    ];
    expect(titles(searchItems(items, "map"))).toEqual([
      "Map of things",
      "Travel map",
      "Roadmaps",
      "Notes",
      "My tmux app",
    ]);
  });

  it("keeps the input order between equally good matches", () => {
    const items = [item("Tutorial 2"), item("Tutorial 1"), item("Tutorial 3")];
    expect(titles(searchItems(items, "tutorial"))).toEqual([
      "Tutorial 2",
      "Tutorial 1",
      "Tutorial 3",
    ]);
  });

  it("requires every word of the query to match", () => {
    const items = [
      item("Tutorial 1: QEMU"),
      item("Tutorial 2: Kernel modules"),
      item("Contributing to the kernel"),
    ];
    expect(titles(searchItems(items, "tutorial kernel"))).toEqual([
      "Tutorial 2: Kernel modules",
    ]);
  });

  it("matches on the path and the kind", () => {
    const items = [
      item("Proposta", { path: "Blog / MAC0499" }),
      item("Aurora", { kind: "Project", path: "Projects" }),
    ];
    expect(titles(searchItems(items, "mac0499"))).toEqual(["Proposta"]);
    expect(titles(searchItems(items, "project"))).toEqual(["Aurora"]);
  });

  it("finds a title from letters typed in order", () => {
    const items = [
      item("Tutorial 1"),
      item("Travel map"),
      item("Contributing to the Linux Kernel 1"),
    ];
    expect(titles(searchItems(items, "tut1"))).toEqual(["Tutorial 1"]);
    // loose matches have to begin at the start of a word
    expect(searchItems(items, "tlk")).toEqual([items[2]]);
    expect(searchItems(items, "onl")).toEqual([]);
  });
});
