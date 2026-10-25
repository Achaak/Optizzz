// The convoys on their way, read on commerce.php and kept per server: their workers are off the header's count.
import { storage } from "wxt/utils/storage";
import { readConvoysOnWay, type ConvoyOnWay } from "@/features/convoy/convoy";
import { readStock } from "@optizzz/game/pages/resources";
import { fetchGamePage } from "@/utils/game-page";
import { sendsConvoys } from "./envois";
import { loadCurrentPlayer } from "./optizzz-account";

/** A convoy I send: those I receive take none of my workers. */
export type KeptConvoy = Pick<ConvoyOnWay, "food" | "materials" | "arrivesAt"> & { recipient: string };

export interface KeptConvoys {
  readAt: Date;
  convoys: KeptConvoy[];
  /** The header's workers on the page the list was read on: fewer later, a convoy may have left from elsewhere. */
  workers?: number;
}

/** Read longer ago than this, commerce.php is read again in the background: a convoy may have left elsewhere. */
export const CONVOYS_MAX_AGE = 15 * 60_000;

/** Storage keeps JSON: dates are stored as timestamps. */
interface Stored {
  readAt: number;
  convoys: (Omit<KeptConvoy, "arrivesAt"> & { arrivesAt: number })[];
  workers?: number;
}

const key = (origin: string) => `local:convoys:${new URL(origin).host}` as const;

export async function loadConvoys(origin: string): Promise<KeptConvoys | null> {
  const stored = await storage.getItem<Stored>(key(origin));
  if (!stored) return null;
  return {
    readAt: new Date(stored.readAt),
    convoys: stored.convoys.map((convoy) => ({ ...convoy, arrivesAt: new Date(convoy.arrivesAt) })),
    ...(stored.workers === undefined ? {} : { workers: stored.workers }),
  };
}

export async function storeConvoys(
  origin: string,
  convoys: KeptConvoy[],
  readAt: Date,
  workers?: number,
): Promise<void> {
  await storage.setItem<Stored>(key(origin), {
    readAt: readAt.getTime(),
    convoys: convoys.map(({ recipient, food, materials, arrivesAt }) => ({
      recipient,
      food,
      materials,
      arrivesAt: arrivesAt.getTime(),
    })),
    ...(workers === undefined ? {} : { workers }),
  });
}

/**
 * Whether commerce.php must be read again: nothing kept, read too long ago, or the header's workers dropped since,
 * which a convoy sent from elsewhere (phone, another browser) does at once. Building or researching takes workers
 * too: one read more, then nothing. Laying hides a small convoy until the list is too old.
 */
export function convoysOutdated(kept: KeptConvoys | null, workers: number, now: Date): boolean {
  if (!kept || now.getTime() - kept.readAt.getTime() > CONVOYS_MAX_AGE) return true;
  return kept.workers !== undefined && workers < kept.workers;
}

/** The convoys I send that commerce.php lists, or null when the page is not a logged-in game page. */
export function readKeptConvoys(doc: Document, now: Date): KeptConvoy[] | null {
  if (!doc.querySelector("#data")) return null;
  return readConvoysOnWay(doc, now)
    .filter((convoy) => !convoy.incoming)
    .map(({ player, food, materials, arrivesAt }) => ({ recipient: player, food, materials, arrivesAt }));
}

/** A convoy on its way to me, for the Convois Envoi (docs/features/site-envois.md): it takes none of my workers. */
export type IncomingConvoy = Pick<ConvoyOnWay, "food" | "materials" | "arrivesAt"> & { sender: string };

export interface KeptIncomingConvoys {
  readAt: Date;
  convoys: IncomingConvoy[];
}

const incomingKey = (origin: string) => `local:incomingConvoys:${new URL(origin).host}` as const;

/** The convoys on their way to me that commerce.php lists, or null when the page is not a logged-in game page. */
export function readIncomingConvoys(doc: Document, now: Date): IncomingConvoy[] | null {
  if (!doc.querySelector("#data")) return null;
  return readConvoysOnWay(doc, now)
    .filter((convoy) => convoy.incoming)
    .map(({ player, food, materials, arrivesAt }) => ({ sender: player, food, materials, arrivesAt }));
}

export async function storeIncomingConvoys(origin: string, convoys: IncomingConvoy[], readAt: Date): Promise<void> {
  await storage.setItem(incomingKey(origin), {
    readAt: readAt.getTime(),
    convoys: convoys.map(({ sender, food, materials, arrivesAt }) => ({
      sender,
      food,
      materials,
      arrivesAt: arrivesAt.getTime(),
    })),
  });
}

export async function loadIncomingConvoys(origin: string): Promise<KeptIncomingConvoys | null> {
  const stored = await storage.getItem<{
    readAt: number;
    convoys: (Omit<IncomingConvoy, "arrivesAt"> & { arrivesAt: number })[];
  }>(incomingKey(origin));
  if (!stored) return null;
  return {
    readAt: new Date(stored.readAt),
    convoys: stored.convoys.map((convoy) => ({ ...convoy, arrivesAt: new Date(convoy.arrivesAt) })),
  };
}

/** Reads commerce.php again (one GET, with the session cookie); when it fails, what was kept stays. */
export async function refreshConvoys(origin: string): Promise<KeptConvoys | null> {
  try {
    const doc = await fetchGamePage(`${origin}/commerce.php`);
    // Dated when the page answered: the times left count from then.
    const now = new Date();
    const convoys = doc ? readKeptConvoys(doc, now) : null;
    if (!doc || !convoys) throw new Error("Fourmizzz: commerce.php is not a logged-in page");
    await storeConvoys(origin, convoys, now, readStock(doc)?.workers);
    // The same page, read on a game page's opening: for the Convois Envoi too, when the player sends them.
    const pseudo = await loadCurrentPlayer(origin);
    if (pseudo && (await sendsConvoys(origin, pseudo)))
      await storeIncomingConvoys(origin, readIncomingConvoys(doc, now) ?? [], now);
  } catch (error) {
    console.warn("[Optizzz] convoys: could not read commerce.php again", error);
  }
  return loadConvoys(origin);
}
