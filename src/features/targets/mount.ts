import type { Army } from "@/game/army/units";
import { planAttacks } from "@/game/flood";
import { afterOnWay, type OnWay } from "@/data/on-way";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTimeShort } from "@/utils/time-format";
import { listTargets, type Target, type TargetsInput } from "./targets";

// Colours of the game's own panel (table.simulateur) and of the rows of #tabEnnemie.
export const TARGETS_STYLE = `
.optizzz-targets { margin: 8px auto; width: fit-content; max-width: 100%; box-sizing: border-box; overflow-x: auto;
  padding: 6px 10px; text-align: left; background: var(--optizzz-surface); border: 1px solid var(--optizzz-border); }
.optizzz-targets summary, .optizzz-targets-title { cursor: pointer; font-weight: bold; font-size: 1.1em; }
.optizzz-targets-title { cursor: default; margin: 0; }
.optizzz-targets-note { font-style: italic; font-size: 0.85em; margin: 4px 0; max-width: 700px; }
.optizzz-targets label { margin-right: 16px; }
.optizzz-targets table { border-collapse: collapse; margin-top: 4px; font-size: 0.85em; }
.optizzz-targets th, .optizzz-targets td { padding: 2px 5px; white-space: nowrap; }
.optizzz-targets td.optizzz-targets-state { white-space: normal; min-width: 90px; }
.optizzz-targets td.optizzz-targets-number { text-align: right; }
.optizzz-targets td img { vertical-align: middle; margin-left: 2px; }
.optizzz-targets th button { background: none; border: none; padding: 0; font: inherit; font-weight: bold;
  color: inherit; cursor: pointer; text-decoration: underline dotted; }
.optizzz-targets th[aria-sort] button { text-decoration: none; }
.optizzz-targets th[aria-sort] button::after { content: " ▼"; }
.optizzz-targets th[aria-sort="ascending"] button::after { content: " ▲"; }
.optizzz-targets-protected { font-weight: bold; margin: 4px 0; }
.optizzz-targets tbody tr:nth-child(even) { background: var(--optizzz-surface-alt); }
.optizzz-targets tbody tr.optizzz-targets-war { background: var(--optizzz-war-bg); }
.optizzz-targets tbody tr.optizzz-targets-pact { background: var(--optizzz-pact-bg); }
.optizzz-targets tr.optizzz-targets-inactive { opacity: 0.55; }
.optizzz-targets-more { margin-top: 6px; }`;

export interface TargetsContext extends TargetsInput {
  /** Whether the box starts unfolded. */
  open: boolean;
  /** Called when the player folds or unfolds the box, to remember it. */
  onOpenChange: (open: boolean) => void;
  /** My army and attacks on their way, when known (plan de flood switched on, army read on Armee.php). */
  flood?: FloodSettings | null;
  /** Why the « Flood max » column is missing, when the flood plan is on. */
  floodMissing?: string | null;
  /** I am under the beginner protection: attacking ends it. */
  protectedMe?: boolean;
}

export interface FloodSettings {
  available: Army;
  attackSpeed: number;
  /** The same attacks on their way as the flood plan counts. */
  onWay: OnWay;
  /** Armies pasted on the attack form, by target id. */
  defenses: Map<number, Army>;
  weapons: number;
  shield: number;
  margin: number;
}

const PAGE_SIZE = 50;

type SortKey = "distance" | "field" | "flood";

const COLUMNS: { title: string; sort?: SortKey; flood?: boolean }[] = [
  { title: "Pseudo" },
  { title: "Alliance" },
  { title: "TDC", sort: "field" },
  { title: "%" },
  { title: "Prise max" },
  { title: "Flood max", sort: "flood", flood: true },
  { title: "Distance", sort: "distance" },
  // The trip grows with the distance: same order.
  { title: "Trajet", sort: "distance" },
  { title: "Arrivée" },
  { title: "État" },
  { title: "" },
];

function stateText(target: Target): string {
  switch (target.state) {
    case "colonized":
      return target.master ? `colonisé par ${target.master}` : "colonisé";
    case "holiday":
      return "en vacances";
    case "protected":
      return "protection débutant";
    case "banned":
      return "banni";
    case "free":
      return target.stateLive ? "libre" : "libre ?";
    case null:
      return "";
  }
}

const checkbox = (doc: Document, className: string, label: string, checked: boolean) => {
  const wrapper = doc.createElement("label");
  const input = doc.createElement("input");
  input.type = "checkbox";
  input.className = className;
  input.checked = checked;
  wrapper.append(input, ` ${label}`);
  return { wrapper, input };
};

/** Above the search form of ennemie.php, when the list cannot be made: says why. */
export function mountTargetsNotice(doc: Document, text: string) {
  const form = doc.getElementById("formulairePageEnnemie");
  const anchor = form?.closest("table.simulateur") ?? form;
  if (!anchor) return;
  const box = doc.createElement("div");
  box.className = "optizzz-targets";
  const title = doc.createElement("p");
  title.className = "optizzz-targets-title";
  title.textContent = "Cibles à portée";
  const message = doc.createElement("p");
  message.textContent = text;
  box.append(title, message);
  anchor.before(box);
}

/**
 * Above the search form of ennemie.php: the players I may attack, nearest first, with the trip, the arrival and
 * the diplomacy. Rebuilt from `context` at each change, so the arrival follows the clock.
 */
export function mountTargets(doc: Document, context: TargetsContext, clock: () => Date) {
  const form = doc.getElementById("formulairePageEnnemie");
  const anchor = form?.closest("table.simulateur") ?? form;
  if (!anchor) return;

  const box = doc.createElement("details");
  box.className = "optizzz-targets";
  box.open = context.open;
  box.addEventListener("toggle", () => {
    context.onOpenChange(box.open);
  });
  const summary = doc.createElement("summary");
  const note = doc.createElement("p");
  note.className = "optizzz-targets-note";
  note.textContent = [
    "TDC en direct pour les joueurs listés par le jeu ci-dessous, sinon d'après l'export public (mis à jour chaque heure).",
    "La protection débutant n'est connue que pour les joueurs listés par le jeu : « libre ? » pour les autres.",
    context.floodMissing ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const protectedMe = doc.createElement("p");
  protectedMe.className = "optizzz-targets-protected";
  protectedMe.textContent =
    "Vous êtes sous protection débutant : attaquer y met fin (avertissement du jeu, sous le formulaire de recherche).";
  protectedMe.hidden = !context.protectedMe;
  const hidePacts = checkbox(doc, "optizzz-targets-hide-pacts", "Masquer les pactes", true);
  const attackableOnly = checkbox(
    doc,
    "optizzz-targets-attackable-only",
    "Seulement les attaquables maintenant",
    false,
  );
  const filters = doc.createElement("p");
  filters.append(hidePacts.wrapper, attackableOnly.wrapper);

  const table = doc.createElement("table");
  const headRow = doc.createElement("tr");
  const tbody = doc.createElement("tbody");
  const thead = doc.createElement("thead");
  thead.append(headRow);
  table.append(thead, tbody);
  const empty = doc.createElement("p");
  empty.className = "optizzz-targets-empty";
  empty.textContent = "Aucune cible à portée.";
  const more = doc.createElement("button");
  more.type = "button";
  more.className = "optizzz-targets-more";

  let sort: SortKey = "distance";
  let shown = PAGE_SIZE;

  const { flood } = context;
  /** What a flood takes from each target, null when my army cannot beat its known defense; kept between renders. */
  const floods = new Map<number, number | null>();
  const floodOf = (target: Target): number | null => {
    if (!flood) return null;
    if (!floods.has(target.id)) {
      const defense = flood.defenses.get(target.id);
      // As the flood plan: once the attacks on their way have landed.
      const after = afterOnWay(context.me.field, target, flood.onWay, flood.attackSpeed);
      const plan = planAttacks({
        attackerField: after.myField,
        targetField: after.targetField,
        slots: after.slots,
        margin: flood.margin,
        available: flood.available,
        defender: defense
          ? {
              armies: { field: defense, nest: [], lodge: [] },
              weapons: flood.weapons,
              shield: flood.shield,
              dome: 0,
              lodge: 0,
            }
          : null,
        levels: { weapons: flood.weapons, shield: flood.shield },
      });
      floods.set(target.id, plan.blocked ? null : plan.attacks.reduce((sum, attack) => sum + attack.take, 0));
    }
    return floods.get(target.id) ?? null;
  };
  const sorts: Record<SortKey, (a: Target, b: Target) => number> = {
    distance: (a, b) => a.distance - b.distance,
    field: (a, b) => b.field - a.field,
    flood: (a, b) => (floodOf(b) ?? -1) - (floodOf(a) ?? -1),
  };

  const sortHeaders: { th: HTMLTableCellElement; key: SortKey }[] = [];
  for (const column of COLUMNS) {
    if (column.flood && !flood) continue;
    const th = doc.createElement("th");
    const key = column.sort;
    if (key) {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = column.title;
      button.title = "Trier";
      button.addEventListener("click", () => {
        sort = key;
        render();
      });
      th.append(button);
      sortHeaders.push({ th, key });
    } else {
      th.textContent = column.title;
    }
    headRow.append(th);
  }

  const cell = (row: HTMLTableRowElement, text = "", number = false) => {
    const td = doc.createElement("td");
    td.textContent = text;
    if (number) td.className = "optizzz-targets-number";
    row.append(td);
    return td;
  };

  const buildRow = (target: Target, now: Date) => {
    const row = doc.createElement("tr");
    if (target.diplomacy) row.classList.add(`optizzz-targets-${target.diplomacy.kind}`);
    if (target.state === "holiday" || target.state === "protected") row.classList.add("optizzz-targets-inactive");

    const pseudo = cell(row);
    const profile = doc.createElement("a");
    profile.href = `Membre.php?Pseudo=${encodeURIComponent(target.pseudo)}`;
    profile.textContent = target.pseudo;
    pseudo.append(profile);
    if (target.canAttackMe) {
      // The game's own icon for « Fourmilières pouvant m'attaquer ».
      const back = doc.createElement("img");
      back.src = "images/icone/icone_degat_defense.gif";
      back.width = 14;
      back.height = 14;
      back.alt = "";
      back.title = "Peut vous attaquer en retour";
      pseudo.append(back);
    }

    const alliance = cell(row, target.alliance ?? "");
    if (target.diplomacy?.kind === "war") alliance.append(" · Guerre");
    if (target.diplomacy?.kind === "pact") {
      alliance.append(` · Pacte (${target.diplomacy.name})`);
      alliance.title = target.diplomacy.description;
    }

    cell(row, formatNumber(target.field), true);
    cell(row, `${String(Math.round(target.ratio * 100))} %`, true);
    cell(row, formatNumber(target.takeMax), true).title =
      `20 % de son TDC, 1 cm² par fourmi au plus : il faut au moins ${formatNumber(target.takeMax)} fourmis pour tout prendre.`;
    if (flood) {
      const taken = floodOf(target);
      const { slots } = afterOnWay(context.me.field, target, flood.onWay, flood.attackSpeed);
      cell(row, taken === null ? "—" : formatNumber(taken), true).title =
        taken === null
          ? "Votre armée ne suffit pas à écraser sa défense connue."
          : `Avec vos ${String(slots)} attaques possibles et votre armée, après les attaques en route${flood.defenses.has(target.id) ? ", sa défense connue comprise" : ", sans défense en face"}.`;
    }
    cell(row, formatDecimal(target.distance), true);
    cell(row, formatDuration(target.travelSeconds * 1000), true);
    cell(row, formatEndTimeShort(target.arrival, now));
    const state = cell(row, stateText(target));
    state.className = "optizzz-targets-state";
    if (target.state === "free" && !target.stateLive) {
      state.title = "D'après l'export : pas dans le tableau du jeu, sa protection débutant est inconnue.";
    }

    const action = cell(row);
    if (target.attackableNow) {
      const attack = doc.createElement("a");
      attack.href = `ennemie.php?Attaquer=${String(target.id)}&lieu=1`;
      attack.textContent = "Attaquer";
      attack.title = "Ouvre le formulaire d'attaque du jeu : vous choisissez l'armée et validez vous-même.";
      action.append(attack);
    }
    return row;
  };

  const render = () => {
    const now = clock();
    for (const { th, key } of sortHeaders) {
      // Each key sorts one way only; the trip and the distance share theirs.
      if (key === sort) th.setAttribute("aria-sort", key === "distance" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    }
    const targets = listTargets(context, now)
      .filter((target) => !(hidePacts.input.checked && target.diplomacy?.kind === "pact"))
      .filter((target) => !attackableOnly.input.checked || target.attackableNow)
      .sort(sorts[sort]);
    summary.textContent = `Cibles à portée (${String(targets.length)})`;
    tbody.replaceChildren(...targets.slice(0, shown).map((target) => buildRow(target, now)));
    table.hidden = targets.length === 0;
    empty.hidden = targets.length > 0;
    const left = targets.length - shown;
    more.textContent = `Voir plus (${String(left)} restants)`;
    if (left > 0) table.after(more);
    else more.remove();
  };

  more.addEventListener("click", () => {
    shown += PAGE_SIZE;
    render();
  });
  for (const input of [hidePacts.input, attackableOnly.input]) {
    input.addEventListener("change", () => {
      shown = PAGE_SIZE;
      render();
    });
  }

  box.append(summary, protectedMe, note, filters, empty, table);
  anchor.before(box);
  render();
}
