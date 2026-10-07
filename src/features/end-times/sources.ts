// What ends when, read on the pages that list it. Structures in docs/research/fourmizzz-pages.md.
import { formatNumber } from "@/utils/number-format";
import { readConvoysOnWay } from "../convoy/convoy";
import { readHunts } from "../resource-forecast/pages";
import { readWorkQueue } from "../work-queue/queue";
import { readCountdowns } from "./countdowns";

export type EndKind = "hunt" | "laying" | "construction" | "research" | "convoy";

export interface EndItem {
  label: string;
  endsAt: Date;
}

/** Everything of one kind, as read on its page at `readAt`. */
export interface Section {
  kind: EndKind;
  readAt: Date;
  items: EndItem[];
}

export const SOURCE_PAGES: Record<EndKind, string> = {
  hunt: "/Ressources.php",
  laying: "/Reine.php",
  construction: "/construction.php",
  research: "/laboratoire.php",
  convoy: "/commerce.php",
};

export function sourceOf(pathname: string): EndKind | null {
  const kinds = Object.keys(SOURCE_PAGES) as EndKind[];
  return kinds.find((kind) => SOURCE_PAGES[kind].toLowerCase() === pathname.toLowerCase()) ?? null;
}

/** The section listed on the page of `kind`, or null when the page is not a logged-in game page. */
export function readSection(doc: Document, kind: EndKind, now: Date): Section | null {
  if (!doc.querySelector("#data")) return null;
  return { kind, readAt: now, items: readItems(doc, kind, now) };
}

function readItems(doc: Document, kind: EndKind, now: Date): EndItem[] {
  switch (kind) {
    case "hunt":
      return readHunts(doc, now).map((hunt) => ({
        label: `Chasse ${formatNumber(hunt.fieldGain)} cm²`,
        endsAt: hunt.returnsAt,
      }));
    case "laying":
      return readLayings(doc, now);
    case "convoy":
      return readConvoysOnWay(doc, now).map((convoy) => ({
        label: `Convoi → ${convoy.recipient}`,
        endsAt: convoy.arrivesAt,
      }));
    case "construction":
    case "research":
      return readWorkQueue(doc, now).items.map((item) => ({
        label: `${item.name} ${String(item.targetLevel)}`,
        endsAt: item.endsAt,
      }));
  }
}

/** Rows of « Pontes en cours »: units in the first cell, the cumulated time left in a `ponte_<n>` countdown. */
function readLayings(doc: Document, now: Date): EndItem[] {
  const seconds = new Map(readCountdowns(doc).map((countdown) => [countdown.id, countdown.seconds]));
  const items: EndItem[] = [];
  for (const countdown of doc.querySelectorAll('span[id^="ponte_"]')) {
    const left = seconds.get(countdown.id);
    const units = countdown.closest("tr")?.querySelector("td")?.textContent.replace(/\s+/g, " ").trim();
    if (left !== undefined && units) items.push({ label: units, endsAt: new Date(now.getTime() + left * 1000) });
  }
  return items;
}
