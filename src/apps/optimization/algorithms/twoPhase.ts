import { NotImplementedError, type LinearProgram, type SimplexFrame } from "@apps/optimization/lib/types";

/**
 * The simplex method for any linear program, including those where the origin isn't feasible
 * (some `b[i]` < 0), so the initial dictionary can't be the starting point.
 *
 * Yield frames as in `simplex`, plus `phase: 1` on the frames of the auxiliary problem and
 * `phase: 2` on those of the original one. End with `status: "infeasible"` when phase 1 shows
 * there is no feasible point.
 *
 * Variable 0 is reserved for an auxiliary variable (shown as x₀). `initialDictionary` in
 * lib/dictionary.ts builds the dictionary of the original problem.
 */
// eslint-disable-next-line require-yield, @typescript-eslint/no-unused-vars
export function* twoPhase(lp: LinearProgram): Generator<SimplexFrame> {
  throw new NotImplementedError("twoPhase");
}
