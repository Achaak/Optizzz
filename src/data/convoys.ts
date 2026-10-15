// The convoys on their way, read on commerce.php and kept per server: their workers are off the header's count.
import { storage } from "wxt/utils/storage";
import { readConvoysOnWay, type ConvoyOnWay } from "@/features/convoy/convoy";
import { fetchGamePage } from "@/utils/game-page";

export type KeptConvoy = Pick<ConvoyOnWay, "recipient" | "food" | "materials" | "arrivesAt">;

export interface KeptConvoys {
  readAt: Date;
  convoys: KeptConvoy[];
}

/** Read longer ago than this, commerce.php is read again in the background: a convoy may have left elsewhere. */
export const CONVOYS_MAX_AGE = 15 * 60_000;

/** Storage keeps JSON: dates are stored as timestamps. */
interface Stored {
  readAt: number;
  convoys: (Omit<KeptConvoy, "arrivesAt"> & { arrivesAt: number })[];
}

const key = (origin: string) => `local:convoys:${new URL(origin).host}` as const;

export async function loadConvoys(origin: string): Promise<KeptConvoys | null> {
  const stored = await storage.getItem<Stored>(key(origin));
  if (!stored) return null;
  return {
    readAt: new Date(stored.readAt),
    convoys: stored.convoys.map((convoy) => ({ ...convoy, arrivesAt: new Date(convoy.arrivesAt) })),
  };
}

export async function storeConvoys(origin: string, convoys: KeptConvoy[], readAt: Date): Promise<void> {
  await storage.setItem<Stored>(key(origin), {
    readAt: readAt.getTime(),
    convoys: convoys.map(({ recipient, food, materials, arrivesAt }) => ({
      recipient,
      food,
      materials,
      arrivesAt: arrivesAt.getTime(),
    })),
  });
}

/** The convoys commerce.php lists, or null when the page is not a logged-in game page. */
export function readKeptConvoys(doc: Document, now: Date): KeptConvoy[] | null {
  return doc.querySelector("#data") ? readConvoysOnWay(doc, now) : null;
}

/** Reads commerce.php again (one GET, with the session cookie); when it fails, what was kept stays. */
export async function refreshConvoys(origin: string): Promise<KeptConvoys | null> {
  try {
    const doc = await fetchGamePage(`${origin}/commerce.php`);
    // Dated when the page answered: the times left count from then.
    const now = new Date();
    const convoys = doc ? readKeptConvoys(doc, now) : null;
    if (!convoys) throw new Error("Fourmizzz: commerce.php is not a logged-in page");
    await storeConvoys(origin, convoys, now);
  } catch (error) {
    console.warn("[Optizzz] convoys: could not read commerce.php again", error);
  }
  return loadConvoys(origin);
}
