// The readings of the state Envois (docs/features/site-envois.md), from what the game's pages showed (state-pages.ts):
// each is dated by the newest page it is made of, and is null while a page it needs was never read.
import type {
  ArmyReading,
  HuntsReading,
  LevelsReading,
  ProductionReading,
  StateCategory,
  StateReading,
} from "@optizzz/game/site-links/envoi-states";
import type { StatePages } from "@/data/state-pages";

type Units = Record<string, number>;

export interface Read<C extends StateCategory> {
  observedAt: number;
  reading: StateReading<C>;
  /** The army by unit (« Par unité »): for the Admins' blob. */
  units?: Units;
}

const newest = (...parts: ({ readAt: number } | undefined)[]) => Math.max(0, ...parts.map((part) => part?.readAt ?? 0));

function production(pages: StatePages): Read<"production"> | null {
  const { stock, ressources, colonies } = pages;
  if (!stock || !ressources) return null;
  const reading: ProductionReading = {
    huntingField: stock.huntingField,
    workers: stock.workers,
    foodWorkers: ressources.foodWorkers,
    materialWorkers: ressources.materialWorkers,
    mushroomPerDay: ressources.mushroomPerDay,
    taxRate: ressources.taxRate,
    master: colonies?.master ?? null,
    colonies:
      colonies?.colonies.map((c) => ({
        pseudo: c.pseudo,
        since: c.since ?? colonies.readAt,
        food: c.food,
        materials: c.materials,
      })) ?? null,
  };
  if (stock.food !== undefined && stock.materials !== undefined)
    reading.stock = { food: stock.food, materials: stock.materials, at: stock.readAt };
  return { observedAt: newest(stock, ressources, colonies), reading };
}

function hunts(pages: StatePages, now: Date): Read<"hunts"> | null {
  const { ressources } = pages;
  if (!ressources) return null;
  const reading: HuntsReading = {
    hunts: ressources.hunts
      .filter((hunt) => hunt.returnsAt > now.getTime())
      .map(({ returnsAt, fieldGain }) => ({ returnsAt, fieldGain })),
  };
  return { observedAt: ressources.readAt, reading };
}

/**
 * The army present (Armee.php), plus what is known of the troops away, as « Mon état » counts it: hunts with their
 * troops (Compte+), the troops occupying the colonies or coming back from them, the ants of the attacks the Plan de
 * flood noted. Anything else away makes it incomplete. Hunts and returns already past are home again.
 */
function army(pages: StatePages, now: Date): Read<"army"> | null {
  const { armee, ressources, colonies } = pages;
  if (!armee) return null;
  const at = now.getTime();
  const counts = new Map<string, number>();
  const add = (units: Units) => {
    for (const [key, count] of Object.entries(units)) counts.set(key, (counts.get(key) ?? 0) + count);
  };
  add(armee.units);
  const away = (ressources?.hunts ?? []).filter((hunt) => hunt.returnsAt > at);
  for (const hunt of away) if (hunt.troops) add(hunt.troops);
  for (const colony of colonies?.colonies ?? []) add(colony.troops);
  const coming = armee.coming.filter((line) => line.arrivesAt > at);
  for (const line of coming) if (line.units) add(line.units);

  const units = Object.fromEntries([...counts].filter(([, count]) => count > 0));
  const returns = [...away.map((hunt) => hunt.returnsAt), ...coming.map((line) => line.arrivesAt)];
  const reading: ArmyReading = {
    total: Object.values(units).reduce((sum, count) => sum + count, 0) + armee.attackAnts,
    incomplete:
      armee.unknownAttacks > 0 ||
      away.some((hunt) => hunt.troops === null) ||
      !colonies ||
      coming.some((line) => line.units === null),
    returnsAt: returns.length > 0 ? Math.max(...returns) : null,
  };
  return { observedAt: newest(armee, ressources, colonies), reading, units };
}

function levels(pages: StatePages): Read<"levels"> | null {
  const { construction, laboratory } = pages;
  if (!construction && !laboratory) return null;
  const reading: LevelsReading = {
    buildings: construction?.levels ?? null,
    research: laboratory?.levels ?? null,
    works: [...(construction?.works ?? []), ...(laboratory?.works ?? [])],
  };
  if (construction?.capacities) reading.capacities = construction.capacities;
  return { observedAt: newest(construction, laboratory), reading };
}

/** The reading of `category` from what the pages showed, or null while a page it needs was never read. */
export function stateReading<C extends StateCategory>(category: C, pages: StatePages, now: Date): Read<C> | null {
  const read = {
    production: () => production(pages),
    hunts: () => hunts(pages, now),
    army: () => army(pages, now),
    levels: () => levels(pages),
  }[category];
  return read() as Read<C> | null;
}
