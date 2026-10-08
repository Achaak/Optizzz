import { storage } from "wxt/utils/storage";
import { loadAlliancesExport, loadPlayersExport } from "../alliance-map/api";
import { readLoggedInPseudo } from "../alliance-map/pages";
import type { Feature } from "../feature";
import { loadLevelsOf } from "../game-levels/levels";
import { readStock } from "../resource-forecast/pages";
import { mountTargets, TARGETS_STYLE } from "./mount";
import { readEnemyTable } from "./targets";

const openKey = (host: string) => `local:targets:${host}:open` as const;

/**
 * On ennemie.php: every player in range, nearest first, with the trip, the arrival, their state and the diplomacy
 * with my alliance. See docs/features/cibles.md.
 */
export const targets: Feature = {
  id: "targets",
  toggle: "targets",
  // ennemie.php?Attaquer=… is the game's attack form: nothing to add there.
  matches: (url) => url.pathname.toLowerCase() === "/ennemie.php" && !url.searchParams.has("Attaquer"),
  async run() {
    const pseudo = readLoggedInPseudo(document);
    const stock = readStock(document);
    if (!pseudo || !stock || !document.getElementById("formulairePageEnnemie")) return;
    const [playersExport, alliancesExport, levels, open] = await Promise.all([
      loadPlayersExport(location.origin),
      loadAlliancesExport(location.origin),
      loadLevelsOf(location.origin, ["attackSpeed"]),
      storage.getItem<boolean>(openKey(location.host)),
    ]);

    const style = document.createElement("style");
    style.textContent = TARGETS_STYLE;
    document.head.append(style);
    mountTargets(
      document,
      {
        me: { pseudo, field: stock.huntingField },
        attackSpeed: levels.attackSpeed,
        players: playersExport.players,
        alliances: alliancesExport.alliances,
        live: readEnemyTable(document),
        open: open ?? true,
        onOpenChange: (isOpen) => void storage.setItem(openKey(location.host), isOpen),
      },
      () => new Date(),
    );
  },
};
