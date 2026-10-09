// Laying on Reine.php: when an order ends, when it can be paid, what it costs a day. Structure of the page:
// docs/research/fourmizzz-pages.md (« Reine.php »); upkeep: docs/research/ressources-et-entretien.md.
import type { Place } from "@/game/army/battle";
import { UNITS } from "@/game/army/units";
import { dailyBalance, timeToAfford, type Affordability, type ColonyState } from "@/game/forecast";
import { parseGameDuration } from "@/game/pages/work-queue";
import { parseGameInteger } from "@/utils/game-number";
import { formatNumber } from "@/utils/number-format";
import { formatEndTimeShort, fromParisParts, parisParts } from "@/utils/time-format";
import type { LayingSettings } from "./settings";

/** One unit's laying form: its elements carry the row's suffix ("" for workers, "1" for `unite1`…). */
export interface LayingRow {
  suffix: string;
  /** Null for workers. */
  unitKey: string | null;
  input: HTMLInputElement;
  /** The cost cell (`td.cout_amelioration`), holding the game's form. */
  cell: Element;
  /** The wide description cell next to it, where the planner goes (the cost cell when missing). */
  panel: Element;
}

export interface Order {
  count: number;
  /** Food for the whole order, as the game shows it. */
  food: number;
  /** Milliseconds for the whole order, as the game shows it. */
  duration: number;
  /** Where the units go; null for workers. */
  destination: Place | null;
}

export interface LayingPlan {
  affordability: Affordability;
  /** Null when it can never be paid. */
  endsAt: Date | null;
  /** Food a day the new units eat. */
  upkeepPerDay: number;
  /** Food gained a day once they are laid. */
  balanceAfter: number;
  /** Workers only: those beyond one per cm² of hunting field, who harvest nothing. */
  idleWorkers: number | null;
}

// destination_suivante cycles through 1 Terrain, 2 Dôme, 3 Loge (`nom_destination` in the page's script).
const DESTINATIONS: Record<string, Place> = { "1": "field", "2": "nest", "3": "lodge" };
/** Daily upkeep, share of the laying cost in food (official help, « Attaque & Défense »). */
const UPKEEP: Record<Place, number> = { field: 0.05, nest: 0.1, lodge: 0.15 };

export function readLayingRows(doc: Document): LayingRow[] {
  return [...doc.querySelectorAll<HTMLInputElement>('input[id^="input_cout_nombre"]')].flatMap((input) => {
    const suffix = input.id.slice("input_cout_nombre".length);
    const type = input.form?.querySelector<HTMLInputElement>('input[name="typeUnite"]')?.value ?? "";
    const unitKey =
      type === "ouvriere" ? null : (UNITS.find((unit) => `unite${String(unit.field)}` === type)?.key ?? null);
    // The field sits in a table inside the form: the plan goes in the cost cell, outside the form.
    const cell = input.form?.closest("td") ?? input.closest("td");
    if (!cell || (type !== "ouvriere" && !unitKey)) return [];
    const description = cell.previousElementSibling;
    const panel = description?.classList.contains("desciption_amelioration") ? description : cell;
    return [{ suffix, unitKey, input, cell, panel }];
  });
}

/**
 * The number ordered and what the game computed for it. The game sets it with a slider, the field (« 2k », « 0.1M »)
 * or the time and food fields: the count is always the one it wrote in its hidden `nombre_de_ponte`. At 1 with an
 * empty field, nothing was chosen yet (the game shows the cost of one unit).
 */
export function readOrder(row: LayingRow): Order {
  const doc = row.input.ownerDocument;
  const text = (id: string) => doc.getElementById(`${id}${row.suffix}`)?.textContent ?? "";
  const destination = doc.getElementById(`destination${row.suffix}`) as HTMLInputElement | null;
  const parsed = doc.getElementById(`nombre_de_ponte${row.suffix}`) as HTMLInputElement | null;
  const typed = row.input.value.trim();
  const count = parseGameInteger(parsed?.value);
  return {
    count: typed === "0" || (typed === "" && count <= 1) ? 0 : count,
    food: parseGameInteger(text("cout_nourriture")),
    duration: parseGameDuration(text("cout_temps")) ?? 0,
    destination: row.unitKey ? (DESTINATIONS[destination?.value ?? ""] ?? "nest") : null,
  };
}

export interface LayingContext {
  /** When the layings already queued end (now when none). */
  queueEnd: Date;
  huntingField: number;
  /** Workers already in the laying queue: they will need a cm² too. */
  queuedWorkers: number;
}

/** Workers in the « Pontes en cours » rows (« 224 ouvrières »). */
export const queuedWorkers = (labels: readonly string[]) =>
  labels.reduce((sum, label) => sum + parseGameInteger(/^([\d\s]+)\s+ouvri[eè]res?$/i.exec(label.trim())?.[1]), 0);

/** An order is paid when it is placed, then waits for the queue. */
export function planLaying(order: Order, state: ColonyState, context: LayingContext, now: Date): LayingPlan {
  const affordability = timeToAfford(state, { food: order.food, materials: 0, workers: 0 }, now);
  const paidAt = affordability.kind === "now" ? now : affordability.kind === "at" ? affordability.at : null;
  const start = paidAt ? new Date(Math.max(paidAt.getTime(), context.queueEnd.getTime())) : null;
  const upkeepPerDay = order.destination ? order.food * UPKEEP[order.destination] : 0;
  return {
    affordability,
    endsAt: start ? new Date(start.getTime() + order.duration) : null,
    upkeepPerDay,
    balanceAfter: dailyBalance(state).food - upkeepPerDay,
    idleWorkers: order.destination
      ? null
      : Math.max(0, state.workers + context.queuedWorkers + order.count - context.huntingField),
  };
}

/** Most units of `foodPerUnit` that can be paid by `by`. */
export function maxAffordable(foodPerUnit: number, state: ColonyState, by: Date, now: Date): number {
  if (foodPerUnit <= 0) return 0;
  const payable = (count: number) => {
    const affordability = timeToAfford(state, { food: count * foodPerUnit, materials: 0, workers: 0 }, now);
    return affordability.kind === "now" || (affordability.kind === "at" && affordability.at <= by);
  };
  let low = 0;
  let high = 1;
  while (payable(high) && high < 2 ** 40) {
    low = high;
    high *= 2;
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (payable(middle)) low = middle;
    else high = middle;
  }
  return low;
}

const HOUR = 3_600_000;
/** The longest order the game's slider offers: a week of laying. */
export const MAX_LAYING_MS = 7 * 24 * HOUR;

/** Base laying time of one unit in seconds, by row suffix: the game's `tcaste` on Reine.php, 60 for workers. */
const BASE_SECONDS: Record<string, number> = {
  "": 60,
  "1": 300,
  "2": 450,
  "3": 570,
  "4": 740,
  "5": 1000,
  "6": 1410,
  "7": 1440,
  "8": 1520,
  "9": 1450,
  "10": 1860,
  "11": 2740,
  "12": 2740,
  "13": 2150,
  "14": 1560,
};

/** The player's laying speed (bonuses included), as the page's script applies it: `temps_ponte_base*0.1094…`. */
export function readLayingSpeed(doc: Document): number | null {
  for (const script of doc.querySelectorAll("script:not([src])")) {
    const match = /temps_ponte_base\s*\*\s*(\d+(?:\.\d+)?)/.exec(script.textContent);
    if (match) return Number(match[1]);
  }
  return null;
}

/** What one unit costs. */
export interface UnitCost {
  food: number;
  /** Milliseconds. */
  duration: number;
}

/**
 * One unit's cost: food from what the game shows for the number in `cout_nombre` (one while nothing is chosen), time
 * from its base and the player's speed, as the shown time is rounded (« 33s » for 32.8 s).
 */
export function readUnitCost(row: LayingRow, speed: number | null): UnitCost {
  const doc = row.input.ownerDocument;
  const shown = Math.max(1, parseGameInteger(doc.getElementById(`cout_nombre${row.suffix}`)?.textContent));
  const order = readOrder(row);
  const base = BASE_SECONDS[row.suffix];
  return {
    food: order.food / shown,
    duration: speed && base ? base * speed * 1000 : order.duration / shown,
  };
}

/** A number of units to lay in one click. */
export interface Shortcut {
  label: string;
  count: number;
  /** What it stands for, in a tooltip. */
  title: string;
  /** What limits it, when not the wish itself: « entrepôt plein », « 7 j max ». */
  limit?: string;
  /** Shown instead of a button when there is nothing to lay. */
  empty?: string;
}

export interface ShortcutGroup {
  label: string;
  shortcuts: Shortcut[];
}

export interface ShortcutInput {
  /** Where the units go; null for workers. */
  destination: Place | null;
  unit: UnitCost;
  state: ColonyState;
  context: LayingContext;
  settings: LayingSettings;
  /** When `state` was read. */
  readAt: Date;
  now: Date;
}

/** The next time a Paris clock shows `clock`, strictly after `after`. */
export function nextParisTime(after: Date, clock: { hours: number; minutes: number }): Date {
  const { year, month, day } = parisParts(after);
  const today = fromParisParts({ year, month, day, ...clock });
  return today > after ? today : fromParisParts({ year, month, day: day + 1, ...clock });
}

/**
 * The shortcuts of a row: all the food pays now or within a few hours, a laying of a few hours or ending at the
 * player's return, and the most units whose upkeep keeps the balance at zero (workers: up to the hunting field).
 * Never more than a week of laying, as the game's slider.
 */
export function layingShortcuts(input: ShortcutInput): ShortcutGroup[] {
  const { unit, state, context, settings, readAt, now } = input;
  const week = unit.duration > 0 ? Math.floor(MAX_LAYING_MS / unit.duration) : Infinity;
  const cap = (count: number) => Math.max(0, Math.min(Math.floor(count), week));
  const capacity = state.capacities?.food ?? Infinity;
  const payable = (hours: number) => {
    const count = cap(maxAffordable(unit.food, state, new Date(now.getTime() + hours * HOUR), readAt));
    const limit =
      count >= week ? "7 j max" : unit.food > 0 && (count + 1) * unit.food > capacity ? "entrepôt plein" : undefined;
    return { count, limit };
  };
  // Nearest to the wish: « jusqu'à 8 h 00 » ends at 8 h 00, not 7 h 59.
  const lasting = (ms: number) => {
    const count = cap(unit.duration > 0 ? Math.round(ms / unit.duration) : 0);
    return { count, limit: count >= week ? "7 j max" : undefined };
  };

  const start = new Date(Math.max(now.getTime(), context.queueEnd.getTime()));
  const returnAt = nextParisTime(start, settings.returnAt);
  const groups: ShortcutGroup[] = [
    {
      label: "Tout payer",
      // Once the warehouse caps them, later delays give the same number: only the first is kept.
      shortcuts: [
        {
          label: "maintenant",
          ...payable(0),
          title: "Tout ce que la nourriture paie maintenant.",
          empty: "rien de payable maintenant",
        },
        ...settings.payDelays.map((hours) => ({
          label: `dans ${String(hours)} h`,
          ...payable(hours),
          title: `Tout ce que la nourriture paiera dans ${String(hours)} h, récoltes et entretien compris.`,
        })),
      ].filter((shortcut, index, all) => index === 0 || shortcut.count !== all[index - 1]?.count),
    },
    {
      label: "Durée de ponte",
      shortcuts: [
        ...settings.durations.map((hours) => ({
          label: `${String(hours)} h`,
          ...lasting(hours * HOUR),
          title: `Une ponte de ${String(hours)} h.`,
        })),
        {
          label: `jusqu'à ${formatEndTimeShort(returnAt, now)}`,
          ...lasting(returnAt.getTime() - start.getTime()),
          title: "Une ponte qui finit à l'heure choisie dans les réglages, après la file en cours.",
        },
      ],
    },
  ];
  if (input.destination) {
    const upkeepPerUnit = unit.food * UPKEEP[input.destination];
    const balance = dailyBalance(state).food;
    groups.push({
      label: "Entretien",
      shortcuts: [
        {
          label: "bilan à zéro",
          count: cap(balance > 0 && upkeepPerUnit > 0 ? balance / upkeepPerUnit : 0),
          title: "Le plus d'unités dont l'entretien laisse un bilan de nourriture positif ou nul.",
          empty: "bilan déjà négatif",
        },
      ],
    });
  } else {
    const idle = state.workers + context.queuedWorkers - context.huntingField;
    groups.push({
      label: "Terrain",
      shortcuts: [
        {
          label: "jusqu'au TDC",
          count: cap(-idle),
          title: "Une ouvrière par cm² de TDC, file de ponte comprise : au-delà, elles ne récoltent rien.",
          empty: `TDC plein, ${formatNumber(Math.max(0, idle))} sans travail`,
        },
      ],
    });
  }
  return groups;
}
