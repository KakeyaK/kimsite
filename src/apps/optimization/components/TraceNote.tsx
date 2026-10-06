import type { Trace } from "@apps/optimization/lib/trace";
import { cn } from "@lib/utils";

/** Says why a run produced nothing, or stopped early. Renders nothing for a clean run. */
export function TraceNote({ trace, file }: { trace: Trace<unknown>; file: string }) {
  const problem = trace.problem;
  if (!problem) return null;
  const todo = problem.kind === "todo";
  return (
    <p
      role="status"
      class={cn(
        "rounded-lg border px-3 py-2 text-sm",
        todo
          ? "border-black/15 text-black/75 dark:border-white/20 dark:text-white/75"
          : "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
      )}
    >
      {todo ? (
        <>
          Nothing to animate yet: {problem.message}. Write it in <code class="font-mono">{file}</code>.
        </>
      ) : (
        problem.message
      )}
    </p>
  );
}
