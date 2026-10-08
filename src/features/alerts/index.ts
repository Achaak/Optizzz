import type { Feature } from "../feature";
import { readStock } from "@/game/pages/resources";
import { isEnabled } from "../toggles";
import { storeStock } from "./store";

/**
 * Keeps the stock of every page for the toolbar badge and the notifications, computed by the background script.
 * See docs/features/alertes.md.
 */
export const alerts: Feature = {
  id: "alerts",
  toggle: "alerts",
  matches: () => true,
  async run(_ctx, toggles) {
    // Either option needs it: without the stock, famine and full warehouses could not be notified either.
    if (!isEnabled(toggles, "alerts", "badge") && !isEnabled(toggles, "alerts", "notifications")) return;
    const stock = readStock(document);
    if (stock) await storeStock(location.origin, stock, new Date());
  },
};
