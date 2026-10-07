// Laying on Reine.php: when an order ends, when it can be paid, what it costs a day. Structure of the page:
// docs/research/fourmizzz-pages.md (« Reine.php »); upkeep: docs/research/ressources-et-entretien.md.
import type { Place } from "@/game/army/battle";
import { UNITS } from "@/game/army/units";
import { dailyBalance, timeToAfford, type Affordability, type ColonyState } from "../resource-forecast/forecast";
import { parseGameDuration } from "../work-queue/queue";

/** One unit's laying form: its elements carry the row's suffix ("" for workers, "1" for `unite1`…). */
export interface LayingRow {
  suffix: string;
  /** Null for workers. */
  unitKey: string | null;
  input: HTMLInputElement;
  /** The cost cell (`td.cout_amelioration`), where the plan goes. */
  cell: Element;
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

const toInteger = (text: string | null | undefined) => Number((text ?? "").replace(/\D/g, ""));

export function readLayingRows(doc: Document): LayingRow[] {
  return [...doc.querySelectorAll<HTMLInputElement>('input[id^="input_cout_nombre"]')].flatMap((input) => {
    const suffix = input.id.slice("input_cout_nombre".length);
    const type = input.form?.querySelector<HTMLInputElement>('input[name="typeUnite"]')?.value ?? "";
    const unitKey =
      type === "ouvriere" ? null : (UNITS.find((unit) => `unite${String(unit.field)}` === type)?.key ?? null);
    // The field sits in a table inside the form: the plan goes in the cost cell, outside the form.
    const cell = input.form?.closest("td") ?? input.closest("td");
    if (!cell || (type !== "ouvriere" && !unitKey)) return [];
    return [{ suffix, unitKey, input, cell }];
  });
}

/**
 * The number typed and what the game computed for it; an empty field orders nothing. The field takes « 2k » or
 * « 0.1M »: the count is the one the game wrote in its hidden `nombre_de_ponte`.
 */
export function readOrder(row: LayingRow): Order {
  const doc = row.input.ownerDocument;
  const text = (id: string) => doc.getElementById(`${id}${row.suffix}`)?.textContent ?? "";
  const destination = doc.getElementById(`destination${row.suffix}`) as HTMLInputElement | null;
  const parsed = doc.getElementById(`nombre_de_ponte${row.suffix}`) as HTMLInputElement | null;
  const typed = row.input.value.trim();
  return {
    count: typed === "" || typed === "0" ? 0 : toInteger(parsed?.value),
    food: toInteger(text("cout_nourriture")),
    duration: parseGameDuration(text("cout_temps")) ?? 0,
    destination: row.unitKey ? (DESTINATIONS[destination?.value ?? ""] ?? "nest") : null,
  };
}

export interface LayingContext {
  /** When the layings already queued end (now when none). */
  queueEnd: Date;
  huntingField: number;
}

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
    idleWorkers: order.destination ? null : Math.max(0, state.workers + order.count - context.huntingField),
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
