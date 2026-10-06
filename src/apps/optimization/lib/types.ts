/** Thrown by an algorithm that hasn't been written yet; the UI shows a "to do" note instead of an error. */
export class NotImplementedError extends Error {
  constructor(name: string) {
    super(`${name} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}

// ---------------------------------------------------------------------------
// Gauss
// ---------------------------------------------------------------------------

/** Rows of numbers. For a linear system it is the augmented matrix: the last column is the right-hand side. */
export type Matrix = number[][];

/** An elementary row operation. Rows are 0-based (the UI shows row 0 as R1). */
export type RowOp =
  /** Ra ↔ Rb */
  | { kind: "swap"; a: number; b: number }
  /** Rrow ← factor · Rrow */
  | { kind: "scale"; row: number; factor: number }
  /** Rtarget ← Rtarget + factor · Rsource */
  | { kind: "add"; target: number; source: number; factor: number };

/** One step of the elimination. */
export type GaussFrame = {
  /** The whole augmented matrix after `op`. */
  matrix: Matrix;
  /** The operation that turned the previous frame's matrix into this one. Drives the row highlights. */
  op?: RowOp;
  /** The pivot this step works with, outlined in the UI. */
  pivot?: { row: number; col: number };
  /** Free text shown under the system. */
  note?: string;
};

// ---------------------------------------------------------------------------
// Simplex
// ---------------------------------------------------------------------------

/**
 * A linear program in standard form:
 *
 *   maximize    c · x
 *   subject to  A x ≤ b
 *               x ≥ 0
 *
 * With n variables and m constraints, `c` has n entries, `A` is m × n and `b` has m entries.
 */
export type LinearProgram = {
  c: number[];
  A: number[][];
  b: number[];
};

/**
 * A dictionary: every basic variable, and the objective, written in terms of the nonbasic variables.
 *
 *   x_basic[i] = b[i] + Σ_j a[i][j] · x_nonbasic[j]
 *   z          = z    + Σ_j c[j]    · x_nonbasic[j]
 *
 * The coefficients are stored exactly as they are displayed, signs included.
 *
 * Variables are numbered: 1..n are the decision variables, n+1..n+m the slacks (x_{n+i} is the slack
 * of constraint i), and 0 is free for an auxiliary variable (x₀).
 *
 * The matching basic solution sets every nonbasic variable to 0, so x_basic[i] = b[i].
 */
export type Dictionary = {
  /** Variable of each row. */
  basic: number[];
  /** Variable of each column. */
  nonbasic: number[];
  /** Constant of each row. */
  b: number[];
  /** `a[i][j]`: coefficient of x_nonbasic[j] in the row of x_basic[i]. */
  a: number[][];
  /** Constant of the objective row: the objective's value at the basic solution. */
  z: number;
  /** `c[j]`: coefficient of x_nonbasic[j] in the objective row. */
  c: number[];
};

/** One dictionary of a simplex run. */
export type SimplexFrame = {
  dictionary: Dictionary;
  /** Variable that will enter the basis in the pivot out of this dictionary. Its column is highlighted. */
  entering?: number;
  /** Variable that will leave the basis in that pivot. Its row is highlighted. */
  leaving?: number;
  /** 1 while solving an auxiliary problem (the objective row is then labelled w), 2 for the real one. */
  phase?: 1 | 2;
  /** Set on the last frame: how the run ended. */
  status?: "optimal" | "unbounded" | "infeasible";
  /** Free text shown under the dictionary. */
  note?: string;
};
