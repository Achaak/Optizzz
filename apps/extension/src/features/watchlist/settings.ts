// The lost field (percent) from which a watched entry's loss is notified: global and synced, like the notifications.
import { storage } from "wxt/utils/storage";
import { DEFAULT_LOSS_PERCENT } from "./describe";

const LOSS_PERCENT_KEY = "sync:watchlistLossPercent";

export async function loadLossPercent(): Promise<number> {
  return (await storage.getItem<number>(LOSS_PERCENT_KEY)) ?? DEFAULT_LOSS_PERCENT;
}

export async function setLossPercent(percent: number): Promise<void> {
  await storage.setItem(LOSS_PERCENT_KEY, percent);
}

/** Where a click on the summary or a notification leads: any game page opens the view on this hash. */
export const WATCHLIST_HASH = "optizzz-suivis";

export const watchlistPageUrl = (origin: string) => `${origin}/Reine.php#${WATCHLIST_HASH}`;
