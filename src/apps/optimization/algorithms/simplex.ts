import { NotImplementedError, type Dictionary, type SimplexFrame } from "@apps/optimization/lib/types";

/**
 * One pivot: `entering` (a nonbasic variable) takes the place of `leaving` (a basic variable).
 * Both are variable numbers, not row/column positions. Returns a new dictionary; `d` is not changed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function pivot(d: Dictionary, entering: number, leaving: number): Dictionary {
  throw new NotImplementedError("pivot");
}

/**
 * The simplex method, starting from a feasible dictionary (every `b[i]` ≥ 0).
 *
 * Yield every dictionary you go through, the first one included. On each frame say which pivot
 * comes next, and on the last one how it ended:
 *
 *   yield { dictionary: d, entering: 1, leaving: 4 };
 *   ...
 *   yield { dictionary: d, status: "optimal" };   // or "unbounded" (with `entering` set, if you like)
 *
 * The pivoting rule (largest coefficient, Bland, ...) is up to you.
 */
// eslint-disable-next-line require-yield, @typescript-eslint/no-unused-vars
export function* simplex(start: Dictionary): Generator<SimplexFrame> {
  throw new NotImplementedError("simplex");
}
