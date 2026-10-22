// The convoys delivered and received, read in the inbox of messagerie.php and kept per server: the game deletes its
// messages after about a week, Optizzz keeps them for a month. See docs/features/convoy.md.
import { storage } from "wxt/utils/storage";
import { readConvoyMessages, type ConvoyMessage } from "@optizzz/game/pages/messages";
import { fetchGamePage } from "@/utils/game-page";
import { withStorageLock } from "@/utils/storage-lock";

const DAY = 24 * 3600_000;

/** How long the game shows a message (the oldest seen was a few hours more): what is older may be gone unseen. */
export const GAME_KEEPS_MESSAGES = 7 * DAY;

/** How long Optizzz keeps a convoy. */
export const CONVOY_HISTORY_KEPT = 30 * DAY;

/** Read longer ago than this, the inbox is read again in the background on commerce.php. */
export const CONVOY_HISTORY_MAX_AGE = 15 * 60_000;

export interface ConvoyHistory {
  /** Newest first. */
  messages: ConvoyMessage[];
  /** When the inbox was last read. */
  readAt: Date;
  /** Since when no convoy can be missing: before, the game may have deleted some before Optizzz read them. */
  coveredFrom: Date;
}

/** Storage keeps JSON: dates are stored as timestamps. */
interface Stored {
  messages: (Omit<ConvoyMessage, "at"> & { at: number })[];
  readAt: number;
  coveredFrom: number;
}

const key = (origin: string) => `local:convoy-history:${new URL(origin).host}` as const;

/**
 * What is kept once the inbox has been read at `now`: a conversation read again takes its new sum (deliveries are
 * added to it), those the game deleted stay, those older than a month go.
 */
export function mergeConvoyHistory(kept: ConvoyHistory | null, read: ConvoyMessage[], now: Date): ConvoyHistory {
  const byId = new Map((kept?.messages ?? []).map((message) => [message.id, message]));
  for (const message of read) byId.set(message.id, message);
  const oldest = now.getTime() - CONVOY_HISTORY_KEPT;
  const messages = [...byId.values()]
    .filter((message) => message.at.getTime() >= oldest)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  // Not read for longer than the game keeps its messages: some may have gone unseen in between.
  const gap = !kept || now.getTime() - kept.readAt.getTime() > GAME_KEEPS_MESSAGES;
  return {
    messages,
    readAt: now,
    coveredFrom: gap ? new Date(now.getTime() - GAME_KEEPS_MESSAGES) : kept.coveredFrom,
  };
}

export async function loadConvoyHistory(origin: string): Promise<ConvoyHistory | null> {
  const stored = await storage.getItem<Stored>(key(origin));
  if (!stored) return null;
  return {
    messages: stored.messages.map((message) => ({ ...message, at: new Date(message.at) })),
    readAt: new Date(stored.readAt),
    coveredFrom: new Date(stored.coveredFrom),
  };
}

/** Adds what the inbox shows at `now` to what is kept. */
export function keepConvoyMessages(origin: string, read: ConvoyMessage[], now: Date): Promise<ConvoyHistory> {
  return withStorageLock(key(origin), async () => {
    const history = mergeConvoyHistory(await loadConvoyHistory(origin), read, now);
    await storage.setItem<Stored>(key(origin), {
      messages: history.messages.map((message) => ({ ...message, at: message.at.getTime() })),
      readAt: history.readAt.getTime(),
      coveredFrom: history.coveredFrom.getTime(),
    });
    return history;
  });
}

export function convoyHistoryOutdated(kept: ConvoyHistory | null, now: Date): boolean {
  return !kept || now.getTime() - kept.readAt.getTime() > CONVOY_HISTORY_MAX_AGE;
}

/** Whether the page is the inbox of a logged-in player (any other folder lists only some conversations). */
export function isInbox(doc: Document): boolean {
  return doc.getElementById("table_liste_conversations") !== null;
}

/**
 * Reads the inbox again (one GET, with the session cookie, which opens no message: nothing is marked read); when it
 * fails, what was kept stays.
 */
export async function refreshConvoyHistory(origin: string): Promise<ConvoyHistory | null> {
  try {
    const doc = await fetchGamePage(`${origin}/messagerie.php`);
    if (!doc || !isInbox(doc)) throw new Error("Fourmizzz: messagerie.php is not a logged-in inbox");
    const now = new Date();
    return await keepConvoyMessages(origin, readConvoyMessages(doc, now), now);
  } catch (error) {
    console.warn("[Optizzz] convoy history: could not read messagerie.php again", error);
    return loadConvoyHistory(origin);
  }
}
