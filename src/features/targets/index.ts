import { storage } from "wxt/utils/storage";
import { loadAlliancesExport, loadPlayersExport } from "@/data/exports";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import type { Feature } from "../feature";
import { loadGarrison } from "@/data/garrison";
import { FLOOD_MARGIN } from "../flood";
import { checkLaunches } from "@/data/on-way";
import { isUnderBeginnerProtection } from "../flood/page";
import { loadCountLodge, loadDefenses } from "@/data/launches";
import { loadLevelsOf, unknownLevelsHint } from "@/data/levels";
import { isEnabled, type Toggles } from "../toggles";
import { readStock } from "@/game/pages/resources";
import { mountTargets, mountTargetsNotice, TARGETS_STYLE, type FloodSettings } from "./mount";
import { readEnemyTable } from "./targets";

type FloodColumn = { settings: FloodSettings; missing: null } | { settings: null; missing: string | null };

/**
 * My army and the attacks on their way for the « Flood max » column, as the flood plan counts them; with the reason
 * when the column cannot be shown (flood plan off: no reason, the player switched it off).
 */
async function loadFloodColumn(origin: string, toggles: Toggles): Promise<FloodColumn> {
  if (!isEnabled(toggles, "flood")) return { settings: null, missing: null };
  const now = new Date();
  const [garrison, levels, onWay, defenses, countLodge] = await Promise.all([
    loadGarrison(origin),
    loadLevelsOf(origin, ["attackSpeed", "weapons", "shield"]).catch(() => null),
    checkLaunches(origin, now),
    loadDefenses(origin),
    loadCountLodge(origin),
  ]);
  if (!levels) return { settings: null, missing: "« Flood max » : niveaux de recherche inconnus." };
  if (!garrison)
    return { settings: null, missing: "« Flood max » : passez par la page Armée pour qu'Optizzz lise votre armée." };
  const { field, nest, lodge } = garrison.armies;
  const available = field.map((count, i) => count + (nest[i] ?? 0) + (countLodge ? (lodge[i] ?? 0) : 0));
  if (available.every((count) => count === 0)) {
    return { settings: null, missing: "« Flood max » : aucune unité en garnison (lue sur la page Armée)." };
  }
  return {
    settings: {
      available,
      attackSpeed: levels.attackSpeed,
      onWay,
      defenses,
      weapons: levels.weapons,
      shield: levels.shield,
      margin: FLOOD_MARGIN,
    },
    missing: null,
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
    const [exports, levels, open, flood] = await Promise.all([
      Promise.all([loadPlayersExport(location.origin), loadAlliancesExport(location.origin)]).catch(
        (error: unknown) => {
          console.error("[Optizzz] targets: loading the public exports failed", error);
          return null;
        },
      ),
      loadLevelsOf(location.origin, ["attackSpeed"]).catch((error: unknown) => ({ error })),
      storage.getItem<boolean>(openKey(location.host)),
      loadFloodColumn(location.origin, toggles),
    ]);

    const style = document.createElement("style");
    style.textContent = TARGETS_STYLE;
    document.head.append(style);
    if (!exports) {
      mountTargetsNotice(
        document,
        "L'export public de Fourmizzz ne répond pas : la liste des cibles est indisponible. Réessayez dans quelques minutes.",
      );
      return;
    }
    if ("error" in levels) {
      mountTargetsNotice(document, `${unknownLevelsHint(levels.error)} Les trajets en dépendent.`);
      return;
    }
    const [playersExport, alliancesExport] = exports;
    mountTargets(
      document,
      {
        me: { pseudo, field: stock.huntingField },
        attackSpeed: levels.attackSpeed,
        players: playersExport.players,
        alliances: alliancesExport.alliances,
        live: readEnemyTable(document),
        open: open ?? true,
        flood: flood.settings,
        floodMissing: flood.missing,
        protectedMe: isUnderBeginnerProtection(document),
        onOpenChange: (isOpen) => void storage.setItem(openKey(location.host), isOpen),
      },
      () => new Date(),
    );
  },
};
