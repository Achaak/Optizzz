import { loadPlayersExport } from "@/data/exports";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import type { Feature } from "../feature";
import { loadLevelsOf, unknownLevelsHint } from "@/data/levels";
import { INCOME_MAX_AGE, loadIncome } from "@/data/income";
import { readStock } from "@/game/pages/resources";
import { annotateConvoysOnWay, CONVOY_STYLE, mountConvoyPlanner } from "./mount";

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
    // Read on the page alone: written before anything is loaded, whatever fails next.
    annotateConvoysOnWay(document, new Date());

    const now = new Date();
    const [playersExport, levels, income] = await Promise.all([
      loadPlayersExport(location.origin).catch((error: unknown) => {
        console.warn("[Optizzz] convoy: public export unavailable", error);
        return null;
      }),
      loadLevelsOf(location.origin, ["attackSpeed", "aphids"]).catch((error: unknown) => ({ error })),
      loadIncome(location.origin, INCOME_MAX_AGE, now).catch((error: unknown) => {
        console.warn("[Optizzz] convoy: income unreadable", error);
        return null;
      }),
    ]);
    // Without the harvest split, every worker counts as working: the harvest lost is then an upper bound.
    const working = income ? income.foodWorkers + income.materialWorkers : stock.workers;
    const known = "error" in levels ? null : levels;

    const style = document.createElement("style");
    style.textContent = CONVOY_STYLE;
    document.head.append(style);
    mountConvoyPlanner(
      document,
      {
        me,
        players: playersExport?.players ?? null,
        attackSpeed: known?.attackSpeed ?? null,
        aphids: known?.aphids ?? 0,
        idleWorkers: Math.max(0, stock.workers - working),
        taxRate: income?.taxRate ?? 0,
        ...("error" in levels ? { levelsHint: unknownLevelsHint(levels.error) } : {}),
      },
      () => new Date(),
    );
  },
};
