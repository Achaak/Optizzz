// The player's army by place, read on Armee.php (docs/research/fourmizzz-pages.md, « Armee.php »).
import { storage } from "wxt/utils/storage";
import type { Place } from "@/game/army/battle";
import { emptyArmy, UNITS } from "@/game/army/units";

export interface Garrison {
  armies: Record<Place, number[]>;
  dome: number;
  lodge: number;
  /** The player's hunting field (header). */
  field: number;
  /** The player's stock (header): what an attack on the nest could loot. */
  food?: number;
  materials?: number;
}

/** Whether the garrison holds no unit at all, e.g. every unit out hunting. */
export const isEmptyGarrison = (garrison: Pick<Garrison, "armies">) =>
  Object.values(garrison.armies).every((army) => army.every((count) => count === 0));

// Each count is a `<span id="(1200,'unite1',1)">`: count, the unit's `uniteN` field, then the place.
const COUNT_ID = /^\((\d+),'unite(\d+)',(\d)\)$/;
const PLACE_NUMBERS: Record<string, Place> = { "1": "field", "2": "nest", "3": "lodge" };

/** The « Troupes en Garnison » table; null on another page. */
export function readGarrison(doc: Document): Garrison | null {
  const table = [...doc.querySelectorAll("table.simulateur")].find((candidate) =>
    candidate.textContent.includes("Troupes en Garnison"),
  );
  if (!table) return null;

  const armies: Record<Place, number[]> = { field: emptyArmy(), nest: emptyArmy(), lodge: emptyArmy() };
  for (const span of table.querySelectorAll("span[id]")) {
    const [, count, field, placeNumber] = COUNT_ID.exec(span.id) ?? [];
    const unit = UNITS.findIndex((candidate) => String(candidate.field) === field);
    const place = PLACE_NUMBERS[placeNumber ?? ""];
    if (unit >= 0 && place) armies[place][unit] = Number(count);
  }
  const level = (label: string) => Number(new RegExp(`${label} \\((\\d+)\\)`).exec(table.textContent)?.[1] ?? 0);
  const header = (id: string) => {
    const text = doc.querySelector(`#${id}`)?.textContent;
    return text === undefined ? undefined : Number(text.replace(/\D/g, ""));
  };
  return {
    armies,
    dome: level("Dôme"),
    lodge: level("Loge"),
    field: header("quantite_tdc") ?? 0,
    food: header("nb_nourriture"),
    materials: header("nb_materiaux"),
  };
}

const key = (origin: string) => `local:combatSimulator:${new URL(origin).host}:garrison` as const;

interface StoredGarrison extends Garrison {
  readAt: number;
  /** The last army seen with units, kept when the garrison is read empty (army out hunting). */
  previous?: { armies: Record<Place, number[]>; readAt: number };
}

export interface LoadedGarrison extends Garrison {
  readAt: Date;
  previous: { armies: Record<Place, number[]>; readAt: Date } | null;
}

// The server opened last, for the toolbar popup which does not know where the player is.
const LAST_SERVER_KEY = "local:combatSimulator:lastServer";

export async function storeGarrison(origin: string, garrison: Garrison, readAt: Date): Promise<void> {
  const stored = await storage.getItem<StoredGarrison>(key(origin));
  // An empty garrison is stored as it is (the flood plan must not count units away), but the last army seen
  // stays known for the simulator.
  const previous = !isEmptyGarrison(garrison)
    ? undefined
    : stored && !isEmptyGarrison(stored)
      ? { armies: stored.armies, readAt: stored.readAt }
      : stored?.previous;
  await storage.setItem<StoredGarrison>(key(origin), { ...garrison, readAt: readAt.getTime(), previous });
  await storage.setItem(LAST_SERVER_KEY, new URL(origin).host);
}

export function loadLastServer(): Promise<string | null> {
  return storage.getItem<string>(LAST_SERVER_KEY);
}

export async function loadGarrison(origin: string): Promise<LoadedGarrison | null> {
  const stored = await storage.getItem<StoredGarrison>(key(origin));
  if (!stored) return null;
  const { previous, ...garrison } = stored;
  return {
    ...garrison,
    readAt: new Date(stored.readAt),
    previous: previous ? { armies: previous.armies, readAt: new Date(previous.readAt) } : null,
  };
}
