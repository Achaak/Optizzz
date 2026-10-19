// A line under the Étable à pucerons (and under Communication avec les animaux when its next level unlocks the
// stable's): how soon the colonies, or the convoys, pay the next level back, the Communication and Laboratoire it
// needs included. See docs/features/conseils-recherche.md.
import { payback, stableGain, type StableGain } from "@/game/aphids";
import { sameName } from "@/game/levels";
import { costWithRequirements, type LevelCost, type LevelRow, type Requirement } from "@/game/requirements";
import { formatNumber as formatSpaced } from "@/utils/number-format";
import { placeInRow } from "@/utils/row-extras";

export const STABLE = "Étable à pucerons";
export const COMMUNICATION = "Communication avec les animaux";

export const APHIDS_STYLE = `
.optizzz-aphids { margin-top: var(--optizzz-space-2); display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--optizzz-space-3); }
.optizzz-aphids strong { color: var(--optizzz-success-text); }
.optizzz-aphids-detail { flex-basis: 100%; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }`;

export interface AphidsAdvice {
  cost: LevelCost;
  gain: StableGain;
  /** The Communication avec les animaux level the stable's next level needs, null when it has it. */
  unlockedBy: Requirement | null;
}

/** The next stable level, from the rows of both pages, the TDC of the colonies and the spare workers (null: unknown). */
export function aphidsAdvice(
  rows: readonly LevelRow[],
  colonyFields: readonly number[] | null,
  spare: number | null,
): AphidsAdvice | null {
  const stable = rows.find((row) => sameName(row.name, STABLE));
  if (!stable) return null;
  const cost = costWithRequirements(stable, rows);
  return {
    cost,
    gain: stableGain(stable.level, colonyFields, spare),
    unlockedBy: cost.requirements.find((requirement) => sameName(requirement.name, COMMUNICATION)) ?? null,
  };
}

/** Numbers never break at the end of a line. */
const formatNumber = (value: number) => formatSpaced(value).replace(/ /g, "\u00a0");
const level = (requirement: Requirement) => `${requirement.name} ${String(requirement.level)}`;
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} et ${items.at(-1) ?? ""}` : (items[0] ?? "");
/** Beyond, the line says « plus d'un an ». */
const YEAR = 365;

/** Where the line goes: the stable's row, or Communication avec les animaux's. */
export type AphidsRow = "stable" | "research";

const count = (value: number, unit: string) => `${formatNumber(value)} ${unit}${value > 1 ? "s" : ""}`;

/**
 * The lead (the level, with what it needs), the answer in bold (how soon the colonies or the convoys pay it back),
 * then the figures it comes from.
 */
export function aphidsText({ cost, gain }: AphidsAdvice, where: AphidsRow) {
  const shown = cost.requirements.filter(
    (requirement) => where === "stable" || !sameName(requirement.name, COMMUNICATION),
  );
  const including = shown.length ? ` (avec ${list(shown.map(level))})` : "";
  const atLeast = cost.complete ? "" : " au moins";
  const days = payback(cost.total, gain.daily);
  const trips = gain.extraLoad === null ? null : payback(cost.total, gain.extraLoad);
  const ways = [
    ...(days === null
      ? []
      : [days > YEAR ? "en plus d'un an par vos colonies" : `en ${count(days, "jour")} au moins par vos colonies`]),
    ...(trips === null ? [] : [`en ${count(trips, "envoi")} de convoi${atLeast}`]),
  ];
  const colonies =
    gain.colonies === null
      ? "colonies inconnues"
      : gain.colonies === 0 || gain.daily === 0
        ? "sans colonie"
        : `+${formatNumber(gain.daily)} par jour sur ${gain.colonies === 1 ? "votre colonie" : `vos ${String(gain.colonies)} colonies`}`;
  const convoys =
    gain.spare === null || gain.extraLoad === null
      ? `${formatNumber(gain.workersSaved)} ouvrières de moins par million envoyé`
      : gain.spare === 0
        ? "aucune ouvrière libre pour les convois"
        : `+${formatNumber(gain.extraLoad)} par envoi avec vos ${formatNumber(gain.spare)} ouvrières libres`;
  const paid = `${formatNumber(cost.total)}${atLeast} ressources${
    cost.cost.workers > 0 ? ` et ${formatNumber(cost.cost.workers)} ouvrières` : ""
  }`;
  return {
    lead:
      where === "stable"
        ? `Niveau ${String(cost.level)}${including} :`
        : `Débloque ${STABLE} ${String(cost.level)}${including} :`,
    strong: ways.length
      ? `${where === "stable" ? "remboursé" : "remboursés ensemble"} ${ways.join(", ou ")}`
      : "ne rapporte qu'au pillage",
    detail: `${colonies} · ${convoys} · coût ${paid}`,
  };
}

const TITLE =
  "Optizzz : chaque niveau d'Étable à pucerons ajoute 1 % à la taxe de vos colonies, 5 % à ce que porte une ouvrière " +
  "en convoi et 1 % au pillage d'une fourmilière (au plus 1 ressource par point d'attaque survivant ; non chiffré, il " +
  "dépend de vos cibles).\n" +
  "Ouvrières libres : celles de la fourmilière et celles parties en convoi, moins une par cm² de TDC, qui récolte.\n" +
  "Gain par jour : 1 % de la production max de chaque colonie (colonies de la page Colonies, TDC × 48 d'après l'export public du jeu) ; une colonie qui " +
  "manque d'ouvrières rapporte moins, d'où « au moins ».\n" +
  "Coût : nourriture et matériaux additionnés, avec les niveaux requis de Communication avec les animaux et du " +
  "Laboratoire, comptés en entier bien que le Laboratoire serve aussi aux autres recherches. Les ouvrières ne sont " +
  "pas comptées dans le remboursement.";

/** Adds the line to `description`; returns it. */
export function mountAphids(description: Element, advice: AphidsAdvice, where: AphidsRow): HTMLElement {
  const text = aphidsText(advice, where);
  const doc = description.ownerDocument;
  const line = doc.createElement("div");
  line.title = TITLE;
  const span = (className: string, content: string) => {
    const element = doc.createElement("span");
    element.className = className;
    element.textContent = content;
    return element;
  };
  const strong = doc.createElement("strong");
  strong.textContent = text.strong;
  line.append(
    span("optizzz-advice-tag optizzz-tag", "Conseil"),
    " ",
    text.lead,
    " ",
    strong,
    " ",
    span("optizzz-aphids-detail", text.detail),
  );
  placeInRow(description, "optizzz-aphids", line);
  return line;
}
