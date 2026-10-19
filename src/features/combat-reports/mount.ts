import type { Place } from "@/game/army/battle";
import { unitLabel, UNITS } from "@/game/army/units";
import { combatWeapons, readCombatConversation, type CombatReport, type Loot } from "@/game/pages/combat-reports";
import { encodeOpponent, type Opponent } from "@/features/combat-simulator/form";
import { formatNumber } from "@/utils/number-format";
import { htmlElement } from "@/utils/html";

export const COMBAT_REPORT_STYLE = `
.optizzz-combat-report { margin: var(--optizzz-space-3) 0 10px; }
.optizzz-combat-report td { vertical-align: top; }
.optizzz-combat-report td:last-child { vertical-align: middle; text-align: right; }
.optizzz-combat-report-detail { display: block; }`;

const PLACE_LABELS: Record<Place, string> = {
  field: "Terrain de chasse",
  nest: "Fourmilière",
  lodge: "Loge Impériale",
};

/** « 1 921 JSN » never cut between the number and its unit. */
const unbreakable = (text: string) => text.replace(/ /g, "\u00a0");

const writeArmy = (army: Record<string, number>) =>
  Object.entries(army)
    .map(([key, count]) => unbreakable(`${formatNumber(count)} ${unitLabel(key)}`))
    .join(", ");

/** The full names, for the cell's tooltip: the keys are short. */
const armyNames = (army: Record<string, number>) =>
  Object.entries(army)
    .map(([key, count]) => `${formatNumber(count)} ${UNITS.find((unit) => unit.key === key)?.name ?? key}`)
    .join(", ");

/** What the « Butin chez … » messages of the same minute say was taken from the same player. */
function lootOf(combat: CombatReport, loots: Loot[]): string | null {
  const taken = loots.filter((loot) => loot.opponent === combat.opponent && loot.date === combat.date);
  if (taken.length === 0) return null;
  const sum = (pick: (loot: Loot) => number) => taken.reduce((total, loot) => total + pick(loot), 0);
  const parts: [number, string][] = [
    [sum((loot) => loot.field), "cm²"],
    [sum((loot) => loot.food), "nourriture"],
    [sum((loot) => loot.materials), "matériaux"],
  ];
  const written = parts
    .filter(([count]) => count > 0)
    .map(([count, unit]) => unbreakable(`${formatNumber(count)} ${unit}`));
  return written.length > 0 ? written.join(", ") : "rien";
}

/** The army the report showed at the place attacked, for the simulator; units it does not know are left out. */
function opponentOf(combat: CombatReport): Opponent | null {
  if (!combat.place) return null;
  return {
    place: combat.place,
    army: Object.fromEntries(
      Object.entries(combat.defenders).filter(([key]) => UNITS.some((unit) => unit.key === key)),
    ),
    weapons: combatWeapons(combat.taken),
    seen: `attaque du ${combat.date} contre ${combat.opponent}`,
  };
}

/** A cell: its main text, and under it a muted detail. */
function cell(doc: Document, main: string, detail: string | null): HTMLTableCellElement {
  const td = doc.createElement("td");
  td.textContent = main;
  if (detail !== null) {
    const span = doc.createElement("span");
    span.className = "optizzz-combat-report-detail optizzz-muted";
    span.textContent = detail;
    td.append(span);
  }
  return td;
}

export interface CombatReportInput {
  /** Loots of every « Combats » conversation open on the page: the field and resources taken are told apart. */
  loots: () => Loot[];
  /** Opens the simulator with an `encodeOpponent` army. */
  simulate: (opponent: string) => void;
}

/**
 * Table of the attacks above an opened « Combats » conversation; the game's text stays under it. Nothing for a
 * conversation without an attack (loot, colony). Call `update` when other conversations are opened.
 */
export function mountCombatReport(conversation: Element, input: CombatReportInput) {
  const doc = conversation.ownerDocument;
  const host = conversation.querySelector(":scope > td");
  const block = doc.createElement("div");
  block.className = "optizzz-combat-report";
  const table = htmlElement(
    doc,
    "table",
    `<table class="optizzz-table optizzz-table--framed"><thead><tr><th>Date et lieu</th><th>Résultat</th>
    <th>Mon armée</th><th>Armée adverse</th><th></th></tr></thead>
    <tbody></tbody></table>`,
  );
  const note = doc.createElement("p");
  note.className = "optizzz-note";
  note.textContent =
    "Armes : le niveau que montre le bonus de leurs dégâts (+10 % par niveau). « Simuler » ouvre le simulateur " +
    "de combat avec l'armée adverse vue, au lieu attaqué.";
  block.append(table, note);

  const update = () => {
    const { combats } = readCombatConversation(conversation);
    if (combats.length === 0) {
      block.remove();
      return;
    }
    if (!block.isConnected) host?.prepend(block);
    const loots = input.loots();
    table.querySelector("tbody")?.replaceChildren(
      ...combats.map((combat) => {
        const row = doc.createElement("tr");
        const weapons = combatWeapons(combat.taken);
        const loot = combat.won ? lootOf(combat, loots) : null;
        const place = combat.place ? PLACE_LABELS[combat.place] : "?";
        const lootCell = cell(
          doc,
          // Written, never only coloured.
          combat.won ? "Victoire" : "Défaite",
          combat.won ? `Pris : ${loot ?? "?"}` : null,
        );
        lootCell.classList.add("optizzz-combat-report-loot");
        if (combat.won && loot === null) {
          lootCell.title = `Ouvrez « Butin chez ${combat.opponent} » pour voir ce qui a été pris.`;
        }
        const theirs = cell(
          doc,
          writeArmy(combat.defenders),
          `${unbreakable(`Pertes : ${formatNumber(combat.killed)}`)} · ${unbreakable(`Armes : ${weapons === null ? "?" : String(weapons)}`)}`,
        );
        theirs.title =
          armyNames(combat.defenders) +
          (weapons === null
            ? "\nArmes : trop peu de dégâts adverses pour lire leur bonus, il en faut au moins 10 de base."
            : "");
        const mine = cell(doc, writeArmy(combat.attackers), unbreakable(`Pertes : ${formatNumber(combat.lost)}`));
        mine.title = armyNames(combat.attackers);
        row.append(
          cell(doc, combat.date, combat.occupied ? `${place}, armée d'occupation` : place),
          lootCell,
          mine,
          theirs,
        );
        const action = doc.createElement("td");
        const opponent = opponentOf(combat);
        if (opponent) {
          const button = doc.createElement("button");
          button.type = "button";
          button.className = "optizzz-button-link";
          button.textContent = "Simuler";
          button.title = "Ouvrir le simulateur de combat avec cette armée adverse";
          button.addEventListener("click", () => {
            input.simulate(encodeOpponent(opponent));
          });
          action.append(button);
        }
        row.append(action);
        return row;
      }),
    );
  };
  update();
  return { update };
}
