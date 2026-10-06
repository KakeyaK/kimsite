import { useMemo, useState } from "preact/hooks";
import { initialDictionary, solutionOf, valueOf } from "@apps/optimization/lib/dictionary";
import type { Example } from "@apps/optimization/lib/examples";
import { formatNumber, varName } from "@apps/optimization/lib/format";
import { collect, simplexFrameFlaw } from "@apps/optimization/lib/trace";
import type { LinearProgram, SimplexFrame } from "@apps/optimization/lib/types";
import { cn } from "@lib/utils";
import { DictionaryView, ENTERING, LEAVING } from "./DictionaryView";
import { LpEditor } from "./LpEditor";
import { LpPlot } from "./LpPlot";
import { PlayerControls, usePlayer } from "./Player";
import { TraceNote } from "./TraceNote";
import { card, label } from "./ui";

const STATUS: Record<NonNullable<SimplexFrame["status"]>, string> = {
  optimal: "Optimal",
  unbounded: "Unbounded",
  infeasible: "Infeasible",
};

/** What a step is about: its phase, the pivot it is about to make, how the run ended. */
function Caption({ frame }: { frame: SimplexFrame }) {
  const { entering, leaving, phase, status, note } = frame;
  return (
    <div class="min-h-12 space-y-1 text-sm">
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
        {phase && <span class="rounded border border-black/15 px-1.5 dark:border-white/20">{phase === 1 ? "Phase 1 · auxiliary problem" : "Phase 2"}</span>}
        {entering !== undefined && (
          <span>
            <span class={cn("font-mono", ENTERING.text)}>{varName(entering)}</span> enters
            {leaving !== undefined && (
              <>
                , <span class={cn("font-mono", LEAVING.text)}>{varName(leaving)}</span> leaves
              </>
            )}
          </span>
        )}
        {status && <span class="font-semibold text-black dark:text-white">{STATUS[status]}</span>}
      </p>
      {note && <p>{note}</p>}
    </div>
  );
}

type Props = {
  examples: Example<LinearProgram>[];
  /** The algorithm being shown. */
  run: (lp: LinearProgram) => Iterable<SimplexFrame>;
  /** Where that algorithm lives, for the "not written yet" note. */
  file: string;
  /** Set when `run` can only start from the origin: the view then warns about negative right-hand sides. */
  startsAtOrigin?: boolean;
};

/** A simplex run, step by step: the dictionary on one side, its vertex on the feasible region on the other. */
export function SimplexView({ examples, run, file, startsAtOrigin }: Props) {
  const [lp, setLp] = useState<LinearProgram>(() => structuredClone(examples[0].value));
  const n = lp.c.length;

  const trace = useMemo(() => collect(() => run(structuredClone(lp)), simplexFrameFlaw), [lp, run]);
  // With no algorithm yet there is still the dictionary everything starts from
  const frames = useMemo<SimplexFrame[]>(() => (trace.frames.length ? trace.frames : [{ dictionary: initialDictionary(lp) }]), [lp, trace]);
  const path = useMemo(() => frames.map((frame) => ({ x: valueOf(frame.dictionary, 1), y: valueOf(frame.dictionary, 2) })), [frames]);

  const player = usePlayer(frames.length, frames);
  const frame = frames[player.index];
  const d = frame.dictionary;
  const x = solutionOf(d, n);
  const hasAuxiliary = d.basic.includes(0) || d.nonbasic.includes(0);

  return (
    <div>
      <div class="grid items-start gap-4 lg:grid-cols-2">
        <div class="space-y-4">
          <div class={card}>
            <LpEditor lp={lp} onChange={setLp} examples={examples} />
          </div>
          {startsAtOrigin && lp.b.some((b) => b < 0) && (
            <p role="status" class="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              A right-hand side is negative, so the origin isn't feasible and this dictionary isn't a valid start. That case is what the two-phase tab is for.
            </p>
          )}
          <TraceNote trace={trace} file={file} />
          <div class={cn(card, "space-y-4")}>
            <span class={label}>Dictionary</span>
            <PlayerControls player={player} />
            <DictionaryView
              dictionary={d}
              previous={frames[player.index - 1]?.dictionary}
              step={player.index}
              entering={frame.entering}
              leaving={frame.leaving}
              objective={frame.phase === 1 ? "w" : "z"}
            />
            <Caption frame={frame} />
          </div>
        </div>
        {/* Stays in sight next to the dictionary while the page scrolls */}
        <div class={cn(card, "space-y-3 lg:sticky lg:top-20")}>
          <span class={label}>Feasible region</span>
          {n === 2 ? (
            <LpPlot lp={lp} path={path} index={player.index} active={d.nonbasic} entering={frame.entering} leaving={frame.leaving} class="w-full" />
          ) : (
            <p class="text-sm">The plot needs exactly two variables; this problem has {n}.</p>
          )}
          <p class="flex flex-wrap gap-x-4 font-mono text-sm text-black dark:text-white">
            <span>
              ({x.map((_, j) => varName(j + 1)).join(", ")}) = ({x.map(formatNumber).join(", ")})
            </span>
            <span>c·x = {formatNumber(x.reduce((sum, value, j) => sum + lp.c[j] * value, 0))}</span>
            {hasAuxiliary && (
              <span>
                {varName(0)} = {formatNumber(valueOf(d, 0))}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
