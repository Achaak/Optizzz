// Income figures of Ressources.php, read in the background and cached per server.
import { storage } from "wxt/utils/storage";
import { readIncome, type Income } from "./pages";

/** Beyond this, the figures read on Ressources.php are read again. */
export const INCOME_MAX_AGE = 15 * 60_000;

/** Storage keeps JSON: dates are stored as timestamps. */
interface StoredIncome extends Omit<Income, "nextHarvestAt" | "hunts"> {
  readAt: number;
  nextHarvestAt: number;
  hunts: { returnsAt: number; fieldGain: number }[];
}

const cacheKey = (origin: string) => `local:resourceForecast:${new URL(origin).host}:income` as const;

/** Keeps figures read on Ressources.php itself, so other pages need not read it again. */
export async function storeIncome(origin: string, income: Income, readAt: Date): Promise<void> {
  const stored: StoredIncome = {
    ...income,
    readAt: readAt.getTime(),
    nextHarvestAt: income.nextHarvestAt.getTime(),
    hunts: income.hunts.map((hunt) => ({ ...hunt, returnsAt: hunt.returnsAt.getTime() })),
  };
  await storage.setItem(cacheKey(origin), stored);
}

function restore(stored: StoredIncome): Income {
  return {
    foodWorkers: stored.foodWorkers,
    materialWorkers: stored.materialWorkers,
    mushroomPerDay: stored.mushroomPerDay,
    armyPerDay: stored.armyPerDay,
    taxRate: stored.taxRate,
    newWorkersGoTo: stored.newWorkersGoTo,
    nextHarvestAt: new Date(stored.nextHarvestAt),
    hunts: stored.hunts.map((hunt) => ({ ...hunt, returnsAt: new Date(hunt.returnsAt) })),
  };
}

/**
 * Income of the logged-in player on `origin` (e.g. "https://s5.fourmizzz.fr"): the cached figures when
 * younger than `maxAge`, otherwise Ressources.php read again (the session cookie goes with the request).
 */
export async function loadIncome(origin: string, maxAge: number, now: Date): Promise<Income | null> {
  const cached = await storage.getItem<StoredIncome>(cacheKey(origin));
  if (cached && now.getTime() - cached.readAt < maxAge) return restore(cached);

  try {
    const response = await fetch(`${origin}/Ressources.php`);
    if (!response.ok) throw new Error(`Fourmizzz: ${String(response.status)} on Ressources.php`);
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const income = readIncome(doc, now);
    if (!income) throw new Error("Fourmizzz: no income on Ressources.php");
    await storeIncome(origin, income, now);
    return income;
  } catch (error) {
    if (cached) return restore(cached);
    throw error;
  }
}
