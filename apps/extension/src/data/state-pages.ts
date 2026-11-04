// What the game's pages show of the player's state, kept per server for the state Envois (Production, Chasses, Armée,
// Niveaux et chantiers: docs/features/site-envois.md): collect keeps what the open page shows, when the logged-in
// player checked a category that needs it; the pages a Production needs (Ressources, colonies.php) are also read
// again when a game page opens and they are older than 15 minutes (state-rereads.ts). Never read for itself.
import { storage } from "wxt/utils/storage";
import type { BuildingKey, ResearchKey } from "@optizzz/game/levels";
import { readColonies } from "@optizzz/game/pages/colonies";
import { readBuildingLevels, readResearchLevels } from "@optizzz/game/pages/levels";
import { readCapacities, readIncome, readStock, type Capacities } from "@optizzz/game/pages/resources";
import { readWorkQueue } from "@optizzz/game/pages/work-queue";
import { readTroops, UNITS } from "@optizzz/game/army/units";
import { STATE_CATEGORIES, type StateCategory } from "@optizzz/game/site-links/envoi-states";
import { sendsCategory } from "@/data/envois";
import { readGarrison } from "@/data/garrison";
import { loadLaunches, type Launch } from "@/data/launches";
import { readAttacksOnWay, readReinforcementLines, reconcileLaunches, troopList } from "@/features/flood/attacks";
import { readOngoingHunts } from "@/features/hunt-launcher/pages";
import { huntIdOf } from "@optizzz/game/site-links/envoi-hunts";
import { withStorageLock } from "@/utils/storage-lock";

type Units = Record<string, number>;

interface KeptWork {
  name: string;
  level: number;
  endsAt: number;
}

/** Each page's part, with when it was read (milliseconds since 1970: storage keeps JSON). */
export interface StatePages {
  /** The header of any page (`div#data`); food and materials since the Équilibre (absent from older parts). */
  stock?: { readAt: number; huntingField: number; workers: number; food?: number; materials?: number };
  ressources?: {
    readAt: number;
    foodWorkers: number;
    materialWorkers: number;
    mushroomPerDay: number;
    taxRate: number;
    /**
     * Hunts in progress; their troops with Compte+ only (null without). `id`, the game's number for the hunt (the
     * hunts log), is absent from parts kept before it.
     */
    hunts: { id?: number; returnsAt: number; fieldGain: number; troops: Units | null }[];
  };
  colonies?: {
    readAt: number;
    master: string | null;
    colonies: { pseudo: string; troops: Units; since: number | null; food: number; materials: number }[];
  };
  armee?: {
    readAt: number;
    /** The garrison, all places together. */
    units: Units;
    /** Ants of the attacks on their way that the Plan de flood noted. */
    attackAnts: number;
    /** Attacks on their way the plan did not note: their ants are unknown. */
    unknownAttacks: number;
    /** Troops coming back from a colony; their units with Compte+ only. */
    coming: { arrivesAt: number; units: Units | null }[];
  };
  construction?: {
    readAt: number;
    levels: Partial<Record<BuildingKey, number>>;
    works: KeptWork[];
    /** The warehouses' capacities, null when the page does not give them (absent from older parts). */
    capacities?: Capacities | null;
  };
  laboratory?: { readAt: number; levels: Partial<Record<ResearchKey, number>>; works: KeptWork[] };
}

export type StatePart = keyof StatePages;

/** The parts each state category is made of. */
const PARTS_OF: Record<StateCategory, readonly StatePart[]> = {
  production: ["stock", "ressources", "colonies"],
  hunts: ["ressources"],
  army: ["armee", "ressources", "colonies"],
  levels: ["construction", "laboratory"],
};

/** The page each part is read on (the stock, on any). */
export const PAGE_OF: Record<Exclude<StatePart, "stock">, string> = {
  ressources: "/Ressources.php",
  colonies: "/colonies.php",
  armee: "/Armee.php",
  construction: "/construction.php",
  laboratory: "/laboratoire.php",
};

const units = (counts: Iterable<[string, number]>): Units =>
  Object.fromEntries([...counts].filter(([, count]) => count > 0));

const works = (doc: Document, now: Date): KeptWork[] =>
  readWorkQueue(doc, now).items.map((item) => ({
    name: item.name,
    level: item.targetLevel,
    endsAt: item.endsAt.getTime(),
  }));

/**
 * The parts `doc`, the game's page at `path` (lower case), shows of those `wanted`: nothing when it is not a
 * logged-in game page. `launches` are the attacks the Plan de flood noted, for the army away.
 */
export function readStatePages(
  doc: Document,
  path: string,
  wanted: ReadonlySet<StatePart>,
  launches: readonly Launch[],
  now: Date,
): StatePages {
  const stock = readStock(doc);
  if (!stock) return {};
  const readAt = now.getTime();
  const read: StatePages = {};
  if (wanted.has("stock"))
    read.stock = {
      readAt,
      huntingField: stock.huntingField,
      workers: stock.workers,
      food: stock.food,
      materials: stock.materials,
    };
  if (wanted.has("ressources") && path === "/ressources.php") {
    const income = readIncome(doc, now);
    if (income)
      read.ressources = {
        readAt,
        foodWorkers: income.foodWorkers,
        materialWorkers: income.materialWorkers,
        mushroomPerDay: income.mushroomPerDay,
        taxRate: income.taxRate,
        hunts: readOngoingHunts(doc, now).map((hunt) => {
          const id = huntIdOf(hunt.id);
          return {
            ...(id !== null && { id }),
            returnsAt: hunt.returnsAt.getTime(),
            fieldGain: hunt.fieldGain,
            troops: hunt.troops && units(Object.entries(hunt.troops)),
          };
        }),
      };
  }
  if (wanted.has("colonies") && path === "/colonies.php") {
    const page = readColonies(doc);
    read.colonies = {
      readAt,
      master: page.master,
      colonies: page.colonies.map((colony) => ({
        pseudo: colony.pseudo,
        troops: units(Object.entries(colony.troops)),
        since: colony.heldFor === null ? null : readAt - colony.heldFor,
        food: colony.brought?.food ?? 0,
        materials: colony.brought?.materials ?? 0,
      })),
    };
  }
  if (wanted.has("armee") && path === "/armee.php") {
    const garrison = readGarrison(doc);
    if (garrison) {
      const counts = new Map<string, number>();
      const add = (key: string, count: number) => counts.set(key, (counts.get(key) ?? 0) + count);
      for (const army of Object.values(garrison.armies)) army.forEach((count, i) => add(UNITS[i]?.key ?? "", count));
      const onWay = reconcileLaunches([...launches], readAttacksOnWay(doc, now));
      read.armee = {
        readAt,
        units: units(counts),
        attackAnts: onWay.launches.reduce((sum, launch) => sum + launch.ants, 0),
        unknownAttacks: onWay.unknown,
        coming: readReinforcementLines(doc, now).map((line) => ({
          arrivesAt: line.arrivesAt.getTime(),
          units: line.troops === null ? null : units(Object.entries(readTroops(troopList(line.troops)))),
        })),
      };
    }
  }
  if (wanted.has("construction") && path === "/construction.php")
    read.construction = {
      readAt,
      levels: readBuildingLevels(doc),
      works: works(doc, now),
      capacities: readCapacities(doc),
    };
  if (wanted.has("laboratory") && path === "/laboratoire.php")
    read.laboratory = { readAt, levels: readResearchLevels(doc), works: works(doc, now) };
  return read;
}

/** The parts the game's logged-in player needs for the state categories they send on this server. */
export async function wantedParts(origin: string, pseudo: string): Promise<Set<StatePart>> {
  const wanted = new Set<StatePart>();
  for (const category of STATE_CATEGORIES)
    if (await sendsCategory(origin, pseudo, category)) for (const part of PARTS_OF[category]) wanted.add(part);
  return wanted;
}

/** Keeps what `doc`, the game's page at `path`, shows of the parts `wanted` (from the page open, or read again). */
export async function keepStateOfPage(
  origin: string,
  doc: Document,
  path: string,
  wanted: ReadonlySet<StatePart>,
  now: Date,
): Promise<void> {
  if (wanted.size === 0) return;
  const launches = wanted.has("armee") && path === "/armee.php" ? await loadLaunches(origin, now) : [];
  await keepStatePages(origin, readStatePages(doc, path, wanted, launches, now));
}

const key = (origin: string) => `local:envoiStates:${new URL(origin).host}` as const;

export async function loadStatePages(origin: string): Promise<StatePages> {
  return (await storage.getItem<StatePages>(key(origin))) ?? {};
}

/** Keeps the parts read, each in place of the one before. */
export function keepStatePages(origin: string, read: StatePages): Promise<void> {
  if (Object.keys(read).length === 0) return Promise.resolve();
  return withStorageLock(key(origin), async () => {
    await storage.setItem<StatePages>(key(origin), { ...(await loadStatePages(origin)), ...read });
  });
}
