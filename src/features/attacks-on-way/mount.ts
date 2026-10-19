import {
  gameAttackText,
  gameReinforcementText,
  readAttackLines,
  readReinforcementLines,
  troopList,
  type AttackLine,
  type ReinforcementLine,
} from "@/features/flood/attacks";
import { readTroops, unitLabel } from "@/game/army/units";
import { formatAmount } from "@/utils/number-format";
import { ON_WAY_STYLE, renderOnWayList, span, type Copy, type OnWayItem } from "@/utils/on-way-list";

const LIST_CLASS = "optizzz-attacks";

export const ATTACKS_STYLE = `
.optizzz-attacks-place { font-weight: bold; white-space: nowrap; }
.optizzz-attacks-troops { font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
${ON_WAY_STYLE}`;

/** « 1 488 JSN, 485 SN, 29 NE », as the game abbreviates; the game's words when a unit is not recognised. */
function shortTroops(troops: string): string {
  const list = troopList(troops);
  const read = Object.entries(readTroops(list));
  if (read.length !== list.split(",").length) return list;
  return read.map(([key, count]) => `${formatAmount(count)} ${unitLabel(key)}`).join(", ");
}

function details(doc: Document, place: string | null, troops: string | null): Node[] {
  const nodes: Node[] = [];
  if (place) nodes.push(span(doc, "optizzz-attacks-place", place));
  if (troops) {
    const element = span(doc, "optizzz-attacks-troops", shortTroops(troops));
    element.title = troops;
    nodes.push(element);
  }
  return nodes;
}

function attackItem(doc: Document, attack: AttackLine): OnWayItem {
  return {
    to: attack.targetElement?.cloneNode(true) ?? doc.createTextNode(attack.target),
    details: details(doc, attack.place, attack.troops),
    arrivesAt: attack.arrivesAt,
    notes: [],
    message: () => gameAttackText(attack),
    copyTitle: "Copier cette attaque telle que le jeu l'écrit",
    cancel: attack.cancel,
  };
}

/** Troops coming home, « Des renforts arrivent » for the game: the army of a colony called back or freed. */
function reinforcementItem(doc: Document, line: ReinforcementLine): OnWayItem {
  return {
    to: doc.createTextNode("Renforts"),
    returning: true,
    // Without Compte+, the game does not write the troops.
    details: line.troops
      ? [span(doc, "optizzz-attacks-place", "d'une colonie"), ...details(doc, null, line.troops)]
      : [span(doc, "optizzz-attacks-troops", "votre armée qui rentre (d'une colonie)")],
    arrivesAt: line.arrivesAt,
    notes: [],
    message: () => gameReinforcementText(line),
    copyTitle: "Copier ce retour tel que le jeu l'écrit",
  };
}

/**
 * The attacks on their way on Armee.php or the attack form, and the troops coming home: the game's lines give way to
 * a list with a live countdown, the arrival time, the place and troops (Compte+), the game's « Annuler » link while it
 * is offered, and a button that copies each line as the game writes it. The game's lines stay in the page, folded
 * away (read as the game wrote them). Returns a function that stops the countdown.
 */
export function renderAttacksOnWay(doc: Document, clock: () => Date, copy: Copy): () => void {
  const now = clock();
  const attacks = readAttackLines(doc, now);
  const reinforcements = readReinforcementLines(doc, now);
  const title = [...doc.querySelectorAll("#centre h3")].find((h3) => h3.textContent.includes("Attaque(s) en cours"));
  const lines = [
    ...attacks.map((attack) => ({ countdown: attack.countdown, item: attackItem(doc, attack) })),
    ...reinforcements.map((line) => ({ countdown: line.countdown, item: reinforcementItem(doc, line) })),
  ].sort((a, b) => (a.countdown.compareDocumentPosition(b.countdown) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  if (lines.length === 0 || !title || doc.querySelector(`.${LIST_CLASS}`)) return () => undefined;

  const { list, stop } = renderOnWayList(
    doc,
    LIST_CLASS,
    lines.map((line) => line.item),
    clock,
    copy,
  );

  // The game's lines for the attacks listed above, folded away. A line Optizzz does not read stays where the game
  // wrote it, under the list.
  const folded = doc.createElement("div");
  folded.className = "optizzz-attacks-game";
  folded.hidden = true;
  const countdowns = new Set<Node>(lines.map((line) => line.countdown));
  for (const line of gameLines(title)) {
    if (line.some((node) => countdowns.has(node))) folded.append(...line);
  }
  title.after(list, folded);
  return stop;
}

/**
 * What the game writes under the title, up to the next block (text, spans, scripts, line breaks, notes), cut into its
 * lines: each one starts with the « - » that follows a line break (not the « - » before « Annuler »).
 */
function gameLines(title: Element): ChildNode[][] {
  const lines: ChildNode[][] = [];
  let afterBreak = true;
  for (let node = title.nextSibling; node; node = node.nextSibling) {
    if (node instanceof Element && !["SPAN", "SCRIPT", "BR", "SMALL"].includes(node.tagName)) break;
    const text = node.nodeType === Node.TEXT_NODE ? node.textContent?.trim() : null;
    if ((afterBreak && text?.startsWith("-")) || lines.length === 0) lines.push([]);
    lines.at(-1)?.push(node);
    if (node instanceof Element) afterBreak = node.tagName === "BR";
    else if (text) afterBreak = false;
  }
  return lines;
}
