import { setUpAlerts } from "@/features/alerts/background";
import { isOpenSimulatorMessage, simulatorUrl } from "@/features/combat-simulator/open";

export default defineBackground(() => {
  setUpAlerts();

  // No answer is sent: the content script only asks for the tab.
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isOpenSimulatorMessage(message)) return;
    browser.tabs.create({ url: simulatorUrl(message.server, message.side) }).catch((error: unknown) => {
      console.error("[Optizzz] could not open the combat simulator", error);
    });
  });
});
