// The rows of construction.php and laboratoire.php with what each next level is missing. Structure of the pages:
// docs/research/fourmizzz-pages.md.
import type { LevelRow, Requirement } from "../requirements";
import { readTimedRows } from "./resources";

/** What a row's next level is missing: « Requis : Laboratoire niveau 10 » (the phone layout may repeat it). */
function readRequirements(description: Element): Requirement[] {
  const found = new Map<string, number>();
  for (const missing of description.querySelectorAll(".verificationNonOK")) {
    const match = /^(.+?)\s+niveau\s+(\d+)/i.exec(missing.textContent.replace(/\s+/g, " ").trim());
    if (match?.[1] && match[2]) found.set(match[1], Math.max(found.get(match[1]) ?? 0, Number(match[2])));
  }
  return [...found].map(([name, level]) => ({ name, level }));
}

/** The rows of the given pages, with what each is missing, and where to put a line. */
export function readLevelRows(docs: readonly Document[]): (LevelRow & { description: Element })[] {
  return docs.flatMap((doc) =>
    readTimedRows(doc).map(({ name, level, cost, description }) => ({
      name,
      level,
      cost,
      description,
      requirements: readRequirements(description),
    })),
  );
}
