import "@apps/optimization/styles.css";
import { SIMPLEX_EXAMPLES } from "@apps/optimization/lib/examples";
import { LpPlot } from "./LpPlot";

const lp = SIMPLEX_EXAMPLES[0].value;
/** The vertices a simplex run visits on that example, written down by hand: a still picture, nothing is solved here. */
const path = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 3, y: 1.5 },
];

/** The plot as a thumbnail for the sandbox card: no controls, fills the whole frame. */
export default function Preview() {
  return <LpPlot lp={lp} path={path} index={path.length - 1} active={[3, 4]} class="h-screen w-full p-4" />;
}
