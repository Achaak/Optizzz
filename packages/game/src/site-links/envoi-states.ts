// The state categories of the Envois (docs/features/site-envois.md): Production, Chasses, Armée, Niveaux et chantiers.
// One encrypted row per Joueur and category, holding the latest reading and the one before it (to show what changed).
// The army by unit travels in a second encrypted blob of the same row, which the site hands to the space's Admins
// only. Readers turn a state into the shared state of « Partage » (../sharing/shared-state.ts), merged with the
// states pasted from Discord.
import { z } from "zod";
import { HARVESTS_PER_DAY } from "../forecast";
import { BUILDINGS, RESEARCH, type BuildingKey, type ResearchKey } from "../levels";
import type { MemberStates, SharedArmy, SharedState } from "../sharing/shared-state";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const STATE_CATEGORIES = ["production", "hunts", "army", "levels"] as const;
export type StateCategory = (typeof STATE_CATEGORIES)[number];

export const isStateCategory = (value: unknown): value is StateCategory =>
  typeof value === "string" && (STATE_CATEGORIES as readonly string[]).includes(value);

/** A state not sent again for this long goes from the site: the member stopped sending, or playing. */
export const STATES_KEPT_MS = 90 * DAY;

/** An unchanged reading is sent again, dated anew, after this long: its age stays true on the readers' side. */
export const STATE_REFRESH_MS = 6 * HOUR;

const count = z.number().int().nonnegative();
const time = z.number().int().nonnegative();
const pseudo = z.string().min(1).max(40);

const PRODUCTION_READING = z.object({
  huntingField: count,
  workers: count,
  foodWorkers: count,
  materialWorkers: count,
  mushroomPerDay: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1),
  master: pseudo.nullable(),
  /** Null when colonies.php was never read. */
  colonies: z
    .array(z.object({ pseudo, since: time, food: count, materials: count }))
    .max(100)
    .nullable(),
});

const HUNTS_READING = z.object({ hunts: z.array(z.object({ returnsAt: time, fieldGain: count })).max(100) });

const ARMY_READING = z.object({ total: count, incomplete: z.boolean(), returnsAt: time.nullable() });

const levelsOf = <K extends string>(keys: readonly K[]) =>
  z.partialRecord(z.enum(keys as unknown as [K, ...K[]]), count).nullable();

const LEVELS_READING = z.object({
  /** Null when construction.php (or laboratoire.php) was never read. */
  buildings: levelsOf<BuildingKey>(BUILDINGS.map((b) => b.key)),
  research: levelsOf<ResearchKey>(RESEARCH.map((r) => r.key)),
  works: z
    .array(z.object({ name: z.string().min(1).max(60), level: count, endsAt: time }))
    .max(40)
    .nullable(),
});

const READINGS = {
  production: PRODUCTION_READING,
  hunts: HUNTS_READING,
  army: ARMY_READING,
  levels: LEVELS_READING,
} as const;

export type ProductionReading = z.infer<typeof PRODUCTION_READING>;
export type HuntsReading = z.infer<typeof HUNTS_READING>;
export type ArmyReading = z.infer<typeof ARMY_READING>;
export type LevelsReading = z.infer<typeof LEVELS_READING>;
export type StateReading<C extends StateCategory = StateCategory> = z.infer<(typeof READINGS)[C]>;

/** The Admins' blob of an Armée Envoi « Par unité »: the units by key (« JSN »…). */
export const ARMY_UNITS = z.object({ units: z.record(z.string().min(1).max(8), count) });
export type ArmyUnits = z.infer<typeof ARMY_UNITS>;

/** Inside the encryption: who, the latest reading, and the one before it with its own date. */
export interface StateItem<C extends StateCategory = StateCategory> {
  pseudo: string;
  reading: StateReading<C>;
  previous: { observedAt: number; reading: StateReading<C> } | null;
}

export function stateItemSchema<C extends StateCategory>(category: C): z.ZodType<StateItem<C>> {
  const reading = READINGS[category];
  return z.object({
    pseudo,
    reading,
    previous: z.object({ observedAt: time, reading }).nullable(),
  }) as unknown as z.ZodType<StateItem<C>>;
}

/** The identity the fingerprint is drawn from: one row per Joueur and category. */
export const stateIdentity = (server: string, category: StateCategory) => ["state", server, category].join("|");

export interface DatedItem<C extends StateCategory = StateCategory> {
  observedAt: number;
  item: StateItem<C>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The item to send after a new reading: the last one sent as it is while the reading does not change (dated anew
 * after STATE_REFRESH_MS), otherwise the new reading with the last one as its previous.
 */
export function nextStateItem<C extends StateCategory>(
  who: string,
  reading: StateReading<C>,
  observedAt: number,
  last: DatedItem<C> | null,
): DatedItem<C> {
  if (last && same(last.item.reading, reading)) {
    if (observedAt - last.observedAt < STATE_REFRESH_MS) return last;
    return { observedAt, item: { ...last.item, pseudo: who } };
  }
  return {
    observedAt,
    item: {
      pseudo: who,
      reading,
      previous: last ? { observedAt: last.observedAt, reading: last.item.reading } : null,
    },
  };
}

export interface ProductionPerDay {
  /** Harvested a day, mushroom farm included, before the colonizer's tax. */
  harvest: number;
  /** What the colonizer takes a day, rounded down as the game does. */
  taxPaid: number;
  /** What the colonies bring a day, on average since each was taken. */
  colonies: number;
  /** False when colonies.php was never read, or a colony was taken less than an hour ago. */
  coloniesKnown: boolean;
  /** The Production of GLOSSARY.md. */
  total: number;
}

/**
 * The Production of GLOSSARY.md: what a member harvests a day, less the tax they pay their colonizer, plus what their
 * colonies pay them (on average since each was taken, from colonies.php).
 */
export function productionPerDay(
  production: Pick<ProductionReading, "foodWorkers" | "materialWorkers" | "mushroomPerDay" | "taxRate"> & {
    colonies: readonly { since: number | Date; food: number; materials: number }[] | null;
  },
  now: Date,
): ProductionPerDay {
  const harvest = Math.round(
    (production.foodWorkers + production.materialWorkers) * HARVESTS_PER_DAY + production.mushroomPerDay,
  );
  const taxPaid = Math.floor(harvest * production.taxRate);
  let colonies = 0;
  let coloniesKnown = production.colonies !== null;
  for (const colony of production.colonies ?? []) {
    const held = now.getTime() - new Date(colony.since).getTime();
    if (held < HOUR) {
      coloniesKnown = false;
      continue;
    }
    colonies += ((colony.food + colony.materials) * DAY) / held;
  }
  colonies = Math.round(colonies);
  return { harvest, taxPaid, colonies, coloniesKnown, total: harvest - taxPaid + colonies };
}

/** The parts of a shared state a reading gives. */
function partsOf<C extends StateCategory>(
  category: C,
  reading: StateReading<C>,
  units: Record<string, number> | null,
): Partial<SharedState> {
  switch (category) {
    case "production": {
      const r = reading as ProductionReading;
      return {
        huntingField: r.huntingField,
        workers: r.workers,
        production: {
          foodWorkers: r.foodWorkers,
          materialWorkers: r.materialWorkers,
          mushroomPerDay: r.mushroomPerDay,
          taxRate: r.taxRate,
          master: r.master,
          colonies: r.colonies?.map((c) => ({ ...c, since: new Date(c.since) })) ?? null,
        },
      };
    }
    case "hunts":
      return {
        hunts: (reading as HuntsReading).hunts.map((h) => ({
          fieldGain: h.fieldGain,
          returnsAt: new Date(h.returnsAt),
        })),
      };
    case "army": {
      const r = reading as ArmyReading;
      const army: SharedArmy = { total: r.total, incomplete: r.incomplete };
      if (r.returnsAt !== null) army.returnsAt = new Date(r.returnsAt);
      if (units) army.units = units;
      return { army };
    }
    default: {
      const r = reading as LevelsReading;
      return {
        ...(r.buildings && { buildings: r.buildings }),
        ...(r.research && { research: r.research }),
        ...(r.works && { works: r.works.map((w) => ({ ...w, endsAt: new Date(w.endsAt) })) }),
      };
    }
  }
}

/**
 * A state Envoi, opened, as the member's states of « Partage »: the latest reading and the one before it. `units`, the
 * Admins' blob of an army sent « Par unité », goes with the latest reading only (null for the other members).
 */
export function stateOfEnvoi<C extends StateCategory>(
  category: C,
  opened: DatedItem<C>,
  units: Record<string, number> | null,
  context: { server: string; alliance: string },
): MemberStates {
  const base = { server: context.server, alliance: context.alliance, pseudo: opened.item.pseudo };
  const latest: SharedState = {
    ...base,
    readAt: new Date(opened.observedAt),
    ...partsOf(category, opened.item.reading, units),
  };
  const before = opened.item.previous;
  if (!before) return { latest };
  return {
    latest,
    previous: { ...base, readAt: new Date(before.observedAt), ...partsOf(category, before.reading, null) },
  };
}
