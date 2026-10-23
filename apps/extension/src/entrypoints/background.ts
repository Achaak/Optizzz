import { setUpAlerts } from "@/features/alerts/background";
import { setUpWatchlist } from "@/features/watchlist/background";
import { isOpenWatchlistMessage, watchlistUrl } from "@/features/watchlist/open";
import { isOpenSimulatorMessage, simulatorUrl } from "@/features/combat-simulator/open";
import { isOpenServerMapMessage, serverMapUrl } from "@/features/server-map/open";
import { loadToggles } from "@/features/toggles";

export default defineBackground(() => {
  setUpAlerts();
  setUpWatchlist();

  // No answer is sent: the content script only asks for the tab.
  browser.runtime.onMessage.addListener((message: unknown) => {
    // A tool of optizzz.fr (src/utils/site-tool.ts), only while « Liens vers optizzz.fr » is on.
    if (isOpenSiteToolMessage(message)) {
      void loadToggles()
        .then((toggles) =>
          siteLinksEnabled(toggles) ? browser.tabs.create({ url: siteToolMessageUrl(message) }) : null,
        )
        .catch((error: unknown) => {
          console.error("[Optizzz] could not open a tool of optizzz.fr", error);
        });
      return;
    }
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
