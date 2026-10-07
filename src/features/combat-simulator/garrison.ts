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
}

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
  const field = Number(doc.querySelector("#quantite_tdc")?.textContent.replace(/\D/g, "") ?? 0);
  return { armies, dome: level("Dôme"), lodge: level("Loge"), field };
}

const key = (origin: string) => `local:combatSimulator:${new URL(origin).host}:garrison` as const;

interface StoredGarrison extends Garrison {
  readAt: number;
}

// The server opened last, for the toolbar popup which does not know where the player is.
const LAST_SERVER_KEY = "local:combatSimulator:lastServer";

export async function storeGarrison(origin: string, garrison: Garrison, readAt: Date): Promise<void> {
  await storage.setItem<StoredGarrison>(key(origin), { ...garrison, readAt: readAt.getTime() });
  await storage.setItem(LAST_SERVER_KEY, new URL(origin).host);
}

export function loadLastServer(): Promise<string | null> {
  return storage.getItem<string>(LAST_SERVER_KEY);
}

export async function loadGarrison(origin: string): Promise<(Garrison & { readAt: Date }) | null> {
  const stored = await storage.getItem<StoredGarrison>(key(origin));
  return stored ? { ...stored, readAt: new Date(stored.readAt) } : null;
}
