import { loadPlayersExport } from "../alliance-map/api";
import { readLoggedInPseudo } from "../alliance-map/pages";
import { readGarrison, storeGarrison } from "../combat-simulator/garrison";
import type { Feature } from "../feature";
import { loadLevelsOf } from "../game-levels/levels";
import { readStock } from "../resource-forecast/pages";
import { distance, travelTime } from "@/game/travel";
import { FLOOD_STYLE, mountFloodPlanner } from "./mount";
import { readAttackForm, readProfileField } from "./page";
import {
  clearDefense,
  flushQueuedLaunches,
  loadCountLodge,
  loadDefense,
  loadLaunches,
  queueLaunch,
  saveCountLodge,
  saveDefense,
} from "./store";

/** Kept above the 50 % limit: other attacks and hunts may move the fields before arrival. */
export const FLOOD_MARGIN = 0.01;

async function liveField(pseudo: string): Promise<number | null> {
  try {
    const html = await fetch(`/Membre.php?Pseudo=${encodeURIComponent(pseudo)}`).then((response) => response.text());
    return readProfileField(new DOMParser().parseFromString(html, "text/html"));
  } catch {
    return null;
  }
}

/**
 * On the game's attack form: the flood that takes the most from the target, with buttons that fill the form.
 * On Armee.php: remembers the army for the « Flood max » column of « Cibles à portée ». See docs/features/flood.md.
 */
export const floodPlanner: Feature = {
  id: "flood",
  toggle: "flood",
  // Every page: the game may land anywhere after an attack is sent, and the queued launch must be stored.
  matches: () => true,
  async run() {
    const origin = location.origin;
    await flushQueuedLaunches(sessionStorage, origin);
    const path = location.pathname.toLowerCase();
    if (path === "/armee.php") {
      const garrison = readGarrison(document);
      if (garrison) await storeGarrison(origin, garrison, new Date());
      return;
    }

    if (path !== "/ennemie.php" || !new URL(location.href).searchParams.has("Attaquer")) return;
    const form = readAttackForm(document);
    const me = readLoggedInPseudo(document);
    const stock = readStock(document);
    if (!form || !me || !stock) return;
    const now = new Date();
    const [playersExport, levels, launches, defense, countLodge] = await Promise.all([
      loadPlayersExport(origin),
      loadLevelsOf(origin, ["attackSpeed", "weapons", "shield"]),
      loadLaunches(origin, now),
      loadDefense(origin, form.targetId),
      loadCountLodge(origin),
    ]);
    const sender = playersExport.players.find((player) => player.pseudo.toLowerCase() === me.toLowerCase());
    const target = playersExport.players.find((player) => player.id === form.targetId);
    const field = (await liveField(form.target)) ?? target?.field;
    if (field === undefined) return;

    const style = document.createElement("style");
    style.textContent = FLOOD_STYLE;
    document.head.append(style);
    mountFloodPlanner(
      document,
      {
        me: { field: stock.huntingField, weapons: levels.weapons, shield: levels.shield },
        target: { id: form.targetId, pseudo: form.target, field },
        available: form.available,
        attackSpeed: levels.attackSpeed,
        travelSeconds: sender && target ? travelTime(distance(sender, target), levels.attackSpeed) : null,
        launches,
        defense,
        countLodge,
        margin: FLOOD_MARGIN,
        onCountLodgeChange: (count) => void saveCountLodge(origin, count),
        onDefenseChange: (army) =>
          void (army ? saveDefense(origin, form.targetId, army, new Date()) : clearDefense(origin, form.targetId)),
        onSend: (launch) => {
          queueLaunch(sessionStorage, launch);
        },
      },
      () => new Date(),
    );
  },
};
