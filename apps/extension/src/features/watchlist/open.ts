// Opening the « Suivis » page: over the game in a dialog (src/utils/page-dialog.ts), or in a tab asked of the
// background script, as the server map.

export interface OpenWatchlistMessage {
  type: "open-watchlist";
  /** Game server, e.g. "https://s5.fourmizzz.fr". */
  origin: string;
}

/** Embedded: framed in the in-game dialog. */
export function watchlistUrl(origin: string, { embedded = false } = {}): string {
  const query = new URLSearchParams({ server: origin, ...(embedded ? { embedded: "1" } : {}) });
  return browser.runtime.getURL(`/watchlist.html?${query.toString()}`);
}

/** From a content script. */
export function requestWatchlist(origin: string): Promise<unknown> {
  const message: OpenWatchlistMessage = { type: "open-watchlist", origin };
  return browser.runtime.sendMessage(message);
}

export function isOpenWatchlistMessage(message: unknown): message is OpenWatchlistMessage {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "open-watchlist";
}
