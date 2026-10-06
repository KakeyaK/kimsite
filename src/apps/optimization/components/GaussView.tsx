import { useMemo, useState } from "preact/hooks";
import { gauss } from "@apps/optimization/algorithms/gauss";
import { GAUSS_EXAMPLES } from "@apps/optimization/lib/examples";
import { formatNumber, isZero, termParts, varName } from "@apps/optimization/lib/format";
import { collect, gaussFrameFlaw } from "@apps/optimization/lib/trace";
import type { GaussFrame, Matrix, RowOp } from "@apps/optimization/lib/types";
import { cn } from "@lib/utils";
import { ExamplePicker, NumberInput } from "./inputs";
import { PlayerControls, usePlayer } from "./Player";
import { TraceNote } from "./TraceNote";
import { btn, btnActive, card, label, math } from "./ui";

const MAX_SIZE = 6;
/** Height of one equation, in rem. Rows slide by multiples of it when they swap. */
const ROW_REM = 2.5;

const rowName = (row: number) => `R${row + 1}`;

/** "R2 ← R2 − 3 · R1" */
function describeOp(op: RowOp): string {
  if (op.kind === "swap") return `${rowName(op.a)} ↔ ${rowName(op.b)}`;
  if (op.kind === "scale") return `${rowName(op.row)} ← ${formatNumber(op.factor)} · ${rowName(op.row)}`;
  const { sign, magnitude } = termParts(op.factor);
  return `${rowName(op.target)} ← ${rowName(op.target)} ${sign} ${magnitude && `${magnitude} · `}${rowName(op.source)}`;
}

/**
 * Which original row sits at each position, frame by frame. Lets a row keep its element across
 * a swap, so it slides to its new place instead of having its numbers replaced.
 */
function rowOrders(frames: GaussFrame[]): number[][] {
  const orders: number[][] = [];
  frames.forEach((frame, i) => {
    const order = i === 0 ? frame.matrix.map((_, row) => row) : [...orders[i - 1]];
    if (frame.op?.kind === "swap") [order[frame.op.a], order[frame.op.b]] = [order[frame.op.b], order[frame.op.a]];
    orders.push(order);
  });
  return orders;
}

/** One coefficient, as a term of an equation ("− 3x₂") or as a matrix entry ("−3"). */
function coefficientText(row: number[], col: number, asMatrix: boolean): string {
  const value = row[col];
  const unknowns = row.length - 1;
  if (asMatrix || col === unknowns) return formatNumber(value);
  if (isZero(value)) {
    // A vanished term leaves a gap; a row with nothing left reads "0 = ..."
    return col === unknowns - 1 && row.slice(0, unknowns).every(isZero) ? "0" : "";
  }
  const { sign, magnitude } = termParts(value);
  const first = row.slice(0, col).every(isZero);
  return `${first ? (value < 0 ? sign : "") : `${sign} `}${magnitude}${varName(col + 1)}`;
}

function SystemAnimation({ frames, index, asMatrix }: { frames: GaussFrame[]; index: number; asMatrix: boolean }) {
  const orders = useMemo(() => rowOrders(frames), [frames]);
  const { matrix, op, pivot } = frames[index];
  const previous = frames[index - 1]?.matrix;
  const unknowns = matrix[0].length - 1;

  const changed = op?.kind === "add" ? [op.target] : op?.kind === "scale" ? [op.row] : [];
  const involved = op?.kind === "add" ? [op.source] : op?.kind === "swap" ? [op.a, op.b] : [];
  const opRow = op?.kind === "add" ? op.target : op?.kind === "scale" ? op.row : op?.a;

  const columns = `repeat(${unknowns}, ${asMatrix ? 4 : 5.5}rem) ${asMatrix ? "" : "1.5rem "}4.5rem 13rem`;
  // Listed by identity, not position: the DOM order never changes, only each row's offset
  const positions = orders[index].map((id, position) => ({ id, position })).sort((a, b) => a.id - b.id);

  return (
    <div class="overflow-x-auto">
      <div class={cn("flex w-max", math)}>
        <div class="text-black/40 dark:text-white/40">
          {matrix.map((_, row) => (
            <div key={row} class="flex w-10 items-center" style={{ height: `${ROW_REM}rem` }}>
              {rowName(row)}
            </div>
          ))}
        </div>
        <div>
          {positions.map(({ id, position }) => (
            <div
              key={id}
              class={cn(
                "opt-move grid items-center rounded",
                changed.includes(position) && "bg-amber-500/15",
                involved.includes(position) && "bg-sky-500/15",
              )}
              style={{
                gridTemplateColumns: columns,
                height: `${ROW_REM}rem`,
                transform: `translateY(${(position - id) * ROW_REM}rem)`,
              }}
            >
              {matrix[position].map((value, col) => {
                const text = coefficientText(matrix[position], col, asMatrix);
                const isNew = changed.includes(position) && previous !== undefined && !isZero(previous[position][col] - value);
                return (
                  <>
                    {col === unknowns && !asMatrix && <span class="text-center">=</span>}
                    <span
                      class={cn(
                        "px-1.5 text-right",
                        col === unknowns && asMatrix && "border-l border-black/30 dark:border-white/40",
                        pivot?.row === position && pivot.col === col && "rounded ring-2 ring-inset ring-sky-500",
                      )}
                    >
                      {/* Remounted on every step that changes it, which restarts the flash */}
                      <span key={isNew ? index : "same"} class={cn("px-0.5", isNew && "opt-flash")}>
                        {text}
                      </span>
                    </span>
                  </>
                );
              })}
              <span class="pl-4 font-sans text-black/60 dark:text-white/60">{position === opRow && op && describeOp(op)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SystemEditor({ matrix, onChange }: { matrix: Matrix; onChange: (matrix: Matrix) => void }) {
  const rows = matrix.length;
  const unknowns = matrix[0].length - 1;

  const setCell = (row: number, col: number, value: number) =>
    onChange(matrix.map((r, i) => (i === row ? r.map((v, j) => (j === col ? value : v)) : r)));
  /** Grows or shrinks the system, padding with zeros and keeping the right-hand side last. */
  const resize = (nextRows: number, nextUnknowns: number) =>
    onChange(
      Array.from({ length: nextRows }, (_, i) => [
        ...Array.from({ length: nextUnknowns }, (_, j) => (j < unknowns ? (matrix[i]?.[j] ?? 0) : 0)),
        matrix[i]?.[unknowns] ?? 0,
      ]),
    );

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class={label}>System</span>
        <ExamplePicker examples={GAUSS_EXAMPLES} onPick={onChange} />
        <span class="flex-1" />
        <button type="button" class={btn} disabled={rows <= 1} onClick={() => resize(rows - 1, unknowns)}>
          − equation
        </button>
        <button type="button" class={btn} disabled={rows >= MAX_SIZE} onClick={() => resize(rows + 1, unknowns)}>
          + equation
        </button>
        <button type="button" class={btn} disabled={unknowns <= 1} onClick={() => resize(rows, unknowns - 1)}>
          − unknown
        </button>
        <button type="button" class={btn} disabled={unknowns >= MAX_SIZE} onClick={() => resize(rows, unknowns + 1)}>
          + unknown
        </button>
      </div>
      <div class="overflow-x-auto">
        <div class={cn("w-max space-y-1.5", math)}>
          {matrix.map((row, i) => (
            <div key={i} class="flex items-center gap-1.5">
              {row.map((value, j) => (
                <>
                  {j > 0 && <span>{j === unknowns ? "=" : "+"}</span>}
                  <NumberInput
                    key={j === unknowns ? "rhs" : j}
                    value={value}
                    onChange={(next) => setCell(i, j, next)}
                    label={j === unknowns ? `Right-hand side of equation ${i + 1}` : `Coefficient of ${varName(j + 1)} in equation ${i + 1}`}
                  />
                  {j < unknowns && <span>{varName(j + 1)}</span>}
                </>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GaussView() {
  const [matrix, setMatrix] = useState<Matrix>(() => structuredClone(GAUSS_EXAMPLES[0].value));
  const [asMatrix, setAsMatrix] = useState(false);

  const trace = useMemo(
    () => collect(() => gauss(structuredClone(matrix)), (frame) => gaussFrameFlaw(frame, matrix.length, matrix[0].length)),
    [matrix],
  );
  // The untouched system first, then one frame per row operation
  const frames = useMemo<GaussFrame[]>(() => [{ matrix }, ...trace.frames], [matrix, trace]);
  const player = usePlayer(frames.length, frames);
  const frame = frames[player.index];

  return (
    <div class="space-y-4">
      <div class={card}>
        <SystemEditor matrix={matrix} onChange={setMatrix} />
      </div>
      <TraceNote trace={trace} file="src/apps/optimization/algorithms/gauss.ts" />
      <div class={cn(card, "space-y-4")}>
        <div class="flex flex-wrap items-center gap-2">
          <span class={label}>Elimination</span>
          <span class="flex-1" />
          <button type="button" class={cn(btn, !asMatrix && btnActive)} aria-pressed={!asMatrix} onClick={() => setAsMatrix(false)}>
            Equations
          </button>
          <button type="button" class={cn(btn, asMatrix && btnActive)} aria-pressed={asMatrix} onClick={() => setAsMatrix(true)}>
            Matrix
          </button>
        </div>
        <SystemAnimation frames={frames} index={player.index} asMatrix={asMatrix} />
        <p class="min-h-5 text-sm">{frame.note}</p>
        <PlayerControls player={player} />
      </div>
    </div>
  );
}
