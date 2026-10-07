// Forecasting the colony's stock: harvests every 30 minutes, mushrooms and army upkeep in between.
// Game rules: docs/research/ressources-et-entretien.md.
import type { WorkQueue } from "../work-queue/queue";
import type { Capacities, Cost, Income } from "./pages";

export interface ColonyState extends Income {
  food: number;
  materials: number;
  workers: number;
  capacities: Capacities | null;
}

export type Resource = "food" | "materials";

export type Affordability =
  | { kind: "now" }
  | { kind: "at"; at: Date; blocking: Resource }
  | { kind: "never" }
  | { kind: "warehouse"; resource: Resource; capacity: number }
  | { kind: "workers"; missing: number };

const HARVEST_INTERVAL = 30 * 60_000;
export const HARVESTS_PER_DAY = 48;
const DAY = 24 * 60 * 60_000;
/** Far enough that « plus de 30 j » covers everything left; beyond, the forecast says « never ». */
const HORIZON = 365 * DAY;

/** A stretch of time with no harvest or hunt return: food moves linearly, materials stay put. */
interface Segment {
  start: number;
  end: number;
  /** Stock at the start of the segment, after that instant's harvest or hunt return. */
  food: number;
  materials: number;
  /** Food per millisecond: mushrooms after tax, minus army upkeep. */
  foodRate: number;
  foodCapacity: number;
  materialCapacity: number;
}

function* segments(state: ColonyState, now: Date): Generator<Segment> {
  const keep = 1 - state.taxRate;
  const foodRate = (state.mushroomPerDay * keep - state.armyPerDay) / DAY;
  const foodCapacity = state.capacities?.food ?? Infinity;
  const materialCapacity = state.capacities?.materials ?? Infinity;
  const hunts = [...state.hunts].sort((a, b) => a.returnsAt.getTime() - b.returnsAt.getTime());

  let { food, materials, foodWorkers, materialWorkers } = state;
  let idle = Math.max(0, state.workers - foodWorkers - materialWorkers);
  let t = now.getTime();
  const horizon = t + HORIZON;
  // The stock is current but the income may have been read a while ago: harvests already gathered
  // are in the stock, and hunts already back have put their workers to work.
  let harvestAt = state.nextHarvestAt.getTime();
  while (harvestAt < t) harvestAt += HARVEST_INTERVAL;
  /** A hunt back home: idle workers start harvesting on the new land, where Compte+ sends them. */
  const hire = (fieldGain: number) => {
    const hired = Math.min(fieldGain, idle);
    idle -= hired;
    if (state.newWorkersGoTo === "food") foodWorkers += hired;
    if (state.newWorkersGoTo === "materials") materialWorkers += hired;
  };
  while (hunts[0] && hunts[0].returnsAt.getTime() < t) hire(hunts.shift()?.fieldGain ?? 0);

  while (t < horizon) {
    const hunt = hunts[0];
    const end = Math.min(harvestAt, hunt?.returnsAt.getTime() ?? Infinity);
    yield { start: t, end, food, materials, foodRate, foodCapacity, materialCapacity };

    food = Math.min(foodCapacity, Math.max(0, food + foodRate * (end - t)));
    t = end;
    if (hunt?.returnsAt.getTime() === t) hire(hunts.shift()?.fieldGain ?? 0);
    if (harvestAt === t) {
      food = Math.min(foodCapacity, food + foodWorkers * keep);
      materials = Math.min(materialCapacity, materials + materialWorkers * keep);
      harvestAt += HARVEST_INTERVAL;
    }
  }
}

/** When the stock will cover `cost`, each item on its own from the current stock. */
export function timeToAfford(state: ColonyState, cost: Cost, now: Date): Affordability {
  if (cost.workers > state.workers) return { kind: "workers", missing: cost.workers - state.workers };
  for (const resource of ["food", "materials"] as const) {
    const capacity = state.capacities?.[resource];
    if (capacity !== undefined && cost[resource] > capacity) return { kind: "warehouse", resource, capacity };
  }
  if (state.food >= cost.food && state.materials >= cost.materials) return { kind: "now" };

  for (const segment of segments(state, now)) {
    if (segment.materials < cost.materials) continue;
    if (segment.food >= cost.food) {
      return { kind: "at", at: new Date(segment.start), blocking: blockingResource(state, cost) };
    }
    if (segment.foodRate > 0) {
      const reachedAt = segment.start + (cost.food - segment.food) / segment.foodRate;
      if (reachedAt < segment.end) return { kind: "at", at: new Date(reachedAt), blocking: "food" };
    }
  }
  return { kind: "never" };
}

/** The resource that was missing; materials win when both were, as they only come by harvest. */
function blockingResource(state: ColonyState, cost: Cost): Resource {
  return state.materials < cost.materials ? "materials" : "food";
}

export interface Outlook {
  famineAt: Date | null;
  foodFullAt: Date | null;
  materialsFullAt: Date | null;
}

/** When food runs out and when each warehouse fills up, if ever. */
export function outlook(state: ColonyState, now: Date): Outlook {
  const result: Outlook = { famineAt: null, foodFullAt: null, materialsFullAt: null };
  for (const segment of segments(state, now)) {
    const { start, end, food, foodRate } = segment;
    if (!result.famineAt && foodRate < 0) {
      const emptyAt = start + food / -foodRate;
      if (emptyAt < end) result.famineAt = new Date(emptyAt);
    }
    if (!result.foodFullAt && Number.isFinite(segment.foodCapacity)) {
      if (food >= segment.foodCapacity) result.foodFullAt = new Date(start);
      else if (foodRate > 0) {
        const fullAt = start + (segment.foodCapacity - food) / foodRate;
        if (fullAt < end) result.foodFullAt = new Date(fullAt);
      }
    }
    if (!result.materialsFullAt && segment.materials >= segment.materialCapacity) {
      result.materialsFullAt = new Date(start);
    }
    if (result.famineAt && result.foodFullAt && result.materialsFullAt) break;
  }
  return result;
}

/** The colony with `foodWorkers` harvesting food and `materialWorkers` harvesting materials. */
export function withSplit(state: ColonyState, foodWorkers: number, materialWorkers: number): ColonyState {
  return { ...state, foodWorkers, materialWorkers };
}

/** `total` workers (by default those working now) split: `foodWorkers` on food, the rest on materials. */
export function withFoodWorkers(
  state: ColonyState,
  foodWorkers: number,
  total = state.foodWorkers + state.materialWorkers,
): ColonyState {
  const food = Math.min(total, Math.max(0, foodWorkers));
  return withSplit(state, food, total - food);
}

/** Fewest food workers (the rest on materials) for food never to run out, or null if none suffice. */
export function balancedFoodWorkers(
  state: ColonyState,
  now: Date,
  total = state.foodWorkers + state.materialWorkers,
): number | null {
  const starves = (foodWorkers: number) => outlook(withFoodWorkers(state, foodWorkers, total), now).famineAt !== null;
  let low = 0;
  let high = total;
  if (starves(high)) return null;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (starves(middle)) low = middle + 1;
    else high = middle;
  }
  return low;
}

export interface Forecast {
  affordability: Affordability;
  /** When the item can be started; null when it can now, or never. */
  readyAt: Date | null;
  blockedBy: "resources" | "queue" | null;
}

/**
 * When an item can be started: an item put in the queue is paid at once, so a free slot only waits for
 * resources, while a full queue also waits for its first item to end.
 */
export function forecastFor(state: ColonyState, cost: Cost, queue: WorkQueue | null, now: Date): Forecast {
  const affordability = timeToAfford(state, cost, now);
  const slotFreeAt = queue?.full ? (queue.items[0]?.endsAt ?? null) : null;

  if (affordability.kind === "now") {
    return slotFreeAt
      ? { affordability, readyAt: slotFreeAt, blockedBy: "queue" }
      : { affordability, readyAt: null, blockedBy: null };
  }
  if (affordability.kind !== "at") return { affordability, readyAt: null, blockedBy: null };
  if (slotFreeAt && slotFreeAt > affordability.at) {
    return { affordability, readyAt: slotFreeAt, blockedBy: "queue" };
  }
  return { affordability, readyAt: affordability.at, blockedBy: "resources" };
}

/** Resources gained per day with the current split: after the colony tax, food minus army upkeep. */
export function dailyBalance(state: ColonyState): Record<Resource, number> {
  const keep = 1 - state.taxRate;
  return {
    food: (state.foodWorkers * HARVESTS_PER_DAY + state.mushroomPerDay) * keep - state.armyPerDay,
    materials: state.materialWorkers * HARVESTS_PER_DAY * keep,
  };
}
