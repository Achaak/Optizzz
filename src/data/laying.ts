// The player's laying speed and the units they can lay, read on Reine.php: the research advice needs them on
// laboratoire.php. Kept when the player opens Reine.php, read in the background when unknown or old.
import { storage } from "wxt/utils/storage";
import { readLayableUnits, readLayingSpeed } from "@/game/pages/queen";
import { fetchGamePage } from "@/utils/game-page";

export interface Laying {
  /** Factor applied to each unit's base laying time, bonuses included. */
  speed: number;
  /** Keys of the units the player can lay. */
  units: string[];
}

export interface StoredLaying extends Laying {
  readAt: Date;
}

/** The speed changes with Couveuse, Solarium and Technique de ponte: past this age, Reine.php is read again. */
export const LAYING_MAX_AGE = 12 * 60 * 60_000;

// « v2 »: the first version also kept the locked units.
const key = (origin: string) => `local:laying:v2:${new URL(origin).host}` as const;

/** What Reine.php shows; null on another page or when its script has no speed. */
export function readLaying(doc: Document): Laying | null {
  const speed = readLayingSpeed(doc);
  return speed ? { speed, units: readLayableUnits(doc) } : null;
}

export async function storeLaying(origin: string, laying: Laying, readAt: Date): Promise<void> {
  await storage.setItem(key(origin), { ...laying, readAt: readAt.getTime() });
}

/** The laying last read, read again on Reine.php when unknown or older than `LAYING_MAX_AGE`; null when unreadable. */
export async function loadLaying(
  origin: string,
  now: Date,
  fetchFn: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<StoredLaying | null> {
  const stored = await storage.getItem<Laying & { readAt: number }>(key(origin));
  if (stored && now.getTime() - stored.readAt <= LAYING_MAX_AGE) return { ...stored, readAt: new Date(stored.readAt) };
  const doc = await fetchGamePage(`${origin}/Reine.php`, fetchFn).catch(() => null);
  const read = doc ? readLaying(doc) : null;
  if (!read) return stored ? { ...stored, readAt: new Date(stored.readAt) } : null;
  await storeLaying(origin, read, now);
  return { ...read, readAt: now };
}
