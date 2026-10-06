import { NotImplementedError, type GaussFrame, type SimplexFrame } from "./types";

/** The frames an algorithm produced, and what cut the run short if anything did. */
export type Trace<F> = {
  frames: F[];
  problem?: {
    /** todo: not written yet. error: it threw, or yielded a broken frame. limit: it never stopped. */
    kind: "todo" | "error" | "limit";
    message: string;
  };
};

export const FRAME_LIMIT = 500;

/**
 * Runs an algorithm and keeps a copy of every frame it yields. Nothing it does can break the page:
 * exceptions, malformed frames and endless loops all end up as `problem`, next to the frames
 * collected until then.
 */
export function collect<F>(run: () => Iterable<F>, check: (frame: F) => string | null, limit = FRAME_LIMIT): Trace<F> {
  const frames: F[] = [];
  try {
    for (const frame of run()) {
      if (frames.length >= limit) {
        return { frames, problem: { kind: "limit", message: `Stopped after ${limit} steps. Is it cycling?` } };
      }
      const flaw = check(frame);
      if (flaw) return { frames, problem: { kind: "error", message: `Step ${frames.length + 1} can't be shown: ${flaw}.` } };
      frames.push(structuredClone(frame));
    }
  } catch (error) {
    if (error instanceof NotImplementedError) return { frames, problem: { kind: "todo", message: error.message } };
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { frames, problem: { kind: "error", message: `Threw after ${frames.length} steps. ${message}` } };
  }
  return { frames };
}

const isNumbers = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((v) => typeof v === "number");

/** What stops a Gauss frame from being drawn, for a system with this many rows and columns. */
export function gaussFrameFlaw(frame: GaussFrame, rows: number, cols: number): string | null {
  const matrix = frame?.matrix;
  if (!Array.isArray(matrix) || matrix.length !== rows || !matrix.every((row) => isNumbers(row, cols))) {
    return `matrix must be ${rows} rows of ${cols} numbers`;
  }
  const op = frame.op;
  const used = !op ? [] : op.kind === "swap" ? [op.a, op.b] : op.kind === "scale" ? [op.row] : [op.target, op.source];
  if (used.some((row) => !Number.isInteger(row) || row < 0 || row >= rows)) return "op refers to a row that doesn't exist";
  return null;
}

/** What stops a simplex frame from being drawn. */
export function simplexFrameFlaw(frame: SimplexFrame): string | null {
  const d = frame?.dictionary;
  if (!d || !Array.isArray(d.basic) || !Array.isArray(d.nonbasic)) return "dictionary needs basic and nonbasic";
  const [rows, cols] = [d.basic.length, d.nonbasic.length];
  if (!isNumbers(d.basic, rows) || !isNumbers(d.nonbasic, cols)) return "basic and nonbasic must hold variable numbers";
  if (!isNumbers(d.b, rows)) return `b must have ${rows} numbers, one per basic variable`;
  if (!Array.isArray(d.a) || d.a.length !== rows || !d.a.every((row) => isNumbers(row, cols))) {
    return `a must be ${rows} rows of ${cols} numbers`;
  }
  if (!isNumbers(d.c, cols)) return `c must have ${cols} numbers, one per nonbasic variable`;
  if (typeof d.z !== "number") return "z must be a number";
  return null;
}
