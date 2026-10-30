/**
 * The SVG path of a small curve through `values`, in a `width` × `height` box with `pad` above and below: the
 * lowest value at the bottom, the highest at the top, a flat line in the middle when they are all equal.
 */
export function sparklinePath(values: readonly number[], width: number, height: number, pad = 2): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const y = (value: number) =>
    max === min ? height / 2 : pad + (height - 2 * pad) * (1 - (value - min) / (max - min));
  const round = (n: number) => Math.round(n * 10) / 10;
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${String(round(index * step))} ${String(round(y(value)))}`)
    .join(" ");
}
