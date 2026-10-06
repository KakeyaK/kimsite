# Optimization lab

Step-by-step animations of Gaussian elimination and the simplex method. Lives at `/sandbox/optimization`,
one tab per algorithm (`#gauss`, `#simplex`, `#two-phase`).

The app only draws. The algorithms themselves are three functions in `algorithms/`, and the page shows
whatever they yield.

## Writing the algorithms

| File | Function | Yields |
| --- | --- | --- |
| `algorithms/gauss.ts` | `gauss(system)` | one `GaussFrame` per row operation |
| `algorithms/simplex.ts` | `pivot(d, entering, leaving)`, `simplex(start)` | one `SimplexFrame` per dictionary |
| `algorithms/twoPhase.ts` | `twoPhase(lp)` | the same, with `phase` set |

Each is a generator: `yield` a frame whenever there is something to show. The types, with the sign and
numbering conventions of a `Dictionary`, are in `lib/types.ts`; each stub's comment says what its frames
should carry.

- Numbers are plain `number`s. The UI prints them as fractions (`0.3333…` shows as `1/3`), so there is no
  fraction type to deal with. `EPS` and `isZero` in `lib/format.ts` are there for comparisons.
- Frames are copied when yielded, so mutating and re-yielding the same object is fine.
- An exception, a malformed frame or a run past 500 frames doesn't break the page: it shows the message
  above the frames collected so far.
- `npm test` runs `algorithms/*.test.ts`. They skip themselves while a function still throws
  `NotImplementedError`, and don't depend on the pivoting rule or the elimination order.

## Layout

- `algorithms/` — the math, and its tests (`checks.ts` holds what the tests assert).
- `lib/` — everything else without UI: types, `collect` (runs an algorithm into a list of frames),
  number formatting, the starting dictionary, plane geometry for the plot, the example problems.
- `components/` — Preact UI. Entry points: `OptimizationLab` (the app) and `Preview` (the sandbox thumbnail).
  `GaussView` and `SimplexView` are the two kinds of tab; `Player` is the shared step control.
- `styles.css` — the step animations.

Outside this folder: `src/pages/sandbox/optimization/` (the routes) and
`src/content/sandbox/optimization/` (the sandbox card).
