/** A whole number written like the game does, with a space between thousands: « 12 348 ». */
export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** A number with at most `fractionDigits` decimals, French style like the game: « 12 348,5 », « 18,4 », « 3 ». */
export function formatDecimal(value: number, fractionDigits = 1): string {
  const [whole = "0", fraction = ""] = Math.abs(value).toFixed(fractionDigits).split(".");
  const decimals = fraction.replace(/0+$/, "");
  const sign = value < 0 && (Number(whole) > 0 || decimals !== "") ? "-" : "";
  return `${sign}${formatNumber(Number(whole))}${decimals ? `,${decimals}` : ""}`;
}

const UNITS = [
  { size: 1e9, suffix: "G" },
  { size: 1e6, suffix: "M" },
  { size: 1e3, suffix: "K" },
];

/** From this value on, a compact number is shortened: « 9 999 » is as short as « 10K ». */
const COMPACT_FROM = 10_000;

/** A number with three significant digits and K, M or G from 10 000 on: « 12,3K », « 1,23M », « 4,51G »; « 9 999 » below. */
export function formatCompact(value: number): string {
  const whole = Math.round(Math.abs(value));
  if (whole < COMPACT_FROM) return formatNumber(value);
  const sign = value < 0 ? "-" : "";
  let index = UNITS.findIndex((unit) => whole >= unit.size);
  for (;;) {
    const { size, suffix } = UNITS[index] ?? { size: 1e3, suffix: "K" };
    const scaled = whole / size;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const rounded = Number(scaled.toFixed(digits));
    // 999 999 rounds to « 1000K »: the next unit writes it « 1M ».
    if (rounded >= 1000 && index > 0) {
      index -= 1;
      continue;
    }
    return `${sign}${formatDecimal(rounded, digits)}${suffix}`;
  }
}

// The player's « Nombres arrondis » switch for Optizzz's own views, set once by each content script and page.
let compactNumbers = false;

export function setCompactNumbers(enabled: boolean) {
  compactNumbers = enabled;
}

/** Whether `formatAmount` shortens this value: the exact one is then worth a tooltip. */
export function isCompacted(value: number): boolean {
  return compactNumbers && Math.round(Math.abs(value)) >= COMPACT_FROM;
}

/**
 * A quantity to read, not to type or copy: compact (`formatCompact`) when the player switched « Nombres arrondis »
 * on for Optizzz, whole (`formatNumber`) otherwise.
 */
export function formatAmount(value: number): string {
  return isCompacted(value) ? formatCompact(value) : formatNumber(value);
}
