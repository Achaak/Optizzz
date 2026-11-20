// The analysis rows of the « Informations » box on Membre.php. See docs/features/analyse-joueurs.md.
import type { Inactivity } from "@optizzz/game/analysis/inactivity";
import type { AllianceReach, MutualReach } from "@optizzz/game/analysis/reach";
import { formatAmount } from "@optizzz/game/format/number-format";
import { findProfileStateRow } from "@optizzz/game/pages/scores";

/** Marks the rows; not an `optizzz-` class, for the same reason as the production row. */
export const ANALYSIS_ROW_ATTRIBUTE = "data-optizzz-analysis";

/** What the rows show; null leaves a row out. */
export interface ProfileAnalysis {
  reach: MutualReach | null;
  alliance: AllianceReach | null;
  inactivity: Inactivity | null;
}

interface Row {
  key: string;
  label: string;
  text: string;
  title: string;
}

const RANGE_RULE = "Portée : de 50 % (inclus) à 300 % (exclu) du TDC de l'attaquant.";

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

function reachRow(reach: MutualReach): Row {
  return {
    key: "reach",
    label: "Portée :",
    text: `${reach.iCanAttack ? "à votre portée" : "hors de votre portée"} · ${
      reach.canAttackMe ? "vous êtes à sa portée" : "vous êtes hors de sa portée"
    }`,
    title: RANGE_RULE,
  };
}

function allianceRow(alliance: AllianceReach): Row {
  const attackers =
    alliance.canAttackIt === 0
      ? "aucun membre ne peut l'attaquer"
      : `${formatAmount(alliance.canAttackIt)} ${plural(alliance.canAttackIt, "membre peut", "membres peuvent")} l'attaquer`;
  const targets = `${formatAmount(alliance.itCanAttack)} ${plural(alliance.itCanAttack, "est", "sont")} à sa portée`;
  const near = alliance.nearestAttacker;
  const squares = near ? Math.round(near.distance) : 0;
  const nearest = near
    ? ` · le plus proche : ${near.pseudo}, ${formatAmount(squares)} ${plural(squares, "case", "cases")}`
    : "";
  return {
    key: "alliance",
    label: "Votre alliance :",
    text: `${attackers}, ${targets}${nearest}`,
    title: `${RANGE_RULE} TDC des membres au dernier export ; le vôtre en direct. Distance en cases : seule votre Vitesse d'attaque est connue.`,
  };
}

function inactivityRow(inactivity: Inactivity): Row {
  return {
    key: "inactivity",
    label: "Activité :",
    text: `Inactif probable depuis ${formatAmount(inactivity.days)} j${
      inactivity.onlyLosses ? " (rien n'a bougé sauf des pertes)" : ""
    }`,
    title:
      "Ni son TDC, ni sa Fourmilière, ni sa Technologie n'ont monté depuis au moins 3 nuits (exports de minuit). Son TDC a pu baisser : des floods sans réponse.",
  };
}

/** Adds the rows after « Etat » and the production rows, or updates them; nothing without an « Etat » row. */
export function mountAnalysisRows(doc: Document, analysis: ProfileAnalysis): void {
  const stateRow = findProfileStateRow(doc);
  if (!stateRow) return;
  for (const row of doc.querySelectorAll(`tr[${ANALYSIS_ROW_ATTRIBUTE}]`)) row.remove();
  let after: Element = stateRow;
  while (after.nextElementSibling?.matches("tr[data-optizzz-production], tr[data-optizzz-colonies]")) {
    after = after.nextElementSibling;
  }
  const rows = [
    analysis.reach && reachRow(analysis.reach),
    analysis.alliance && allianceRow(analysis.alliance),
    analysis.inactivity && inactivityRow(analysis.inactivity),
  ].filter((row): row is Row => row !== null);
  for (const { key, label, text, title } of rows) {
    const row = doc.createElement("tr");
    row.setAttribute(ANALYSIS_ROW_ATTRIBUTE, key);
    const labelCell = doc.createElement("td");
    // As the game's own labels.
    labelCell.style.textAlign = "right";
    labelCell.textContent = label;
    const cell = doc.createElement("td");
    cell.textContent = text;
    row.append(labelCell, cell);
    row.title = title;
    after.after(row);
    after = row;
  }
}
