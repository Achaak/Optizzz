import type { Place } from "@/game/army/battle";
import { armyFromKeys, unitLabel, UNITS, type Army } from "@/game/army/units";
import { inRange, maxTake } from "@/game/attack";
import { planAttacks, type PlannedAttack } from "@/game/flood";
import { formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTimeShort } from "@/utils/time-format";
import { readArmyText } from "../combat-simulator/form";
import { fillAttackForm, onAttackSent } from "./page";
import { afterOnWay, type OnWay } from "@/data/on-way";
import type { Launch } from "@/data/launches";

export const FLOOD_STYLE = `
.optizzz-flood { margin: 8px auto; width: fit-content; max-width: 100%; box-sizing: border-box; overflow-x: auto;
  padding: 6px 10px; text-align: left; background: var(--optizzz-surface); border: 1px solid var(--optizzz-border); }
.optizzz-flood h3 { margin: 0 0 4px; }
.optizzz-flood p { margin: 4px 0; }
.optizzz-flood-warning { font-style: italic; font-size: 0.85em; }
.optizzz-flood-protected { font-weight: bold; }
.optizzz-flood table { border-collapse: collapse; font-size: 0.9em; }
.optizzz-flood th, .optizzz-flood td { padding: 2px 6px; white-space: nowrap; }
.optizzz-flood td.optizzz-flood-number { text-align: right; }
.optizzz-flood tbody tr:nth-child(even) { background: var(--optizzz-surface-alt); }
.optizzz-flood tr.optizzz-flood-filled { font-weight: bold; }
.optizzz-flood-defense textarea { width: 100%; box-sizing: border-box; }`;

export interface FloodContext {
  me: { field: number; weapons: number; shield: number };
  target: { id: number; pseudo: string; field: number };
  /** My units by place, read on the form. */
  available: Record<Place, Army>;
  attackSpeed: number;
  /** Trip to the target; null when one of us is missing from the export. */
  travelSeconds: number | null;
  onWay: OnWay;
  /** The target's army on its hunting field, when pasted. */
  defense: { army: Army; readAt: Date } | null;
  countLodge: boolean;
  /** I am under the beginner protection: attacking ends it. */
  protectedMe?: boolean;
  /** Kept above the 50 % limit. */
  margin: number;
  onCountLodgeChange: (count: boolean) => void;
  onDefenseChange: (army: Army | null) => void;
  onSend: (launch: Launch) => void;
}

const armyText = (army: Army) =>
  UNITS.flatMap((unit, i) => ((army[i] ?? 0) > 0 ? [`${formatNumber(army[i] ?? 0)} ${unitLabel(unit.key)}`] : [])).join(
    ", ",
  );

const total = (army: Army) => army.reduce((sum, count) => sum + count, 0);

const sameArmy = (a: Army, b: Army) => UNITS.every((_, i) => (a[i] ?? 0) === (b[i] ?? 0));

/** Under the game's attack form, when no plan can be made: says why. */
export function mountFloodNotice(doc: Document, text: string) {
  const form = doc.getElementById("formulaireChoixArmee");
  if (!form) return;
  const box = doc.createElement("div");
  box.className = "optizzz-flood";
  const title = doc.createElement("h3");
  title.textContent = "Plan de flood";
  const message = doc.createElement("p");
  message.textContent = text;
  box.append(title, message);
  form.after(box);
}

/**
 * Under the game's attack form: the flood that takes the most from this target with my free slots and army, a
 * button per attack to fill the form, and what the player sends remembered for the next plan.
 */
export function mountFloodPlanner(doc: Document, context: FloodContext, clock: () => Date) {
  const form = doc.getElementById("formulaireChoixArmee");
  if (!form) return;

  let countLodge = context.countLodge;
  let defense = context.defense;
  let planned: PlannedAttack[] = [];
  let targetLeft = context.target.field;

  const box = doc.createElement("div");
  box.className = "optizzz-flood";
  const title = doc.createElement("h3");
  title.textContent = "Plan de flood";
  const warning = doc.createElement("p");
  warning.className = "optizzz-flood-warning";
  warning.textContent =
    "Règles non vérifiées sur un vrai flood : 20 % de son TDC par attaque, 1 cm² par fourmi au plus, portée 50–300 % revérifiée à chaque arrivée. Vitesse d'attaque + 1 attaques en même temps (comme le simulateur de flood du jeu). Les attaques et chasses des autres joueurs peuvent changer les TDC avant l'arrivée.";
  const protectedMe = doc.createElement("p");
  protectedMe.className = "optizzz-flood-protected";
  protectedMe.textContent = "Vous êtes sous protection débutant : attaquer y met fin.";
  protectedMe.hidden = !context.protectedMe;
  const summary = doc.createElement("p");
  const lodgeLabel = doc.createElement("label");
  const lodge = doc.createElement("input");
  lodge.type = "checkbox";
  lodge.className = "optizzz-flood-lodge";
  lodge.checked = countLodge;
  lodgeLabel.append(lodge, " Compter les troupes de la Loge");
  const message = doc.createElement("p");
  const table = doc.createElement("table");
  const head = doc.createElement("thead");
  const headRow = doc.createElement("tr");
  for (const label of ["N°", "Armée", "Prise", "Son TDC après", "Mon TDC après", ""]) {
    const th = doc.createElement("th");
    th.textContent = label;
    headRow.append(th);
  }
  head.append(headRow);
  const body = doc.createElement("tbody");
  table.append(head, body);
  const totalLine = doc.createElement("p");

  const defenseBox = doc.createElement("div");
  defenseBox.className = "optizzz-flood-defense";
  const defenseState = doc.createElement("p");
  const area = doc.createElement("textarea");
  area.rows = 2;
  area.placeholder = "Coller un rapport de combat ou « 300 Jeunes Soldates Naines, 2 Tanks » : son armée sur le TDC";
  const use = doc.createElement("button");
  use.type = "button";
  use.className = "optizzz-flood-defense-use";
  use.textContent = "Utiliser cette défense";
  use.disabled = true;
  area.addEventListener("input", () => {
    use.disabled = area.value.trim() === "";
  });
  const clear = doc.createElement("button");
  clear.type = "button";
  clear.textContent = "Effacer";
  const defenseNote = doc.createElement("p");
  defenseNote.className = "optizzz-flood-defense-note";
  defenseNote.hidden = true;
  defenseBox.append(defenseState, area, use, " ", clear, defenseNote);

  const cell = (row: HTMLTableRowElement, text: string, number = false) => {
    const td = doc.createElement("td");
    td.textContent = text;
    if (number) td.className = "optizzz-flood-number";
    row.append(td);
    return td;
  };

  const render = () => {
    const now = clock();
    const after = afterOnWay(context.me.field, context.target, context.onWay, context.attackSpeed);
    const { myField, slots } = after;
    targetLeft = after.targetField;
    const unknownOnWay = context.onWay.unknown;
    const places: Place[] = countLodge ? ["field", "nest", "lodge"] : ["field", "nest"];
    const available = UNITS.map((_, i) => places.reduce((sum, place) => sum + (context.available[place][i] ?? 0), 0));
    const { travelSeconds } = context;

    summary.textContent = [
      `${context.target.pseudo} : ${formatNumber(targetLeft)} cm², vous ${formatNumber(myField)}`,
      after.onTarget > 0 ? ` (après les ${String(after.onTarget)} attaques en route)` : "",
      ` · ${String(slots)} attaque${slots > 1 ? "s" : ""} possible${slots > 1 ? "s" : ""}`,
      unknownOnWay > 0
        ? ` (${String(unknownOnWay)} attaque${unknownOnWay > 1 ? "s" : ""} lancée${unknownOnWay > 1 ? "s" : ""} sans ce plan : leur prise n'est pas comptée)`
        : "",
      travelSeconds === null
        ? " · trajet inconnu (absent de l'export)"
        : ` · trajet ${formatDuration(travelSeconds * 1000)}, arrivée ≈ ${formatEndTimeShort(new Date(now.getTime() + travelSeconds * 1000), now)}`,
    ].join("");
    defenseState.textContent = defense
      ? `Sa défense sur le TDC (relevée il y a ${formatDuration(now.getTime() - defense.readAt.getTime())}) : ${armyText(defense.army) || "aucune"}`
      : "Sa défense sur le TDC : inconnue, comptée comme nulle.";

    const plan = planAttacks({
      attackerField: myField,
      targetField: targetLeft,
      slots,
      margin: context.margin,
      available,
      defender: defense
        ? {
            armies: { field: defense.army, nest: [], lodge: [] },
            // The target's levels are unknown: taken as mine.
            weapons: context.me.weapons,
            shield: context.me.shield,
            dome: 0,
            lodge: 0,
          }
        : null,
      levels: { weapons: context.me.weapons, shield: context.me.shield },
    });
    planned = plan.attacks;

    const lodgeOnly = total(available) === 0 && total(context.available.lodge) > 0;
    message.textContent = !inRange(myField, targetLeft)
      ? `${context.target.pseudo} est hors de portée (50 % à 300 % de votre TDC).`
      : !inRange(myField, targetLeft, context.margin)
        ? `${context.target.pseudo} est à moins de ${String(context.margin * 100)} % de la limite des 50 % : trop juste, un autre mouvement peut la faire sortir de portée avant l'arrivée.`
        : slots === 0
          ? "Aucune attaque possible de plus pour l'instant."
          : plan.blocked
            ? "Votre armée ne suffit pas à écraser sa défense (riposte à 10 %)."
            : lodgeOnly
              ? "Votre armée est en Loge : cochez « Compter les troupes de la Loge » pour l'envoyer."
              : planned.length === 0
                ? "Aucune fourmi à envoyer."
                : "";
    message.hidden = message.textContent === "";

    body.replaceChildren(
      ...planned.map((attack, index) => {
        const row = doc.createElement("tr");
        cell(row, String(index + 1));
        cell(row, armyText(attack.army)).title = attack.lost
          ? `Pertes prévues : ${armyText(attack.lost) || "aucune"}`
          : "";
        cell(row, formatNumber(attack.take), true);
        cell(row, formatNumber(attack.targetAfter), true);
        cell(row, formatNumber(attack.attackerAfter), true);
        const fill = doc.createElement("button");
        fill.type = "button";
        fill.textContent = "Remplir";
        fill.title = "Met ces unités dans le formulaire du jeu (TDC visé) : vous validez vous-même.";
        fill.addEventListener("click", () => {
          fillAttackForm(doc, attack.army);
          for (const other of body.querySelectorAll("tr")) other.classList.remove("optizzz-flood-filled");
          row.classList.add("optizzz-flood-filled");
        });
        cell(row, "").append(fill);
        return row;
      }),
    );
    table.hidden = planned.length === 0;
    const sum = planned.reduce((acc, attack) => acc + attack.take, 0);
    totalLine.textContent = `Total : ${formatNumber(sum)} cm² en ${String(planned.length)} attaque${planned.length > 1 ? "s" : ""}.`;
    totalLine.hidden = planned.length === 0;
  };

  lodge.addEventListener("change", () => {
    countLodge = lodge.checked;
    context.onCountLodgeChange(countLodge);
    render();
  });
  use.addEventListener("click", () => {
    const { army } = readArmyText(area.value, "defense");
    const counts = armyFromKeys(Object.fromEntries(Object.entries(army).map(([key, count]) => [key, count ?? 0])));
    // Nothing read is not « no defense »: the text is kept for the player to fix.
    defenseNote.hidden = total(counts) > 0;
    defenseNote.textContent = "Aucune unité reconnue dans ce texte : sa défense n'a pas changé.";
    if (total(counts) === 0) return;
    defense = { army: counts, readAt: clock() };
    context.onDefenseChange(counts);
    area.value = "";
    use.disabled = true;
    render();
  });
  clear.addEventListener("click", () => {
    defense = null;
    context.onDefenseChange(null);
    render();
  });

  onAttackSent(doc, ({ army }) => {
    const ants = total(army);
    // Without the trip, the attack could never be forgotten.
    if (ants === 0 || context.travelSeconds === null) return;
    // Whatever the place aimed at, the hunting field is fought first and taken from (game help « Attaque & Défense »).
    // An attack filled from the plan takes what was planned (after a defense, its survivors only).
    const filled = planned.find((attack) => sameArmy(attack.army, army));
    const take = filled ? filled.take : Math.min(ants, maxTake(targetLeft));
    context.onSend({
      targetId: context.target.id,
      target: context.target.pseudo,
      ants,
      take,
      arrivesAt: new Date(clock().getTime() + context.travelSeconds * 1000),
    });
  });

  box.append(title, protectedMe, warning, summary, lodgeLabel, message, table, totalLine, defenseBox);
  form.after(box);
  render();
}
