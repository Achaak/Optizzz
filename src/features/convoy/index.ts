import { loadPlayersExport } from "@/data/exports";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import type { Feature } from "../feature";
import { loadLevelsOf, unknownLevelsHint } from "@/data/levels";
import { INCOME_MAX_AGE, loadIncome } from "@/data/income";
import { readStock } from "@/game/pages/resources";
import { CONVOY_STYLE, mountConvoyPlanner, renderConvoysOnWay } from "./mount";
import { isEnabled } from "../toggles";
import { CONVOYS_MAX_AGE, convoysOutdated, loadConvoys, refreshConvoys, type KeptConvoys } from "@/data/convoys";
import { loadStoredLevels } from "@/data/levels";
import { HEADER_TIP_STYLE } from "@/utils/header-tip";
import { workersAway } from "./convoy";
import { CONVOY_WORKERS_STYLE, renderConvoyWorkers } from "./mount-workers";
import { convoyHistoryOutdated, loadConvoyHistory, refreshConvoyHistory } from "@/data/convoy-history";
import { CONVOY_HISTORY_STYLE, mountConvoyHistory } from "./mount-history";

/**
 * On commerce.php: trip and arrival of the convoy being prepared, the workers it takes, recipient suggestions,
 * and the arrival time of the convoys on their way. See docs/features/convoy.md.
 */
export const convoyPlanner: Feature = {
  id: "convoy",
  toggle: "convoy",
  matches: (url) => url.pathname.toLowerCase() === "/commerce.php",
  async run(ctx) {
    const me = readLoggedInPseudo(document);
    const stock = readStock(document);
    if (!me || !stock || !document.getElementById("pseudo_convoi")) return;
    const style = document.createElement("style");
    style.textContent = CONVOY_STYLE;
    document.head.append(style);
    const copy = (text: string) => navigator.clipboard.writeText(text);
    // Read on the page alone: written before anything is loaded, whatever fails next.
    ctx.onInvalidated(renderConvoysOnWay(document, () => new Date(), copy));

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
      copy,
    );
  },
};

/**
 * On every page: under the header's workers, the total with those carrying convoys, which the game takes off its
 * count until the convoy arrives. See docs/features/convoy.md.
 */
export const convoyWorkers: Feature = {
  id: "convoy-workers",
  toggle: "convoy",
  matches: () => true,
  async run(_ctx, toggles) {
    if (!isEnabled(toggles, "convoy", "workers")) return;
    const stock = readStock(document);
    if (!stock) return;
    const { origin } = location;
    // The header's count is the page's: the convoys are taken as they were then, arrived ones too.
    const loadedAt = new Date();

    const style = document.createElement("style");
    style.textContent = CONVOY_WORKERS_STYLE + HEADER_TIP_STYLE;
    document.head.append(style);

    const { aphids } = await loadStoredLevels(origin);
    const render = (kept: KeptConvoys | null) => {
      if (!kept) return;
      renderConvoyWorkers(
        document,
        {
          atHome: stock.workers,
          away: workersAway(kept.convoys, aphids ?? 0, loadedAt),
          readAt: kept.readAt,
          stale: loadedAt.getTime() - kept.readAt.getTime() > CONVOYS_MAX_AGE,
          aphidsKnown: aphids !== undefined,
        },
        loadedAt,
      );
    };
    // Kept by the collect feature, commerce.php included.
    const kept = await loadConvoys(origin);
    render(kept);
    if (convoysOutdated(kept, stock.workers, loadedAt)) render(await refreshConvoys(origin));
  },
};

/**
 * On commerce.php: the convoys delivered and received per player over a period, read in the inbox (kept by collect
 * on messagerie.php, read again in the background when older than 15 min). See docs/features/convoy.md.
 */
export const convoyHistory: Feature = {
  id: "convoy-history",
  toggle: "convoy",
  matches: (url) => url.pathname.toLowerCase() === "/commerce.php",
  async run(_ctx, toggles) {
    if (!isEnabled(toggles, "convoy", "history") || !document.getElementById("pseudo_convoi")) return;
    const { origin } = location;
    const style = document.createElement("style");
    style.textContent = CONVOY_HISTORY_STYLE;
    document.head.append(style);
    const view = mountConvoyHistory(
      document,
      () => new Date(),
      (text) => navigator.clipboard.writeText(text),
    );
    const kept = await loadConvoyHistory(origin);
    if (kept) view.update(kept);
    if (convoyHistoryOutdated(kept, new Date())) view.update(await refreshConvoyHistory(origin));
  },
};
