// What ends when, read on the pages that list it. Structures in docs/research/fourmizzz-pages.md.
import { formatNumber } from "@optizzz/game/format/number-format";
import { readConvoysOnWay } from "@/features/convoy/convoy";
import { readHunts } from "@optizzz/game/pages/resources";
import { readWorkQueue } from "@optizzz/game/pages/work-queue";
import { readCountdowns } from "@/features/end-times/countdowns";
import { readAttacksOnWay } from "@/features/flood/attacks";

export type EndKind = "hunt" | "laying" | "construction" | "research" | "convoy" | "attack";

/** « Attaque → Cible_1 »: the notifications read the target back after it. */
export const ATTACK_LABEL = "Attaque → ";

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
  attack: "/Armee.php",
};

/** The page of `kind`, or the attack form, which lists the attacks on their way like Armee.php. */
export function sourceOf(pathname: string, search = ""): EndKind | null {
  if (pathname.toLowerCase() === "/ennemie.php" && /[?&]Attaquer=/i.test(search)) return "attack";
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
        label: `Convoi ${convoy.incoming ? "←" : "→"} ${convoy.player}`,
        endsAt: convoy.arrivesAt,
      }));
    case "attack":
      return readAttacksOnWay(doc, now).map((attack) => ({
        label: `${ATTACK_LABEL}${attack.target}`,
        endsAt: attack.arrivesAt,
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
