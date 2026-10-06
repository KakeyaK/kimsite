import type { Example } from "@apps/optimization/lib/examples";
import { varName } from "@apps/optimization/lib/format";
import type { LinearProgram } from "@apps/optimization/lib/types";
import { cn } from "@lib/utils";
import { ExamplePicker, NumberInput } from "./inputs";
import { btn, label, math } from "./ui";

const MAX_VARIABLES = 5;
const MAX_CONSTRAINTS = 6;

type Props = {
  lp: LinearProgram;
  onChange: (lp: LinearProgram) => void;
  examples: Example<LinearProgram>[];
};

/** Edits a program in standard form: maximize c·x subject to Ax ≤ b, x ≥ 0. */
export function LpEditor({ lp, onChange, examples }: Props) {
  const n = lp.c.length;
  const m = lp.b.length;
  const replace = (list: number[], at: number, value: number) => list.map((v, i) => (i === at ? value : v));

  /** Σ coefficient · variable, each coefficient editable. */
  const terms = (coefficients: number[], describe: (variable: string) => string, set: (j: number, value: number) => void) =>
    coefficients.map((value, j) => (
      <>
        {j > 0 && <span>+</span>}
        <NumberInput value={value} onChange={(next) => set(j, next)} label={describe(varName(j + 1))} />
        <span>{varName(j + 1)}</span>
      </>
    ));

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class={label}>Problem</span>
        <ExamplePicker examples={examples} onPick={onChange} />
        <span class="flex-1" />
        <button type="button" class={btn} disabled={m >= MAX_CONSTRAINTS} onClick={() => onChange({ ...lp, A: [...lp.A, lp.c.map(() => 0)], b: [...lp.b, 0] })}>
          + constraint
        </button>
        <button type="button" class={btn} disabled={n <= 2} onClick={() => onChange({ ...lp, c: lp.c.slice(0, -1), A: lp.A.map((row) => row.slice(0, -1)) })}>
          − variable
        </button>
        <button type="button" class={btn} disabled={n >= MAX_VARIABLES} onClick={() => onChange({ ...lp, c: [...lp.c, 0], A: lp.A.map((row) => [...row, 0]) })}>
          + variable
        </button>
      </div>
      <div class="overflow-x-auto">
        <div class={cn("grid w-max items-center gap-x-3 gap-y-1.5", math)} style={{ gridTemplateColumns: "auto auto" }}>
          <span class="font-sans text-black/60 dark:text-white/60">maximize</span>
          <div class="flex items-center gap-1.5">
            {terms(lp.c, (variable) => `Objective coefficient of ${variable}`, (j, value) => onChange({ ...lp, c: replace(lp.c, j, value) }))}
          </div>
          {lp.A.map((row, i) => (
            <>
              <span class="font-sans text-black/60 dark:text-white/60">{i === 0 && "subject to"}</span>
              <div class="flex items-center gap-1.5">
                {terms(row, (variable) => `Coefficient of ${variable} in constraint ${i + 1}`, (j, value) =>
                  onChange({ ...lp, A: lp.A.map((r, k) => (k === i ? replace(r, j, value) : r)) }),
                )}
                <span>≤</span>
                <NumberInput value={lp.b[i]} onChange={(value) => onChange({ ...lp, b: replace(lp.b, i, value) })} label={`Right-hand side of constraint ${i + 1}`} />
                <button
                  type="button"
                  class={cn(btn, "ml-1 font-sans")}
                  disabled={m <= 1}
                  aria-label={`Remove constraint ${i + 1}`}
                  onClick={() => onChange({ ...lp, A: lp.A.filter((_, k) => k !== i), b: lp.b.filter((_, k) => k !== i) })}
                >
                  ×
                </button>
              </div>
            </>
          ))}
          <span />
          <span>{lp.c.map((_, j) => varName(j + 1)).join(", ")} ≥ 0</span>
        </div>
      </div>
    </div>
  );
}
