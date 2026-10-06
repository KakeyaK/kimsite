import { describe, expect, it } from "vitest";
import { solutionOf } from "@apps/optimization/lib/dictionary";
import { SIMPLEX_EXAMPLES, TWO_PHASE_EXAMPLES } from "@apps/optimization/lib/examples";
import type { LinearProgram } from "@apps/optimization/lib/types";
import { describes, satisfies, trace } from "./checks";
import { twoPhase } from "./twoPhase";

// Skipped until `twoPhase` is written. Phase 1 frames are not inspected, so any way of building
// the auxiliary problem passes; only what comes out of it is checked.

const example = (name: string): LinearProgram => [...TWO_PHASE_EXAMPLES, ...SIMPLEX_EXAMPLES].find((e) => e.name === name)!.value;

const OPTIMA = [
  { name: "Origin cut off", z: 16 },
  { name: "Minimize a cost", z: -9 },
  { name: "Three variables (no plot)", z: 0.6 },
  // Nothing to bootstrap here: the origin is feasible
  { name: "Four constraints", z: 21 },
];

describe("twoPhase", () => {
  for (const { name, z } of OPTIMA) {
    it(`finds the optimum of "${name}"`, (ctx) => {
      const lp = example(name);
      const run = trace(() => twoPhase(lp));
      if (run.todo) return ctx.skip();

      expect(run.problem).toBeUndefined();
      run.frames
        .filter((frame) => frame.phase !== 1)
        .forEach((frame) => {
          expect(describes(frame.dictionary, lp)).toBe(true);
          expect(satisfies(lp, solutionOf(frame.dictionary, lp.c.length))).toBe(true);
        });
      const last = run.frames.at(-1)!;
      expect(last.status).toBe("optimal");
      expect(last.dictionary.z).toBeCloseTo(z);
    });
  }

  it("reports an infeasible problem", (ctx) => {
    const run = trace(() => twoPhase(example("Infeasible")));
    if (run.todo) return ctx.skip();

    expect(run.problem).toBeUndefined();
    expect(run.frames.at(-1)!.status).toBe("infeasible");
  });

  it("reports an unbounded problem", (ctx) => {
    const run = trace(() => twoPhase(example("Unbounded")));
    if (run.todo) return ctx.skip();

    expect(run.problem).toBeUndefined();
    expect(run.frames.at(-1)!.status).toBe("unbounded");
  });
});
