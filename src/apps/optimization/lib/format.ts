/** Tolerance for treating a floating-point result as zero. */
export const EPS = 1e-9;

export const isZero = (x: number) => Math.abs(x) < EPS;

const MINUS = "−";
const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/** "x₁", "x₁₂" */
export function varName(index: number): string {
  return "x" + [...String(index)].map((d) => SUBSCRIPTS[Number(d)] ?? d).join("");
}

/** The closest fraction with a small denominator, if `x` is (numerically) one. */
function toFraction(x: number, maxDenominator = 1000): [number, number] | null {
  // Continued fraction expansion: h/k are the successive convergents
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let rest = x;
  for (let i = 0; i < 20; i++) {
    const whole = Math.floor(rest);
    [h0, h1] = [h1, whole * h1 + h0];
    [k0, k1] = [k1, whole * k1 + k0];
    if (k1 > maxDenominator) return null;
    if (Math.abs(x - h1 / k1) <= EPS * Math.max(1, x)) return [h1, k1];
    rest = 1 / (rest - whole);
  }
  return null;
}

/** A non-negative number as "3", "5/2", or decimals when it isn't a simple fraction. */
function formatMagnitude(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  const fraction = toFraction(x);
  if (!fraction) return String(Number(x.toPrecision(4)));
  const [num, den] = fraction;
  return den === 1 ? String(num) : `${num}/${den}`;
}

/** A number as text, exact fractions where possible: "−5/2". */
export function formatNumber(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (isZero(x)) return "0";
  return (x < 0 ? MINUS : "") + formatMagnitude(Math.abs(x));
}

/** The pieces of a term such as "− 5/2 x₁": its sign and its coefficient without the sign ("" for 1). */
export function termParts(coefficient: number): { sign: "+" | "−"; magnitude: string } {
  const abs = Math.abs(coefficient);
  return { sign: coefficient < 0 ? MINUS : "+", magnitude: Math.abs(abs - 1) < EPS ? "" : formatMagnitude(abs) };
}

/** Reads "3", "-2.5" or "1/3"; null when the text isn't a number (yet). */
export function parseNumber(text: string): number | null {
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(?:\/\s*(\d+\.?\d*|\.\d+))?\s*$/.exec(text.replace(MINUS, "-"));
  if (!match) return null;
  const value = Number(match[1]) / (match[2] === undefined ? 1 : Number(match[2]));
  return Number.isFinite(value) ? value : null;
}
