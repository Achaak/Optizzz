/** A whole number written like the game does, with a space between thousands: « 12 348 ». */
export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
