import { useMemo } from "preact/hooks";
import { varName } from "@apps/optimization/lib/format";
import { feasibleRegion, halfPlanes, isFeasible, lineInView, ticks, viewFor, type Point } from "@apps/optimization/lib/geometry";
import type { LinearProgram } from "@apps/optimization/lib/types";
import { cn } from "@lib/utils";

// Drawing area, in SVG units
const [WIDTH, HEIGHT] = [480, 400];
const PAD = { left: 40, right: 16, top: 16, bottom: 32 };

const LINE = "stroke-black/40 dark:stroke-white/50";
const LINE_ENTERING = "stroke-emerald-600 dark:stroke-emerald-400";
const LINE_LEAVING = "stroke-rose-600 dark:stroke-rose-400";
const LINE_ACTIVE = "stroke-black dark:stroke-white";

type Props = {
  /** A program with two variables. */
  lp: LinearProgram;
  /** Every point the run goes through, in order. Sets how much of the plane is shown. */
  path?: Point[];
  /** How far along `path` the run is; the path is drawn up to here and the marker sits on it. */
  index?: number;
  /** Variables that are zero at the current point (the nonbasic ones): their lines are emphasised. */
  active?: number[];
  entering?: number;
  leaving?: number;
  class?: string;
};

/**
 * The feasible region of a two-variable program, its constraint lines, and a run walking over it.
 * Each line is where one variable is zero: the axes for x₁ and x₂, a constraint's line for its slack.
 */
export function LpPlot({ lp, path = [], index = 0, active = [], entering, leaving, class: className }: Props) {
  const view = useMemo(() => viewFor(lp, path), [lp, path]);
  const sx = (WIDTH - PAD.left - PAD.right) / view.x;
  const sy = (HEIGHT - PAD.top - PAD.bottom) / view.y;
  const px = (p: Point) => ({ x: PAD.left + p.x * sx, y: HEIGHT - PAD.bottom - p.y * sy });
  const points = (ps: Point[]) => ps.map((p) => `${px(p).x},${px(p).y}`).join(" ");

  const region = useMemo(() => feasibleRegion(lp, { x: 2 * view.x, y: 2 * view.y }), [lp, view]);
  const corner = px({ x: 0, y: 0 });
  const far = px(view);

  const lineClass = (variable: number) =>
    variable === entering ? LINE_ENTERING : variable === leaving ? LINE_LEAVING : active.includes(variable) ? LINE_ACTIVE : LINE;
  const lineWidth = (variable: number) => (variable === entering || variable === leaving || active.includes(variable) ? 2.5 : 1.25);

  const visited = path.slice(0, index + 1);
  const current = visited.at(-1);
  const before = visited.at(-2);
  // Level line of the objective through the current point, and the direction that improves it
  const [c1, c2] = lp.c;
  const gradient = Math.hypot(c1 * sx, c2 * sy);
  const up = gradient > 0 ? { x: (c1 * sx) / gradient, y: (-c2 * sy) / gradient } : null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} class={cn("select-none text-black dark:text-white", className)} role="img" aria-label="Feasible region and the path of the simplex method">
      <defs>
        <clipPath id="opt-plot-area">
          <rect x={corner.x} y={far.y} width={far.x - corner.x} height={corner.y - far.y} />
        </clipPath>
      </defs>

      {/* Ticks */}
      <g class="fill-current text-[11px] opacity-50" font-family="ui-monospace, monospace">
        {ticks(view.x).map((t) => (
          <text key={t} x={px({ x: t, y: 0 }).x} y={corner.y + 16} text-anchor="middle">
            {t}
          </text>
        ))}
        {ticks(view.y)
          .slice(1)
          .map((t) => (
            <text key={t} x={corner.x - 8} y={px({ x: 0, y: t }).y + 4} text-anchor="end">
              {t}
            </text>
          ))}
      </g>

      <g clip-path="url(#opt-plot-area)">
        {region.length > 2 && <polygon points={points(region)} class="fill-sky-500/20" />}

        {/* One line per constraint, named after its slack */}
        {halfPlanes(lp).map((h, i) => {
          const variable = lp.c.length + 1 + i;
          const segment = lineInView(h, view);
          if (!segment) return null;
          const [a, b] = segment.map(px);
          // Label near the end that is higher up, pulled inside the plot
          const [low, high] = a.y > b.y ? [a, b] : [b, a];
          const at = { x: high.x + 0.12 * (low.x - high.x), y: high.y + 0.12 * (low.y - high.y) };
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class={cn("transition-all duration-300", lineClass(variable))} stroke-width={lineWidth(variable)} />
              <text x={Math.min(at.x + 6, far.x - 44)} y={Math.max(at.y - 4, far.y + 12)} class="fill-current text-[11px]">
                {varName(variable)} = 0
              </text>
            </g>
          );
        })}

        {/* Objective level line, riding along with the marker */}
        {current && up && (
          <g class="opt-move" style={{ transform: `translate(${px(current).x}px, ${px(current).y}px)` }}>
            <line x1={-up.y * 2000} y1={up.x * 2000} x2={up.y * 2000} y2={-up.x * 2000} class="stroke-amber-500" stroke-width={1.25} stroke-dasharray="5 4" />
          </g>
        )}
      </g>

      {/* Axes: x₂ = 0 along the bottom, x₁ = 0 up the side */}
      <line x1={corner.x} y1={corner.y} x2={far.x} y2={corner.y} class={cn("transition-all duration-300", lineClass(2))} stroke-width={lineWidth(2)} />
      <line x1={corner.x} y1={corner.y} x2={corner.x} y2={far.y} class={cn("transition-all duration-300", lineClass(1))} stroke-width={lineWidth(1)} />
      <text x={far.x} y={corner.y + 28} text-anchor="end" class="fill-current text-xs">
        {varName(1)}
      </text>
      <text x={corner.x - 28} y={far.y + 4} class="fill-current text-xs">
        {varName(2)}
      </text>

      {/* The path so far; its last piece is drawn as the marker travels it */}
      {visited.length > 1 && <polyline points={points(visited.slice(0, -1))} class="fill-none stroke-current" stroke-width={2} />}
      {before && current && (
        <line key={index} pathLength={1} x1={px(before).x} y1={px(before).y} x2={px(current).x} y2={px(current).y} class="opt-draw stroke-current" stroke-width={2} />
      )}
      {visited.slice(0, -1).map((p, i) => (
        <circle key={i} cx={px(p).x} cy={px(p).y} r={3} class="fill-current" />
      ))}

      {current && (
        <g class="opt-move" style={{ transform: `translate(${px(current).x}px, ${px(current).y}px)` }}>
          {up && (
            <>
              <line x1={0} y1={0} x2={up.x * 30} y2={up.y * 30} class="stroke-amber-500" stroke-width={2} />
              <polygon
                points={`${up.x * 38},${up.y * 38} ${up.x * 28 - up.y * 5},${up.y * 28 + up.x * 5} ${up.x * 28 + up.y * 5},${up.y * 28 - up.x * 5}`}
                class="fill-amber-500"
              />
            </>
          )}
          {/* Hollow while outside the feasible region */}
          <circle r={6} stroke-width={2.5} class={isFeasible(lp, current) ? "fill-current stroke-current" : "fill-rose-500/30 stroke-rose-500"} />
        </g>
      )}
    </svg>
  );
}
