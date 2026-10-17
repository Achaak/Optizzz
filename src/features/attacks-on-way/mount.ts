import { gameAttackText, readAttackLines, type AttackLine } from "@/features/flood/attacks";
import { readTroops, unitLabel } from "@/game/army/units";
import { formatNumber } from "@/utils/number-format";
import { ON_WAY_STYLE, renderOnWayList, span, type Copy } from "@/utils/on-way-list";

const LIST_CLASS = "optizzz-attacks";

export const ATTACKS_STYLE = `
.optizzz-attacks-place { font-weight: bold; white-space: nowrap; }
.optizzz-attacks-troops { font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
${ON_WAY_STYLE}`;

/** « 1 488 JSN, 485 SN, 29 NE », as the game abbreviates; the game's words when a unit is not recognised. */
function shortTroops(troops: string): string {
  const list = troops.replace(/^Troupes en attaques\s*:\s*/, "");
  const read = Object.entries(readTroops(list));
  if (read.length !== list.split(",").length) return list;
  return read.map(([key, count]) => `${formatNumber(count)} ${unitLabel(key)}`).join(", ");
}

function details(doc: Document, attack: AttackLine): Node[] {
  const nodes: Node[] = [];
  if (attack.place) nodes.push(span(doc, "optizzz-attacks-place", attack.place));
  if (attack.troops) {
    const troops = span(doc, "optizzz-attacks-troops", shortTroops(attack.troops));
    troops.title = attack.troops;
    nodes.push(troops);
  }
  return nodes;
}

/**
 * The attacks on their way on Armee.php or the attack form: the game's lines give way to a list with a live countdown, the arrival
 * time, the place and troops (Compte+), the game's « Annuler » link while it is offered, and a button that copies each
 * attack as the game writes it. The game's lines
 * stay in the page, folded away (read as the game wrote them). Returns a function that stops the countdown.
 */
export function renderAttacksOnWay(doc: Document, clock: () => Date, copy: Copy): () => void {
  const attacks = readAttackLines(doc, clock());
  const title = [...doc.querySelectorAll("#centre h3")].find((h3) => h3.textContent.includes("Attaque(s) en cours"));
  if (attacks.length === 0 || !title || doc.querySelector(`.${LIST_CLASS}`)) return () => undefined;

  const { list, stop } = renderOnWayList(
    doc,
    LIST_CLASS,
    attacks.map((attack) => ({
      to: attack.targetElement?.cloneNode(true) ?? doc.createTextNode(attack.target),
      details: details(doc, attack),
      arrivesAt: attack.arrivesAt,
      notes: [],
      message: () => gameAttackText(attack),
      copyTitle: "Copier cette attaque telle que le jeu l'écrit",
      cancel: attack.cancel,
    })),
    clock,
    copy,
  );

  // Everything the game writes for its attacks, up to the next block: text, spans, scripts, line breaks, notes.
  const folded = doc.createElement("div");
  folded.className = "optizzz-attacks-game";
  folded.hidden = true;
  while (title.nextSibling) {
    const node = title.nextSibling;
    if (node instanceof Element && !["SPAN", "SCRIPT", "BR", "SMALL"].includes(node.tagName)) break;
    folded.append(node);
  }
  title.after(list, folded);
  return stop;
}
