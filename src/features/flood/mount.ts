import type { Place } from "@/game/army/battle";
import { armyFromKeys, unitLabel, UNITS, type Army } from "@/game/army/units";
import { inRange, maxTake } from "@/game/attack";
import { planAttacks, type PlannedAttack } from "@/game/flood";
import { keepProbes, PLACES } from "@/game/probes";
import { formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTimeShort } from "@/utils/time-format";
import { readArmyText } from "../combat-simulator/form";
import { fillAttackForm, onAttackSent } from "./page";
import { afterOnWay, type OnWay } from "@/data/on-way";
import type { Launch } from "@/data/launches";

const C = "optizzz-flood";

/** Close to Optizzz's other boxes: red italic title, figures first, rules out of the way. */
export const FLOOD_STYLE = `
.${C} { margin: 8px auto; width: fit-content; min-width: min(520px, 100%); max-width: 100%; box-sizing: border-box;
  padding: 8px 12px 10px; text-align: left; background: var(--optizzz-surface);
  border: 1px solid var(--optizzz-border); border-radius: var(--optizzz-radius); box-shadow: var(--optizzz-panel-shadow); }
.${C} h3 { margin: 0 0 6px; font-family: var(--optizzz-title-font); color: var(--optizzz-title); font-size: 17px;
  font-style: italic; font-weight: bold; }
.${C} h4 { margin: 10px 0 4px; font-size: 1em; }
.${C} p { margin: 4px 0; }
.${C}-callout { padding: 5px 9px; border: 1px solid var(--optizzz-warning); border-radius: 6px;
  background: var(--optizzz-warning-bg); font-weight: bold; }
.${C}-facts { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.${C}-fact { display: flex; flex-direction: column; padding: 4px 10px; background: var(--optizzz-surface-tint);
  border: 1px solid var(--optizzz-border-soft); border-radius: 6px; }
.${C}-fact dt { font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
.${C}-fact dd { margin: 0; font-weight: bold; white-space: nowrap; }
.${C}-fact small { font-weight: normal; color: var(--optizzz-text-muted); }
.${C}-note, .${C}-rules { font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
.${C}-note:empty { display: none; }
.${C}-scroll { overflow-x: auto; margin-top: 6px; }
.${C} table { border-collapse: collapse; }
.${C} th, .${C} td { white-space: nowrap; }
.${C} .${C}-number { text-align: right; }
.${C} tbody tr:nth-child(even) { background: var(--optizzz-surface-alt); }
.${C} tfoot td { font-weight: bold; border-top: 1px solid var(--optizzz-border); }
.${C} tr.${C}-filled { font-weight: bold; box-shadow: inset 3px 0 0 var(--optizzz-title); }
.${C} tr.${C}-filled button { font-weight: bold; }
.${C}-defense { margin-top: 4px; padding-top: 2px; border-top: 1px solid var(--optizzz-border-soft); }
.${C}-defense-state { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.${C}-defense textarea { display: block; width: 100%; margin: 4px 0; }
.${C}-defense-note { color: var(--optizzz-danger); font-weight: bold; }
.${C}-rules { margin-top: 8px; }
.${C}-rules p { margin: 4px 0 0; }`;

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
  /** Ants kept home as probes (« Sondes »), put back on their places once the attack is sent. */
  probes: number;
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

const plural = (count: number, word: string) => `${formatNumber(count)} ${word}${count > 1 ? "s" : ""}`;

function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = "", text = "") {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function floodBox(doc: Document) {
  const box = element(doc, "div", C);
  box.append(element(doc, "h3", "", "Plan de flood"));
  return box;
}

/** Under the game's attack form, when no plan can be made: says why. */
export function mountFloodNotice(doc: Document, text: string) {
  const form = doc.getElementById("formulaireChoixArmee");
  if (!form) return;
  const box = floodBox(doc);
  box.append(element(doc, "p", `${C}-callout`, text));
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
  let filled: PlannedAttack | null = null;
  let targetLeft = context.target.field;

  const box = floodBox(doc);
  const protectedMe = element(
    doc,
    "p",
    `${C}-callout ${C}-protected`,
    "Vous êtes sous protection débutant : attaquer y met fin.",
  );
  protectedMe.hidden = !context.protectedMe;

  // Figures first: both fields, the free slots, the trip.
  const facts = element(doc, "dl", `${C}-facts`);
  const fact = (label: string) => {
    const item = element(doc, "div", `${C}-fact`);
    const value = element(doc, "dd");
    item.append(element(doc, "dt", "", label), value);
    facts.append(item);
    return value;
  };
  const targetFact = fact(context.target.pseudo);
  const meFact = fact("Vous");
  const slotsFact = fact("Attaques possibles");
  const tripFact = fact("Trajet");
  const note = element(doc, "p", `${C}-note`);

  const lodgeLabel = element(doc, "label");
  const lodge = element(doc, "input", `${C}-lodge`);
  lodge.type = "checkbox";
  lodge.checked = countLodge;
  lodgeLabel.append(lodge, " Compter les troupes de la Loge");
  const message = element(doc, "p", `${C}-callout ${C}-message`);

  const scroll = element(doc, "div", `${C}-scroll`);
  const table = element(doc, "table");
  scroll.append(table);
  const head = element(doc, "thead");
  const headRow = element(doc, "tr");
  head.append(headRow);
  const body = element(doc, "tbody");
  const foot = element(doc, "tfoot");
  table.append(head, body, foot);

  const defenseBox = element(doc, "div", `${C}-defense`);
  const defenseState = element(doc, "div", `${C}-defense-state`);
  const defenseText = element(doc, "span");
  const clear = element(doc, "button", `${C}-defense-clear`, "Effacer");
  clear.type = "button";
  clear.title = "Oublier cette défense : elle compte de nouveau comme nulle.";
  defenseState.append(defenseText, clear);
  const area = element(doc, "textarea");
  area.rows = 2;
  area.placeholder = "Coller un rapport de combat ou « 300 Jeunes Soldates Naines, 2 Tanks » : son armée sur le TDC";
  const use = element(doc, "button", `${C}-defense-use`, "Utiliser cette défense");
  use.type = "button";
  use.disabled = true;
  area.addEventListener("input", () => {
    use.disabled = area.value.trim() === "";
    defenseNote.hidden = true;
  });
  const defenseNote = element(doc, "p", `${C}-defense-note`);
  defenseNote.hidden = true;
  defenseBox.append(element(doc, "h4", "", "Sa défense sur le TDC"), defenseState, area, use, defenseNote);

  const rules = element(doc, "details", `${C}-rules`);
  rules.append(
    element(doc, "summary", "", "Règles utilisées (non vérifiées sur un vrai flood)"),
    element(
      doc,
      "p",
      "",
      "20 % de son TDC par attaque, 1 cm² par fourmi au plus, portée 50–300 % revérifiée à chaque arrivée. Vitesse d'attaque + 1 attaques en même temps (comme le simulateur de flood du jeu). Les attaques et chasses des autres joueurs peuvent changer les TDC avant l'arrivée.",
    ),
  );

  const cell = (row: HTMLTableRowElement, text: string, number = false, tag: "td" | "th" = "td") => {
    const td = element(doc, tag, number ? `${C}-number` : "", text);
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
    const armyIn = (from: readonly Place[]) =>
      UNITS.map((_, i) => from.reduce((count, place) => count + (context.available[place][i] ?? 0), 0));
    const available = keepProbes(armyIn(places), armyIn(PLACES), context.probes);
    const { travelSeconds } = context;

    targetFact.textContent = `${formatNumber(targetLeft)} cm²`;
    meFact.textContent = `${formatNumber(myField)} cm²`;
    slotsFact.textContent = String(slots);
    if (travelSeconds === null) {
      tripFact.textContent = "inconnu";
      tripFact.title = "L'un de vous deux est absent de l'export public.";
    } else {
      const arrival = element(
        doc,
        "small",
        "",
        ` · arrivée ≈ ${formatEndTimeShort(new Date(now.getTime() + travelSeconds * 1000), now)}`,
      );
      tripFact.replaceChildren(formatDuration(travelSeconds * 1000), arrival);
    }
    note.textContent = [
      after.onTarget > 0 ? `TDC après les ${plural(after.onTarget, "attaque")} en route.` : "",
      unknownOnWay > 0
        ? `${plural(unknownOnWay, "attaque")} lancée${unknownOnWay > 1 ? "s" : ""} sans ce plan : leur prise n'est pas comptée.`
        : "",
      context.probes > 0 ? `${plural(context.probes, "sonde")} gardée${context.probes > 1 ? "s" : ""} au nid.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    defenseText.textContent = defense
      ? `${armyText(defense.army) || "aucune"} (relevée il y a ${formatDuration(now.getTime() - defense.readAt.getTime())})`
      : "Inconnue, comptée comme nulle.";
    clear.hidden = !defense;

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
    if (filled && !planned.some((attack) => filled && sameArmy(attack.army, filled.army))) filled = null;

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

    // Losses only matter against a defense: a column then, nothing otherwise.
    const withLosses = planned.some((attack) => attack.lost);
    headRow.replaceChildren();
    for (const [label, number] of [
      ["N°", false],
      ["Armée", false],
      ...(withLosses ? [["Pertes", false] as const] : []),
      ["Prise", true],
      ["Son TDC après", true],
      ["Mon TDC après", true],
      ["", false],
    ] as const) {
      cell(headRow, label, number, "th");
    }

    body.replaceChildren(
      ...planned.map((attack, index) => {
        const row = element(doc, "tr");
        const isFilled = filled !== null && sameArmy(attack.army, filled.army);
        row.classList.toggle(`${C}-filled`, isFilled);
        cell(row, String(index + 1));
        cell(row, armyText(attack.army));
        if (withLosses) cell(row, attack.lost ? armyText(attack.lost) || "aucune" : "");
        cell(row, formatNumber(attack.take), true);
        cell(row, formatNumber(attack.targetAfter), true);
        cell(row, formatNumber(attack.attackerAfter), true);
        const fill = element(doc, "button", `${C}-fill`, isFilled ? "✓ Rempli" : "Remplir");
        fill.type = "button";
        fill.title = "Met ces unités dans le formulaire du jeu (TDC visé) : vous validez vous-même.";
        fill.addEventListener("click", () => {
          fillAttackForm(doc, attack.army);
          filled = attack;
          render();
        });
        cell(row, "").append(fill);
        return row;
      }),
    );
    const last = planned.at(-1);
    const footRow = element(doc, "tr");
    if (last) {
      cell(footRow, "Total").colSpan = withLosses ? 3 : 2;
      cell(footRow, `${formatNumber(planned.reduce((acc, attack) => acc + attack.take, 0))} cm²`, true);
      cell(footRow, formatNumber(last.targetAfter), true);
      cell(footRow, formatNumber(last.attackerAfter), true);
      cell(footRow, plural(planned.length, "attaque"));
    }
    foot.replaceChildren(footRow);
    scroll.hidden = planned.length === 0;
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
    const sent = planned.find((attack) => sameArmy(attack.army, army));
    const take = sent ? sent.take : Math.min(ants, maxTake(targetLeft));
    context.onSend({
      targetId: context.target.id,
      target: context.target.pseudo,
      ants,
      take,
      arrivesAt: new Date(clock().getTime() + context.travelSeconds * 1000),
    });
  });

  box.append(protectedMe, facts, note, lodgeLabel, message, scroll, defenseBox, rules);
  form.after(box);
  render();
}
