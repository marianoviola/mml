/**
 * Roadmap M5: the value of one input at which an output meets a target. The
 * model's monthly costs are monotone in distance, budget, price and life, so
 * bisection is enough; the function says when there is no crossing rather
 * than returning the nearest bound as if it were an answer.
 */
export interface BreakEvenOptions {
  /** Stop when the bracket is narrower than this, in the input's unit. */
  tolerance?: number;
  maxIterations?: number;
  /** Round the answer to this step, e.g. 500 km. */
  step?: number;
}

export function breakEven(
  evaluate: (input: number) => number,
  target: number,
  low: number,
  high: number,
  options: BreakEvenOptions = {},
): number | undefined {
  if (!(low < high)) throw new RangeError("break-even needs low < high");
  const tolerance = options.tolerance ?? Math.max(1e-6, (high - low) * 1e-4);
  const maxIterations = options.maxIterations ?? 100;
  let lowGap = evaluate(low) - target;
  let highGap = evaluate(high) - target;
  if (lowGap === 0) return finish(low, options.step);
  if (highGap === 0) return finish(high, options.step);
  if (Math.sign(lowGap) === Math.sign(highGap)) return undefined;

  let a = low;
  let b = high;
  for (let i = 0; i < maxIterations && b - a > tolerance; i++) {
    const mid = (a + b) / 2;
    const midGap = evaluate(mid) - target;
    if (midGap === 0) return finish(mid, options.step);
    if (Math.sign(midGap) === Math.sign(lowGap)) {
      a = mid;
      lowGap = midGap;
    } else {
      b = mid;
      highGap = midGap;
    }
  }
  return finish((a + b) / 2, options.step);
}

function finish(value: number, step?: number): number {
  return step ? Math.round(value / step) * step : value;
}
