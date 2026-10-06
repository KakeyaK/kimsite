import { describe, expect, it } from "vitest";
import type { Matrix } from "@apps/optimization/lib/types";
import { isEchelon, solves, trace } from "./checks";
import { gauss } from "./gauss";

// Skipped until `gauss` is written.

const CASES: { name: string; system: Matrix; solution: number[] }[] = [
  {
    name: "a 3 × 3 system",
    system: [
      [2, 1, -1, 8],
      [-3, -1, 2, -11],
      [-2, 1, 2, -3],
    ],
    solution: [2, 3, -1],
  },
  {
    name: "a system that starts with a zero pivot",
    system: [
      [0, 2, 1, 7],
      [1, 1, 1, 6],
      [2, 1, -1, 1],
    ],
    solution: [1, 2, 3],
  },
  {
    name: "a 4 × 4 system",
    system: [
      [1, 1, 1, 1, 10],
      [2, -1, 3, 0, 9],
      [0, 4, -1, 2, 13],
      [3, 0, 2, -1, 5],
    ],
    solution: [1, 2, 3, 4],
  },
];

describe("gauss", () => {
  for (const { name, system, solution } of CASES) {
    it(`reduces ${name} without changing its solution`, (ctx) => {
      const original = structuredClone(system);
      const run = trace(() => gauss(system));
      if (run.todo) return ctx.skip();

      expect(run.problem).toBeUndefined();
      expect(system).toEqual(original);
      expect(run.frames.length).toBeGreaterThan(0);
      run.frames.forEach((frame) => expect(solves(frame.matrix, solution)).toBe(true));
      expect(isEchelon(run.frames.at(-1)!.matrix)).toBe(true);
    });
  }

  it("reaches echelon form on a singular system", (ctx) => {
    const run = trace(() =>
      gauss([
        [1, 2, -1, 3],
        [2, 4, -2, 7],
        [1, -1, 1, 2],
      ]),
    );
    if (run.todo) return ctx.skip();

    expect(run.problem).toBeUndefined();
    expect(isEchelon(run.frames.at(-1)!.matrix)).toBe(true);
  });
});
