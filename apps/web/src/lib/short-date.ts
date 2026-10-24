const sameYear = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
const otherYear = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});
const yearOf = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "Europe/Paris" });

/** « 24 oct. », Paris day; with the year when it is not this one (« 3 janv. 2025 »): « Chrome, lié le 24 oct. ». */
export function shortDate(date: Date, now: Date): string {
  return (yearOf.format(date) === yearOf.format(now) ? sameYear : otherYear).format(date);
}
