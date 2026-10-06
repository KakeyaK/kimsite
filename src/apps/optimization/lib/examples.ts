import type { LinearProgram, Matrix } from "./types";

export type Example<T> = { name: string; value: T };

/** Augmented matrices. */
export const GAUSS_EXAMPLES: Example<Matrix>[] = [
  {
    name: "3 × 3, one solution",
    value: [
      [2, 1, -1, 8],
      [-3, -1, 2, -11],
      [-2, 1, 2, -3],
    ],
  },
  {
    name: "Needs a row swap",
    value: [
      [0, 2, 1, 7],
      [1, 1, 1, 6],
      [2, 1, -1, 1],
    ],
  },
  {
    name: "4 × 4",
    value: [
      [1, 1, 1, 1, 10],
      [2, -1, 3, 0, 9],
      [0, 4, -1, 2, 13],
      [3, 0, 2, -1, 5],
    ],
  },
  {
    name: "No solution",
    value: [
      [1, 2, -1, 3],
      [2, 4, -2, 7],
      [1, -1, 1, 2],
    ],
  },
  {
    name: "Infinitely many solutions",
    value: [
      [1, 2, -1, 3],
      [2, 4, -2, 6],
      [1, -1, 1, 2],
    ],
  },
];

/** Programs whose origin is feasible (b ≥ 0). */
export const SIMPLEX_EXAMPLES: Example<LinearProgram>[] = [
  {
    name: "Four constraints",
    value: {
      c: [5, 4],
      A: [
        [6, 4],
        [1, 2],
        [-1, 1],
        [0, 1],
      ],
      b: [24, 6, 1, 2],
    },
  },
  {
    name: "Three constraints",
    value: {
      c: [3, 5],
      A: [
        [1, 0],
        [0, 2],
        [3, 2],
      ],
      b: [4, 12, 18],
    },
  },
  {
    name: "Degenerate vertex",
    value: {
      c: [1, 1],
      A: [
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      b: [1, 1, 2],
    },
  },
  {
    name: "Unbounded",
    value: {
      c: [1, 1],
      A: [
        [-1, 1],
        [1, -2],
      ],
      b: [1, 2],
    },
  },
  {
    name: "Three variables (no plot)",
    value: {
      c: [5, 4, 3],
      A: [
        [2, 3, 1],
        [4, 1, 2],
        [3, 4, 2],
      ],
      b: [5, 11, 8],
    },
  },
];

/** Programs whose origin is not feasible (some b < 0). */
export const TWO_PHASE_EXAMPLES: Example<LinearProgram>[] = [
  {
    name: "Origin cut off",
    value: {
      c: [3, 2],
      A: [
        [1, 1],
        [-1, -1],
        [1, -1],
      ],
      b: [6, -2, 2],
    },
  },
  {
    name: "Minimize a cost",
    value: {
      c: [-2, -3],
      A: [
        [-1, -1],
        [-1, -3],
        [1, 0],
      ],
      b: [-4, -6, 5],
    },
  },
  {
    name: "Infeasible",
    value: {
      c: [1, 1],
      A: [
        [1, 1],
        [-1, -1],
      ],
      b: [2, -4],
    },
  },
  {
    name: "Three variables (no plot)",
    value: {
      c: [1, -1, 1],
      A: [
        [2, -1, 2],
        [2, -3, 1],
        [-1, 1, -2],
      ],
      b: [4, -5, -1],
    },
  },
];
