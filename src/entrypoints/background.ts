import { setUpAlerts } from "@/features/alerts/background";
import { setUpWatchlist } from "@/features/watchlist/background";
import { isOpenWatchlistMessage, watchlistUrl } from "@/features/watchlist/open";
import { isOpenSimulatorMessage, simulatorUrl } from "@/features/combat-simulator/open";
import { isOpenServerMapMessage, serverMapUrl } from "@/features/server-map/open";

export default defineBackground(() => {
  setUpAlerts();
  setUpWatchlist();

  // No answer is sent: the content script only asks for the tab.
  browser.runtime.onMessage.addListener((message: unknown) => {
    const url = isOpenSimulatorMessage(message)
      ? simulatorUrl(message.server, message.side, { opponent: message.opponent })
      : isOpenServerMapMessage(message)
        ? serverMapUrl(message.origin, message.target)
        : isOpenWatchlistMessage(message)
          ? watchlistUrl(message.origin)
          : null;
    if (!url) return;
    browser.tabs.create({ url }).catch((error: unknown) => {
      console.error("[Optizzz] could not open an extension page", error);
    });
  });
});
