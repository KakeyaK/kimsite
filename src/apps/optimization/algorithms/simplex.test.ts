import { describe, expect, it } from "vitest";
import { initialDictionary, solutionOf } from "@apps/optimization/lib/dictionary";
import { SIMPLEX_EXAMPLES } from "@apps/optimization/lib/examples";
import type { LinearProgram } from "@apps/optimization/lib/types";
import { describes, satisfies, trace } from "./checks";
import { pivot, simplex } from "./simplex";

// Skipped until `pivot` and `simplex` are written.

const example = (name: string): LinearProgram => SIMPLEX_EXAMPLES.find((e) => e.name === name)!.value;

const OPTIMA = [
  { name: "Four constraints", z: 21 },
  { name: "Three constraints", z: 36 },
  { name: "Degenerate vertex", z: 2 },
  { name: "Three variables (no plot)", z: 13 },
];

describe("pivot", () => {
  it("swaps the two variables and keeps the dictionary equivalent", (ctx) => {
    const lp = example("Four constraints");
    const start = initialDictionary(lp);
    const before = structuredClone(start);
    const run = trace(() => [pivot(start, 1, 3)]);
    if (run.todo) return ctx.skip();

    expect(run.problem).toBeUndefined();
    const d = run.frames[0];
    expect(start).toEqual(before);
    expect([...d.basic].sort()).toEqual([1, 4, 5, 6]);
    expect([...d.nonbasic].sort()).toEqual([2, 3]);
    expect(describes(d, lp)).toBe(true);
    // x₁ enters until 6x₁ ≤ 24 is tight: the vertex (4, 0), where z = 20
    expect(solutionOf(d, 2)).toEqual([4, 0]);
    expect(d.z).toBeCloseTo(20);
  });
});

describe("simplex", () => {
  for (const { name, z } of OPTIMA) {
    it(`finds the optimum of "${name}"`, (ctx) => {
      const lp = example(name);
      const run = trace(() => simplex(initialDictionary(lp)));
      if (run.todo) return ctx.skip();

      expect(run.problem).toBeUndefined();
      run.frames.forEach((frame) => {
        expect(describes(frame.dictionary, lp)).toBe(true);
        expect(satisfies(lp, solutionOf(frame.dictionary, lp.c.length))).toBe(true);
      });
      // The objective never gets worse along the way
      run.frames.slice(1).forEach((frame, i) => expect(frame.dictionary.z).toBeGreaterThanOrEqual(run.frames[i].dictionary.z - 1e-9));
      const last = run.frames.at(-1)!;
      expect(last.status).toBe("optimal");
      expect(last.dictionary.z).toBeCloseTo(z);
    });
  }

  it("starts with the dictionary it was given", (ctx) => {
    const start = initialDictionary(example("Three constraints"));
    const run = trace(() => simplex(start));
    if (run.todo) return ctx.skip();

    expect(run.frames[0].dictionary).toEqual(start);
  });

  it("reports an unbounded problem", (ctx) => {
    const run = trace(() => simplex(initialDictionary(example("Unbounded"))));
    if (run.todo) return ctx.skip();

    expect(run.problem).toBeUndefined();
    expect(run.frames.at(-1)!.status).toBe("unbounded");
  });
});
