import { useEffect, useState } from "preact/hooks";
import "@apps/optimization/styles.css";
import { simplex } from "@apps/optimization/algorithms/simplex";
import { twoPhase } from "@apps/optimization/algorithms/twoPhase";
import { initialDictionary } from "@apps/optimization/lib/dictionary";
import { SIMPLEX_EXAMPLES, TWO_PHASE_EXAMPLES } from "@apps/optimization/lib/examples";
import type { LinearProgram } from "@apps/optimization/lib/types";
import { cn } from "@lib/utils";
import { GaussView } from "./GaussView";
import { SimplexView } from "./SimplexView";
import { btn, btnActive } from "./ui";

const TABS = [
  { id: "gauss", name: "Gauss" },
  { id: "simplex", name: "Simplex" },
  { id: "two-phase", name: "Two-phase simplex" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const tabFromHash = (): TabId => TABS.find((tab) => `#${tab.id}` === location.hash)?.id ?? "gauss";

const simplexFromOrigin = (lp: LinearProgram) => simplex(initialDictionary(lp));

/** The whole app: one tab per algorithm, the open one kept in the URL's hash. */
export default function OptimizationLab() {
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);

  return (
    <div class="space-y-6">
      <nav class="flex flex-wrap gap-2" aria-label="Algorithms">
        {TABS.map(({ id, name }) => (
          <a key={id} href={`#${id}`} class={cn(btn, tab === id && btnActive)} aria-current={tab === id ? "page" : undefined}>
            {name}
          </a>
        ))}
      </nav>
      {tab === "gauss" && <GaussView />}
      {tab === "simplex" && (
        <SimplexView key="simplex" examples={SIMPLEX_EXAMPLES} run={simplexFromOrigin} file="src/apps/optimization/algorithms/simplex.ts" startsAtOrigin />
      )}
      {tab === "two-phase" && (
        <SimplexView key="two-phase" examples={TWO_PHASE_EXAMPLES} run={twoPhase} file="src/apps/optimization/algorithms/twoPhase.ts" />
      )}
    </div>
  );
}
