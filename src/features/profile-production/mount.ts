// The « Production max » row under « Etat » on Membre.php. See docs/features/production-profil.md.
import { BASE_COLONY_TAX, estimateProduction } from "@/game/production";
import { findProfileStateRow } from "@/game/pages/scores";
import { formatNumber } from "@/utils/number-format";

/**
 * Marks the row. Not an `optizzz-` class: the theme pads the cells of any `[class*="optizzz-"]` block, and the row
 * must line up with the game's own rows.
 */
export const PRODUCTION_ROW_ATTRIBUTE = "data-optizzz-production";

export const PRODUCTION_STYLE = `
tr[${PRODUCTION_ROW_ATTRIBUTE}], tr[data-optizzz-colonies] { cursor: help; }
.optizzz-production-detail { margin-left: 6px; font-size: var(--optizzz-font-size-small);
  color: var(--optizzz-text-muted); }
@media (max-width: 600px) { .optizzz-production-detail { display: block; margin-left: 0; white-space: normal; } }
`;

/** The colony tax: none (free anthill), known (master's aphid stable, or my own Ressources.php), or only its floor. */
export type ColonyTax = { kind: "none" } | { kind: "known"; rate: number } | { kind: "atLeast" };

const percent = (rate: number) => `${formatNumber(Math.round(rate * 100))} %`;

/** The row's figure (« par jour » follows it), in bold as the game's values; the tax detail, muted; the tooltip. */
export function productionText(field: number, tax: ColonyTax): { value: string; detail: string | null; title: string } {
  const basis =
    "TDC × 48 : une ouvrière au travail par cm², qui rapporte 48 ressources par jour. Sans la champignonnière.";
  if (tax.kind === "none") {
    return { value: `≈ ${formatNumber(estimateProduction(field, 0).gross)}`, detail: null, title: basis };
  }
  const rate = tax.kind === "known" ? tax.rate : BASE_COLONY_TAX;
  const { gross, net } = estimateProduction(field, rate);
  const taxRule = "Le maître prend 20 % plus 1 % par niveau de son Étable à pucerons.";
  if (tax.kind === "known") {
    return {
      value: `≈ ${formatNumber(net)}`,
      detail: `taxe de ${percent(rate)} déduite, ${formatNumber(gross)} avant`,
      title: `${basis}\n${taxRule}`,
    };
  }
  return {
    value: `≤ ${formatNumber(net)}`,
    detail: `taxe d'au moins ${percent(rate)} déduite, ${formatNumber(gross)} avant`,
    title: `${basis}\n${taxRule} Le niveau de son étable n'est pas connu : la taxe peut être plus forte.`,
  };
}

/** Adds the row after « Etat », or updates it; nothing when the profile has no « Etat » row. */
export function mountProductionRow(doc: Document, field: number, tax: ColonyTax): void {
  const stateRow = findProfileStateRow(doc);
  if (!stateRow) return;
  let row = doc.querySelector<HTMLTableRowElement>(`tr[${PRODUCTION_ROW_ATTRIBUTE}]`);
  if (!row) {
    row = doc.createElement("tr");
    row.setAttribute(PRODUCTION_ROW_ATTRIBUTE, "");
    const label = doc.createElement("td");
    // As the game's own labels.
    label.style.textAlign = "right";
    label.textContent = "Production max :";
    row.append(label, doc.createElement("td"));
    stateRow.after(row);
  }
  const { value, detail, title } = productionText(field, tax);
  const figure = doc.createElement("strong");
  figure.textContent = value;
  const cell = row.cells[1];
  cell?.replaceChildren(figure, " par jour");
  if (detail) {
    const muted = doc.createElement("span");
    muted.className = "optizzz-production-detail";
    muted.textContent = `(${detail})`;
    cell?.append(muted);
  }
  row.title = title;
}

/** Marks the row of the taxes a master takes from their colonies. */
export const COLONIES_ROW_ATTRIBUTE = "data-optizzz-colonies";

/** One colony: its TDC, and the rate it pays when Optizzz knows it (null: only the 20 % floor). */
export interface Colony {
  field: number;
  rate: number | null;
}

/** What the colonies' ceilings pay their master a day, and the tooltip. */
export function coloniesText(colonies: readonly Colony[]): { value: string; detail: string; title: string } {
  const exact = colonies.every((colony) => colony.rate !== null);
  const amount = colonies.reduce(
    (total, colony) => total + estimateProduction(colony.field, colony.rate ?? BASE_COLONY_TAX).tax,
    0,
  );
  const count = colonies.length;
  return {
    value: `${exact ? "≈" : "≥"} ${formatNumber(amount)}`,
    detail: `${String(count)} colonie${count > 1 ? "s" : ""}, sur ${count > 1 ? "leur" : "son"} TDC du dernier export`,
    title:
      "La taxe prise sur la production max de chaque colonie (TDC × 48) : 20 % plus 1 % par niveau de l'Étable à " +
      `pucerons du maître.${exact ? "" : " Le niveau de son étable n'est pas connu : la taxe peut être plus forte."}`,
  };
}

/** Adds the « Taxes de colonies » row after the production row, or updates it; nothing without colonies. */
export function mountColoniesRow(doc: Document, colonies: readonly Colony[]): void {
  const after = doc.querySelector(`tr[${PRODUCTION_ROW_ATTRIBUTE}]`);
  if (!after || colonies.length === 0) return;
  let row = doc.querySelector<HTMLTableRowElement>(`tr[${COLONIES_ROW_ATTRIBUTE}]`);
  if (!row) {
    row = doc.createElement("tr");
    row.setAttribute(COLONIES_ROW_ATTRIBUTE, "");
    const label = doc.createElement("td");
    label.style.textAlign = "right";
    label.textContent = "Taxes de colonies :";
    row.append(label, doc.createElement("td"));
    after.after(row);
  }
  const { value, detail, title } = coloniesText(colonies);
  const figure = doc.createElement("strong");
  figure.textContent = value;
  const muted = doc.createElement("span");
  muted.className = "optizzz-production-detail";
  muted.textContent = `(${detail})`;
  row.cells[1]?.replaceChildren(figure, " par jour", muted);
  row.title = title;
}
