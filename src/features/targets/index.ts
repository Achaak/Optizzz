import { storage } from "wxt/utils/storage";
import { loadAlliancesExport, loadPlayersExport } from "../alliance-map/api";
import { readLoggedInPseudo } from "../alliance-map/pages";
import type { Feature } from "../feature";
import { loadGarrison } from "../combat-simulator/garrison";
import { FLOOD_MARGIN } from "../flood";
import { loadCountLodge, loadDefenses, loadLaunches } from "../flood/store";
import { loadLevelsOf } from "../game-levels/levels";
import { isEnabled, type Toggles } from "../toggles";
import { readStock } from "../resource-forecast/pages";
import { mountTargets, TARGETS_STYLE, type FloodSettings } from "./mount";
import { readEnemyTable } from "./targets";

/** My army and free slots for the « Flood max » column; null when the flood planner is off or my army unknown. */
async function loadFloodSettings(origin: string, toggles: Toggles): Promise<FloodSettings | null> {
  if (!isEnabled(toggles, "flood")) return null;
  const now = new Date();
  const [garrison, levels, launches, defenses, countLodge] = await Promise.all([
    loadGarrison(origin),
    loadLevelsOf(origin, ["attackSpeed", "weapons", "shield"]),
    loadLaunches(origin, now),
    loadDefenses(origin),
    loadCountLodge(origin),
  ]);
  if (!garrison) return null;
  const { field, nest, lodge } = garrison.armies;
  return {
    available: field.map((count, i) => count + (nest[i] ?? 0) + (countLodge ? (lodge[i] ?? 0) : 0)),
    slots: Math.max(0, levels.attackSpeed + 1 - launches.length),
    defenses,
    weapons: levels.weapons,
    shield: levels.shield,
    margin: FLOOD_MARGIN,
  };
}

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
  async run(_ctx, toggles) {
    const pseudo = readLoggedInPseudo(document);
    const stock = readStock(document);
    if (!pseudo || !stock || !document.getElementById("formulairePageEnnemie")) return;
    const [playersExport, alliancesExport, levels, open, flood] = await Promise.all([
      loadPlayersExport(location.origin),
      loadAlliancesExport(location.origin),
      loadLevelsOf(location.origin, ["attackSpeed", "weapons", "shield"]),
      storage.getItem<boolean>(openKey(location.host)),
      loadFloodSettings(location.origin, toggles),
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
        flood,
        onOpenChange: (isOpen) => void storage.setItem(openKey(location.host), isOpen),
      },
      () => new Date(),
    );
  },
};
