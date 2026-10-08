import type { Feature } from "../feature";
import { readStock } from "../resource-forecast/pages";
import { isEnabled } from "../toggles";
import { storeStock } from "./store";

/**
 * Keeps the stock of every page for the toolbar badge, computed by the background script.
 * See docs/features/alertes.md.
 */
export const alerts: Feature = {
  id: "alerts",
  toggle: "alerts",
  matches: () => true,
  async run(_ctx, toggles) {
    if (!isEnabled(toggles, "alerts", "badge")) return;
    const stock = readStock(document);
    if (stock) await storeStock(location.origin, stock, new Date());
  },
};
