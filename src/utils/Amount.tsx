import { formatAmount, formatNumber, isCompacted } from "./number-format";

/** A quantity to read (`formatAmount`); shortened, it gives the exact number on hover. */
export function Amount({ value }: { value: number }) {
  const text = formatAmount(value);
  return isCompacted(value) ? <span title={formatNumber(value)}>{text}</span> : text;
}
