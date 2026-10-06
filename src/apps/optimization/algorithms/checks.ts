import { collect, type Trace } from "@apps/optimization/lib/trace";
import type { Dictionary, LinearProgram, Matrix } from "@apps/optimization/lib/types";

// Helpers for the tests in this folder. They check what any correct implementation must satisfy,
// whatever pivoting rule or elimination order it uses.

const close = (a: number, b: number) => Math.abs(a - b) < 1e-7;

/** Runs an algorithm for a test; `todo` tells the test to skip itself while the algorithm is unwritten. */
export function trace<F>(run: () => Iterable<F>): Trace<F> & { todo: boolean } {
  const result = collect(run, () => null);
  return { ...result, todo: result.problem?.kind === "todo" };
}

/** Does `x` solve every equation of the augmented matrix? Row operations never change that. */
export function solves(matrix: Matrix, x: number[]): boolean {
  return matrix.every((row) =>
    close(
      x.reduce((sum, value, j) => sum + row[j] * value, 0),
      row[x.length],
    ),
  );
}

/** Row echelon form: each row's first nonzero entry is to the right of the one above; zero rows come last. */
export function isEchelon(matrix: Matrix): boolean {
  const unknowns = matrix[0].length - 1;
  const leads = matrix.map((row) => {
    const lead = row.slice(0, unknowns).findIndex((v) => !close(v, 0));
    return lead === -1 ? Infinity : lead;
  });
  return leads.every((lead, i) => i === 0 || lead > leads[i - 1] || (lead === Infinity && leads[i - 1] === Infinity));
}

/**
 * Is the dictionary another way of writing the program's equations (slacks and objective)?
 * Tried on a few arbitrary values for the nonbasic variables: the basic ones follow from the
 * dictionary, and together they must satisfy x_{n+i} = b_i − Σ A_ij x_j and z = c · x.
 */
export function describes(d: Dictionary, lp: LinearProgram): boolean {
  const n = lp.c.length;
  return [0.3, 1.7, -2.9].every((seed) => {
    const free = d.nonbasic.map((_, j) => seed + 0.61 * j);
    const combine = (constant: number, row: number[]) => row.reduce((sum, coefficient, j) => sum + coefficient * free[j], constant);
    const value = new Map<number, number>([
      ...d.nonbasic.map((variable, j) => [variable, free[j]] as const),
      ...d.basic.map((variable, i) => [variable, combine(d.b[i], d.a[i])] as const),
    ]);
    const x = lp.c.map((_, j) => value.get(j + 1) ?? NaN);
    const dot = (row: number[]) => row.reduce((sum, coefficient, j) => sum + coefficient * x[j], 0);
    return lp.A.every((row, i) => close(value.get(n + 1 + i) ?? NaN, lp.b[i] - dot(row))) && close(combine(d.z, d.c), dot(lp.c));
  });
}

/** Is `x` feasible for the program? */
export function satisfies(lp: LinearProgram, x: number[]): boolean {
  return x.every((v) => v > -1e-7) && lp.A.every((row, i) => row.reduce((sum, a, j) => sum + a * x[j], 0) < lp.b[i] + 1e-7);
}
