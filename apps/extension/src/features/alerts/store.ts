// The stock of each server, kept for the background script: it never reads the game itself.
import { storage } from "wxt/utils/storage";
import { loadCapacities, loadStoredIncome } from "@/data/income";
import { withStorageLock } from "@/utils/storage-lock";
import type { ServerData } from "./badge";

type Stock = Omit<ServerData["stock"], "readAt">;

/** Storage keeps JSON: dates are stored as timestamps. Keyed by host: one key lists every server. */
type StoredStocks = Partial<Record<string, Stock & { readAt: number }>>;

export const STOCKS_KEY = "local:alerts:stocks";

// Read-modify-write, one at a time across this server's tabs. Tabs of two servers (two origins) can still race: the
// loser keeps its previous stock until its next page load.

/** Keeps the stock of `#data`, read on every page of `origin`. */
export function storeStock(origin: string, stock: Stock, readAt: Date): Promise<void> {
  return withStorageLock(STOCKS_KEY, async () => {
    const stored = (await storage.getItem<StoredStocks>(STOCKS_KEY)) ?? {};
    const { food, materials, workers } = stock;
    stored[new URL(origin).host] = { food, materials, workers, readAt: readAt.getTime() };
    await storage.setItem(STOCKS_KEY, stored);
  });
}

/** Every server whose stock was read, with its income and warehouses as last read. */
export async function loadServers(): Promise<ServerData[]> {
  const stored = (await storage.getItem<StoredStocks>(STOCKS_KEY)) ?? {};
  const servers = Object.entries(stored).filter((entry): entry is [string, NonNullable<StoredStocks[string]>] =>
    Boolean(entry[1]),
  );
  return Promise.all(
    servers.map(async ([host, stock]) => {
      const origin = `https://${host}`;
      return {
        host,
        stock: { ...stock, readAt: new Date(stock.readAt) },
        income: await loadStoredIncome(origin),
        capacities: await loadCapacities(origin, false),
      };
    }),
  );
}
