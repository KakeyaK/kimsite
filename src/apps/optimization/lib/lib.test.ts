import { describe, expect, it } from "vitest";
import { initialDictionary, solutionOf, valueOf } from "./dictionary";
import { formatNumber, parseNumber, termParts, varName } from "./format";
import { feasibleRegion, isFeasible, lineInView, ticks, viewFor } from "./geometry";
import { collect, gaussFrameFlaw, simplexFrameFlaw } from "./trace";
import { NotImplementedError, type LinearProgram } from "./types";

const lp: LinearProgram = {
  c: [3, 5],
  A: [
    [1, 0],
    [0, 2],
    [3, 2],
  ],
  b: [4, 12, 18],
};

describe("format", () => {
  it("writes numbers as exact fractions when they are one", () => {
    expect(formatNumber(3)).toBe("3");
    expect(formatNumber(-2.5)).toBe("−5/2");
    expect(formatNumber(1 / 3)).toBe("1/3");
    expect(formatNumber(0.1 + 0.2)).toBe("3/10");
    expect(formatNumber(-1e-12)).toBe("0");
    expect(formatNumber(Math.PI)).toBe("3.142");
  });

  it("splits a term into sign and coefficient, hiding a coefficient of one", () => {
    expect(termParts(-1)).toEqual({ sign: "−", magnitude: "" });
    expect(termParts(2 / 3)).toEqual({ sign: "+", magnitude: "2/3" });
  });

  it("names variables with subscripts", () => {
    expect(varName(0)).toBe("x₀");
    expect(varName(12)).toBe("x₁₂");
  });

  it("reads decimals and fractions, and rejects the rest", () => {
    expect(parseNumber(" -2.5 ")).toBe(-2.5);
    expect(parseNumber("1/4")).toBe(0.25);
    expect(parseNumber("−3")).toBe(-3);
    for (const text of ["", "-", "1/", "1/0", "abc", "1e"]) expect(parseNumber(text)).toBeNull();
  });
});

describe("dictionary", () => {
  it("builds the dictionary that defines the slacks", () => {
    expect(initialDictionary(lp)).toEqual({
      basic: [3, 4, 5],
      nonbasic: [1, 2],
      b: [4, 12, 18],
      a: [
        [-1, 0],
        [0, -2],
        [-3, -2],
      ],
      z: 0,
      c: [3, 5],
    });
  });

  it("reads the basic solution", () => {
    const d = { ...initialDictionary(lp), basic: [3, 2, 5] };
    expect(valueOf(d, 2)).toBe(12);
    expect(solutionOf(d, 2)).toEqual([0, 12]);
  });
});

describe("geometry", () => {
  it("finds the feasible region and a view that holds it", () => {
    const view = viewFor(lp);
    expect(view.x).toBeCloseTo(4 * 1.15);
    expect(view.y).toBeCloseTo(6 * 1.15);
    const corners = feasibleRegion(lp, view).map((p) => [Math.round(p.x), Math.round(p.y)]);
    expect(corners).toEqual([
      [0, 0],
      [4, 0],
      [4, 3],
      [2, 6],
      [0, 6],
    ]);
  });

  it("has no region for an infeasible program, but still a view", () => {
    const empty: LinearProgram = { c: [1, 1], A: [[1, 1], [-1, -1]], b: [2, -4] };
    expect(feasibleRegion(empty, { x: 10, y: 10 })).toEqual([]);
    expect(viewFor(empty)).toEqual({ x: 6, y: 6 });
  });

  it("grows the view for points an algorithm visits, unless they are absurdly far", () => {
    expect(viewFor(lp, [{ x: 8, y: 0 }]).x).toBeCloseTo(8 * 1.15);
    expect(viewFor(lp, [{ x: 1e9, y: NaN }]).x).toBeCloseTo(4 * 1.15);
  });

  it("tests feasibility", () => {
    expect(isFeasible(lp, { x: 2, y: 6 })).toBe(true);
    expect(isFeasible(lp, { x: 4, y: 6 })).toBe(false);
    expect(isFeasible(lp, { x: -1, y: 0 })).toBe(false);
  });

  it("clips a line to the view", () => {
    const [p, q] = lineInView({ a: 3, b: 2, c: 18 }, { x: 5, y: 7 })!.sort((p, q) => p.x - q.x);
    expect([p.x, p.y]).toEqual([4 / 3, 7].map((v) => expect.closeTo(v)));
    expect([q.x, q.y]).toEqual([5, 1.5].map((v) => expect.closeTo(v)));
    expect(lineInView({ a: 1, b: 0, c: 9 }, { x: 5, y: 7 })).toBeNull();
  });

  it("picks round ticks", () => {
    expect(ticks(4.6)).toEqual([0, 1, 2, 3, 4]);
    expect(ticks(0.9)).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    expect(ticks(130)).toEqual([0, 50, 100]);
  });
});

describe("collect", () => {
  const anything = () => null;

  it("copies frames as they are yielded", () => {
    const shared = { n: 0 };
    const run = function* () {
      for (shared.n = 1; shared.n <= 3; shared.n++) yield shared;
    };
    expect(collect(run, anything)).toEqual({ frames: [{ n: 1 }, { n: 2 }, { n: 3 }] });
  });

  it("turns a missing algorithm, an exception and an endless loop into problems", () => {
    const todo = collect<number>(() => {
      throw new NotImplementedError("gauss");
    }, anything);
    expect(todo.problem?.kind).toBe("todo");

    const failed = collect(function* () {
      yield 1;
      throw new TypeError("boom");
    }, anything);
    expect(failed.frames).toEqual([1]);
    expect(failed.problem).toEqual({ kind: "error", message: "Threw after 1 steps. TypeError: boom" });

    const endless = collect(
      function* () {
        while (true) yield 0;
      },
      anything,
      10,
    );
    expect(endless.frames).toHaveLength(10);
    expect(endless.problem?.kind).toBe("limit");
  });

  it("stops at a frame that can't be drawn", () => {
    const run = collect(() => [1, 2, -3, 4], (n) => (n < 0 ? "negative" : null));
    expect(run.frames).toEqual([1, 2]);
    expect(run.problem?.message).toBe("Step 3 can't be shown: negative.");
  });

  it("spots malformed frames", () => {
    expect(gaussFrameFlaw({ matrix: [[1, 2], [3, 4]] }, 2, 2)).toBeNull();
    expect(gaussFrameFlaw({ matrix: [[1, 2]] }, 2, 2)).toMatch(/2 rows of 2/);
    expect(gaussFrameFlaw({ matrix: [[1, 2], [3, 4]], op: { kind: "swap", a: 0, b: 2 } }, 2, 2)).toMatch(/row/);
    expect(simplexFrameFlaw({ dictionary: initialDictionary(lp) })).toBeNull();
    expect(simplexFrameFlaw({ dictionary: { ...initialDictionary(lp), b: [1] } })).toMatch(/b must have 3/);
  });
});
