import type { Dictionary, LinearProgram } from "./types";

/**
 * The dictionary that defines the slacks: x_{n+i} = b_i − Σ_j A_ij x_j, and z = Σ_j c_j x_j.
 * Its basic solution is the origin, feasible only when every b_i ≥ 0.
 */
export function initialDictionary(lp: LinearProgram): Dictionary {
  const n = lp.c.length;
  return {
    basic: lp.b.map((_, i) => n + 1 + i),
    nonbasic: lp.c.map((_, j) => j + 1),
    b: [...lp.b],
    a: lp.A.map((row) => row.map((v) => 0 - v)),
    z: 0,
    c: [...lp.c],
  };
}

/** Value of a variable in the dictionary's basic solution. */
export function valueOf(d: Dictionary, variable: number): number {
  const row = d.basic.indexOf(variable);
  return row === -1 ? 0 : d.b[row];
}

/** The decision variables (x₁..xₙ) at the dictionary's basic solution. */
export function solutionOf(d: Dictionary, n: number): number[] {
  return Array.from({ length: n }, (_, j) => valueOf(d, j + 1));
}
