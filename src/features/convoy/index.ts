import { loadPlayersExport } from "../alliance-map/api";
import { readLoggedInPseudo } from "../alliance-map/pages";
import type { Feature } from "../feature";
import { loadLevelsOf } from "../game-levels/levels";
import { INCOME_MAX_AGE, loadIncome } from "../resource-forecast/income";
import { readStock } from "../resource-forecast/pages";
import { CONVOY_STYLE, mountConvoyPlanner } from "./mount";

/**
 * On commerce.php: trip and arrival of the convoy being prepared, the workers it takes, recipient suggestions,
 * and the arrival time of the convoys on their way. See docs/features/convoy.md.
 */
export const convoyPlanner: Feature = {
  id: "convoy",
  toggle: "convoy",
  matches: (url) => url.pathname.toLowerCase() === "/commerce.php",
  async run() {
    const me = readLoggedInPseudo(document);
    const stock = readStock(document);
    if (!me || !stock || !document.getElementById("pseudo_convoi")) return;
    const now = new Date();
    const [playersExport, levels, income] = await Promise.all([
      loadPlayersExport(location.origin),
      loadLevelsOf(location.origin, ["attackSpeed", "aphids"]),
      loadIncome(location.origin, INCOME_MAX_AGE, now),
    ]);
    // Without the harvest split, every worker counts as working: the harvest lost is then an upper bound.
    const working = income ? income.foodWorkers + income.materialWorkers : stock.workers;

    const style = document.createElement("style");
    style.textContent = CONVOY_STYLE;
    document.head.append(style);
    mountConvoyPlanner(
      document,
      {
        me,
        players: playersExport.players,
        attackSpeed: levels.attackSpeed,
        aphids: levels.aphids,
        idleWorkers: Math.max(0, stock.workers - working),
      },
      () => new Date(),
    );
  },
};
