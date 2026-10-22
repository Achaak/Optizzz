/**
 * A whole number as the game writes it: « 12 348 », « 1 199 cm² », « niveau 7 », « −2 397 ». The thousands
 * separators and any text around are dropped; a leading minus is kept. 0 when there is no digit.
 */
export function parseGameInteger(text: string | null | undefined): number {
  const value = text ?? "";
  const digits = value.replace(/\D/g, "");
  if (digits === "") return 0;
  return /^\s*[-−]\s*\d/.test(value) ? -Number(digits) : Number(digits);
}
