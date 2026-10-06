import { formatNumber, isZero, termParts, varName } from "@apps/optimization/lib/format";
import type { Dictionary } from "@apps/optimization/lib/types";
import { cn } from "@lib/utils";
import { math } from "./ui";

/** Colors shared with the plot: the entering variable's column and line, the leaving one's row and line. */
export const ENTERING = { cell: "bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300" };
export const LEAVING = { cell: "bg-rose-500/20", text: "text-rose-700 dark:text-rose-300" };

/** A value that flashes when it differs from the one shown at the previous step. */
function Value({ text, step, changed }: { text: string; step: number; changed: boolean }) {
  return (
    <span key={changed ? step : "same"} class={cn("px-0.5", changed && "opt-flash")}>
      {text}
    </span>
  );
}

type Props = {
  dictionary: Dictionary;
  /** The dictionary of the previous step, to tell which numbers changed. */
  previous?: Dictionary;
  step: number;
  entering?: number;
  leaving?: number;
  /** Name of the objective row: z, or w for an auxiliary problem. */
  objective: string;
};

/**
 * A dictionary written out as equations, one basic variable per line and the objective last:
 *
 *   x₃ = 5 − 2x₁ − 3x₂
 *   z  = 0 + 5x₁ + 4x₂
 */
export function DictionaryView({ dictionary: d, previous, step, entering, leaving, objective }: Props) {
  const enteringCol = entering === undefined ? -1 : d.nonbasic.indexOf(entering);
  const leavingRow = leaving === undefined ? -1 : d.basic.indexOf(leaving);
  // Numbers are compared by position; after a pivot nearly all of them are new anyway
  const comparable = previous !== undefined && previous.basic.length === d.basic.length && previous.nonbasic.length === d.nonbasic.length;

  const rows = [
    ...d.basic.map((variable, i) => ({ name: varName(variable), constant: d.b[i], coefficients: d.a[i], before: previous && { constant: previous.b[i], coefficients: previous.a[i] } })),
    { name: objective, constant: d.z, coefficients: d.c, before: previous && { constant: previous.z, coefficients: previous.c } },
  ];

  return (
    <div class="overflow-x-auto">
      <div
        class={cn("grid w-max items-center", math)}
        style={{ gridTemplateColumns: `3rem 1.5rem 4.5rem repeat(${d.nonbasic.length}, 5.5rem)` }}
      >
        {rows.map((row, i) => {
          const isObjective = i === d.basic.length;
          const rowClass = cn("flex h-10 items-center justify-end px-1.5", isObjective && "border-t border-black/30 dark:border-white/40", i === leavingRow && LEAVING.cell);
          return (
            <>
              <span class={cn(rowClass, "rounded-l", i === leavingRow && LEAVING.text)}>
                <Value text={row.name} step={step} changed={comparable && !isObjective && previous?.basic[i] !== d.basic[i]} />
              </span>
              <span class={cn(rowClass, "justify-center")}>=</span>
              <span class={rowClass}>
                <Value text={formatNumber(row.constant)} step={step} changed={comparable && !isZero(row.constant - (row.before?.constant ?? 0))} />
              </span>
              {row.coefficients.map((value, j) => {
                const { sign, magnitude } = termParts(value);
                const changed = comparable && (!isZero(value - (row.before?.coefficients[j] ?? 0)) || previous?.nonbasic[j] !== d.nonbasic[j]);
                return (
                  <span
                    class={cn(
                      rowClass,
                      j === enteringCol && ENTERING.cell,
                      j === enteringCol && i === leavingRow && "ring-2 ring-inset ring-black/60 dark:ring-white/70",
                      j === d.nonbasic.length - 1 && "rounded-r",
                    )}
                  >
                    {/* A zero term keeps its place, so columns stay aligned */}
                    <span class={cn(isZero(value) && "opacity-25")}>
                      <Value text={isZero(value) ? `+ 0${varName(d.nonbasic[j])}` : `${sign} ${magnitude}${varName(d.nonbasic[j])}`} step={step} changed={changed} />
                    </span>
                  </span>
                );
              })}
            </>
          );
        })}
      </div>
    </div>
  );
}
