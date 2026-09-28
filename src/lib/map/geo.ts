export type LonLat = [number, number];
/** [west, south, east, north] */
export type BBox = [number, number, number, number];

const RAD = Math.PI / 180;

export function bboxCenter([w, s, e, n]: BBox): LonLat {
  return [(w + e) / 2, (s + n) / 2];
}

/** Points along the great circle from a to b, with longitudes unwrapped so lines don't jump at ±180. */
export function greatCircle(a: LonLat, b: LonLat, steps = 64): LonLat[] {
  const [l1, p1] = [a[0] * RAD, a[1] * RAD];
  const [l2, p2] = [b[0] * RAD, b[1] * RAD];
  const d =
    2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (Math.sin(d) < 1e-9) return [a, b]; // same point or antipodal: no unique great circle

  const out: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD]);
  }
  for (let i = 1; i < out.length; i++) {
    while (out[i][0] - out[i - 1][0] > 180) out[i][0] -= 360;
    while (out[i][0] - out[i - 1][0] < -180) out[i][0] += 360;
  }
  return out;
}

/** Whole calendar days from `now` (local) to a YYYY-MM-DD date. */
export function daysUntil(date: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const target = new Date(Date.UTC(y, mo, d));
  if (target.getUTCMonth() !== mo || target.getUTCDate() !== d) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today) / 86_400_000);
}

/**
 * The point `f` (0–1) of the way along a line, and the heading there in degrees clockwise from
 * north. Meant for dense lines like `greatCircle` output, so each segment is treated as flat.
 */
export function alongLine(line: LonLat[], f: number): { point: LonLat; bearing: number } {
  const lengths = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
  let remaining = Math.min(Math.max(f, 0), 1) * lengths.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < lengths.length - 1 && remaining > lengths[i]) remaining -= lengths[i++];
  const [a, b] = [line[i], line[i + 1]];
  const t = lengths[i] ? Math.min(remaining / lengths[i], 1) : 0;
  const point: LonLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // East-west degrees shrink with latitude, so scale them before taking the angle.
  const east = (b[0] - a[0]) * Math.cos(point[1] * RAD);
  const bearing = (Math.atan2(east, b[1] - a[1]) / RAD + 360) % 360;
  return { point, bearing };
}
