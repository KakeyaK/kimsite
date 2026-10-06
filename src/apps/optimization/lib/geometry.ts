import { EPS } from "./format";
import type { LinearProgram } from "./types";

// Plane geometry for plotting a linear program with two variables. Nothing here solves it.

export type Point = { x: number; y: number };
/** The points with a·x + b·y ≤ c. */
export type HalfPlane = { a: number; b: number; c: number };
/** The visible part of the plane: [0, x] × [0, y]. */
export type View = { x: number; y: number };

export const halfPlanes = (lp: LinearProgram): HalfPlane[] => lp.A.map(([a, b], i) => ({ a, b, c: lp.b[i] }));

export function isFeasible(lp: LinearProgram, p: Point): boolean {
  return p.x >= -EPS && p.y >= -EPS && halfPlanes(lp).every((h) => h.a * p.x + h.b * p.y <= h.c + EPS);
}

/** Cuts a convex polygon with a half-plane (one round of Sutherland–Hodgman). */
export function clip(polygon: Point[], h: HalfPlane): Point[] {
  const excess = (p: Point) => h.a * p.x + h.b * p.y - h.c;
  const out: Point[] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    const [ep, eq] = [excess(p), excess(q)];
    if (ep <= EPS) out.push(p);
    if ((ep < -EPS && eq > EPS) || (ep > EPS && eq < -EPS)) {
      const t = ep / (ep - eq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  });
  return out;
}

/** The feasible region inside the box [0, x] × [0, y]; empty when there is none. */
export function feasibleRegion(lp: LinearProgram, box: View): Point[] {
  const corners = [
    { x: 0, y: 0 },
    { x: box.x, y: 0 },
    { x: box.x, y: box.y },
    { x: 0, y: box.y },
  ];
  return halfPlanes(lp).reduce(clip, corners);
}

/** The part of the line a·x + b·y = c that falls inside the view, if any. */
export function lineInView(h: HalfPlane, view: View): [Point, Point] | null {
  const norm = h.a * h.a + h.b * h.b;
  if (norm < EPS) return null;
  // A point on the line, and its direction; then Liang–Barsky against the four edges
  const p = { x: (h.a * h.c) / norm, y: (h.b * h.c) / norm };
  const d = { x: -h.b, y: h.a };
  let [t0, t1] = [-Infinity, Infinity];
  for (const [delta, low, high] of [
    [d.x, 0 - p.x, view.x - p.x],
    [d.y, 0 - p.y, view.y - p.y],
  ]) {
    if (Math.abs(delta) < EPS) {
      if (low > EPS || high < -EPS) return null;
      continue;
    }
    const [near, far] = [low / delta, high / delta].sort((a, b) => a - b);
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
  }
  if (t1 - t0 < EPS) return null;
  return [
    { x: p.x + t0 * d.x, y: p.y + t0 * d.y },
    { x: p.x + t1 * d.x, y: p.y + t1 * d.y },
  ];
}

/** Where two lines cross. */
function intersection(g: HalfPlane, h: HalfPlane): Point | null {
  const det = g.a * h.b - g.b * h.a;
  if (Math.abs(det) < EPS) return null;
  return { x: (g.c * h.b - g.b * h.c) / det, y: (g.a * h.c - g.c * h.a) / det };
}

/**
 * How much of the plane to show: enough for the feasible region and for `extra` (the points an
 * algorithm visits). An unbounded or empty region has no corners to go by, so there the view
 * covers the places where the constraint lines cross each other and the axes.
 */
export function viewFor(lp: LinearProgram, extra: Point[] = []): View {
  const HUGE = 1e7;
  const region = feasibleRegion(lp, { x: HUGE, y: HUGE });
  const bounded = region.length > 0 && region.every((p) => p.x < HUGE / 2 && p.y < HUGE / 2);

  let points = region;
  if (!bounded) {
    const lines = [...halfPlanes(lp), { a: 1, b: 0, c: 0 }, { a: 0, b: 1, c: 0 }];
    points = lines
      .flatMap((g, i) => lines.slice(i + 1).map((h) => intersection(g, h)))
      .filter((p): p is Point => p !== null && p.x >= -EPS && p.y >= -EPS);
  }
  const base = {
    x: Math.max(...points.map((p) => p.x), 0) || 1,
    y: Math.max(...points.map((p) => p.y), 0) || 1,
  };
  // A broken algorithm may wander off anywhere; don't let it squash the picture
  const near = extra.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x <= 4 * base.x && p.y <= 4 * base.y);
  const margin = bounded ? 1.15 : 1.5;
  return {
    x: margin * Math.max(base.x, ...near.map((p) => p.x)),
    y: margin * Math.max(base.y, ...near.map((p) => p.y)),
  };
}

/** Round tick positions from 0 up to `max`, about `count` of them. */
export function ticks(max: number, count = 5): number[] {
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = power * ([1, 2, 5, 10].find((m) => m * power >= rough) ?? 10);
  const out: number[] = [];
  for (let i = 0; i * step <= max + EPS; i++) out.push(Number((i * step).toPrecision(12)));
  return out;
}
