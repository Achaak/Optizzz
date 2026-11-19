// A block under each locked unit of Reine.php, and under each row of construction.php or laboratoire.php whose next
// level waits for a requirement: the levels to reach, then what they cost and how long they take. See
// docs/features/cout-deblocage.md.
import type { UnlockCost, UnlockStep } from "@optizzz/game/requirements";
import { formatAmount, formatNumber, isCompacted } from "@optizzz/game/format/number-format";
import { formatDuration } from "@optizzz/game/format/time-format";
import { sameName } from "@optizzz/game/levels";
import { placeInRow } from "@/utils/row-extras";

export const UNLOCK_STYLE = `
.optizzz-unlock { margin-top: var(--optizzz-space-3); display: grid; grid-template-columns: auto 1fr; gap: var(--optizzz-space-2) var(--optizzz-space-3); align-items: baseline; }
.optizzz-unlock .optizzz-tag { grid-row: span 2; align-self: start; }
.optizzz-unlock-steps, .optizzz-unlock-cost { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--optizzz-space-1) var(--optizzz-space-5); }
.optizzz-unlock-nested { color: var(--optizzz-text-muted); }
.optizzz-unlock-amount { display: inline-flex; align-items: center; gap: var(--optizzz-space-2); white-space: nowrap; }
.optizzz-unlock-amount img { width: 16px; height: 16px; }`;

/** The game's own icons: the game look swaps them for sharper ones. */
const RESOURCES = [
  { key: "workers", label: "ouvrières", icon: "/images/icone/icone_ouvriere.png" },
  { key: "food", label: "nourriture", icon: "/images/icone/icone_pomme.png" },
  { key: "materials", label: "matériaux", icon: "/images/icone/icone_bois.png" },
] as const;
const TIME_ICON = "/images/icone/icone_sablier.gif";

const DAY = 86_400_000;
/** Up to 30 days as the other tools write it (« 2 j 5 h »), then in days, then in years. */
export function formatUnlockDuration(ms: number): string {
  if (ms <= 30 * DAY) return formatDuration(ms);
  const days = Math.ceil(ms / DAY);
  if (days < 2 * 365) return `${formatNumber(days)} j`;
  return `${formatNumber(Math.round(days / 365))} ans`;
}

const TIME_TITLE =
  "Temps : Construction et Laboratoire travaillent côte à côte, chacun un niveau à la fois, et un niveau commence " +
  "quand ceux qu'il demande sont finis. Les chantiers en cours ne sont pas comptés : à partir de files libres.";

const TITLE =
  "Optizzz : les niveaux manquants de chaque prérequis, et ceux de leurs propres prérequis, au coût que montrent " +
  "Construction et Laboratoire (bonus compris), doublé à chaque niveau. Chaque niveau de plus d'un prérequis demande " +
  "le sien un niveau plus haut. Un niveau en cours compte comme fait. Les niveaux de Laboratoire servent aussi aux " +
  "autres recherches : ils sont comptés en entier quand même.\n" +
  "« Au moins » : un prérequis n'a pas pu être chiffré.";

/**
 * « Acide 0 → 5 (Armes 7 → 10, Génétique 0 → 8) »: a requirement asked first, with those it needs in turn in brackets,
 * theirs nested the same way.
 */
function stepElement(doc: Document, step: UnlockStep, steps: readonly UnlockStep[], depth = 0): HTMLElement {
  const element = doc.createElement("span");
  element.className = depth === 0 ? "optizzz-unlock-step" : "optizzz-unlock-nested";
  const name = doc.createElement(depth === 0 ? "strong" : "span");
  name.textContent = step.name;
  element.append(name, `\u00a0${String(step.from)}\u00a0→\u00a0${String(step.level)}`);
  const own = steps.filter((other) => other.neededBy !== null && sameName(other.neededBy, step.name));
  if (own.length > 0 && depth < MAX_DEPTH) {
    element.append(" (");
    own.forEach((other, index) => {
      if (index > 0) element.append(", ");
      element.append(stepElement(doc, other, steps, depth + 1));
    });
    element.append(")");
  }
  return element;
}

/** Nesting deeper than this is a mistake in the steps: the game's chains are three or four requirements long. */
const MAX_DEPTH = 5;

/**
 * Adds the block to `description`, replacing the previous one; returns it, or null when nothing could be costed.
 * `rowLevel` is the level a row of construction.php or laboratoire.php waits to start; null for a unit.
 */
export function mountUnlockCost(description: Element, unlock: UnlockCost, rowLevel: number | null): HTMLElement | null {
  const amounts = RESOURCES.filter(({ key }) => unlock.cost[key] > 0);
  if (unlock.requirements.length === 0 || amounts.length === 0) return null;
  const doc = description.ownerDocument;
  const block = doc.createElement("div");
  block.title = rowLevel === null ? TITLE : `Pour lancer le niveau ${String(rowLevel)}.\n${TITLE}`;

  const tag = doc.createElement("span");
  tag.className = "optizzz-tag";
  tag.textContent = "Déblocage";

  const steps = doc.createElement("div");
  steps.className = "optizzz-unlock-steps";
  steps.append(
    ...unlock.requirements
      .filter((step) => step.neededBy === null)
      .map((step) => stepElement(doc, step, unlock.requirements)),
  );

  const cost = doc.createElement("div");
  cost.className = "optizzz-unlock-cost";
  if (!unlock.complete) cost.append("au moins");
  /** An icon (named for screen readers) and a figure in bold. */
  const amount = (icon: string, label: string, text: string, title = "") => {
    const element = doc.createElement("span");
    element.className = "optizzz-unlock-amount";
    const image = doc.createElement("img");
    image.src = icon;
    image.alt = label;
    image.title = label;
    const figure = doc.createElement("strong");
    figure.textContent = text;
    if (title) figure.title = title;
    element.append(image, figure);
    return element;
  };
  for (const { key, label, icon } of amounts) {
    const value = unlock.cost[key];
    const title = isCompacted(value) ? `${formatNumber(value)} ${label}` : "";
    cost.append(amount(icon, label, formatAmount(value).replace(/ /g, "\u00a0"), title));
  }
  if (unlock.duration !== null && unlock.duration > 0) {
    const time = amount(TIME_ICON, "temps", formatUnlockDuration(unlock.duration).replace(/ /g, "\u00a0"));
    time.title = TIME_TITLE;
    cost.append(time);
  }

  block.append(tag, steps, cost);
  placeInRow(description, "optizzz-unlock", block);
  return block;
}
