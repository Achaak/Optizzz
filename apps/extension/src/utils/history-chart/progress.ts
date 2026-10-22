import type { Point } from "./chart-option";

export interface Progress {
  first: number;
  last: number;
  gain: number;
  /** Null when the first value is zero. */
  percent: number | null;
}

/** From the first point of the series to its last. */
export function periodProgress(series: readonly Point[]): Progress | null {
  const first = series[0]?.value;
  const last = series.at(-1)?.value;
  if (first === undefined || last === undefined) return null;
  const gain = last - first;
  return { first, last, gain, percent: first === 0 ? null : (gain / first) * 100 };
}
