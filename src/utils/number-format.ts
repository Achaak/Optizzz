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
