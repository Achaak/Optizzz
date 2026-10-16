import { setUpAlerts } from "@/features/alerts/background";
import { isOpenSimulatorMessage, simulatorUrl } from "@/features/combat-simulator/open";
import { isOpenServerMapMessage, serverMapUrl } from "@/features/server-map/open";

export default defineBackground(() => {
  setUpAlerts();

  // No answer is sent: the content script only asks for the tab.
  browser.runtime.onMessage.addListener((message: unknown) => {
    const url = isOpenSimulatorMessage(message)
      ? simulatorUrl(message.server, message.side)
      : isOpenServerMapMessage(message)
        ? serverMapUrl(message.origin, message.target)
        : null;
    if (!url) return;
    browser.tabs.create({ url }).catch((error: unknown) => {
      console.error("[Optizzz] could not open an extension page", error);
    });
  });
});
