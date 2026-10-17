// What Optizzz adds in the description of a row of construction.php or laboratoire.php, always in the same order,
// whichever feature draws first or redraws later.

/** First to last: when it can be paid, then the advice lines, then the advice block, then the next levels. */
const ORDER = [
  "optizzz-forecast",
  "optizzz-speed-up",
  "optizzz-laying-boost",
  "optizzz-advice",
  "optizzz-levels",
] as const;

export type RowExtra = (typeof ORDER)[number];

/** Puts `element` (of class `kind`) in `description`, replacing the previous one of that kind. */
export function placeInRow(description: Element, kind: RowExtra, element: Element): void {
  element.classList.add(kind);
  const rank = ORDER.indexOf(kind);
  for (const child of [...description.children]) {
    if (child !== element && child.classList.contains(kind)) child.remove();
  }
  const next = [...description.children].find((child) =>
    ORDER.slice(rank + 1).some((later) => child.classList.contains(later)),
  );
  if (next) next.before(element);
  else description.append(element);
}
