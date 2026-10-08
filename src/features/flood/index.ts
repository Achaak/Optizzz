import { loadPlayersExport } from "@/data/exports";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import type { Feature } from "../feature";
import { loadLevelsOf, unknownLevelsHint } from "@/data/levels";
import { readStock } from "@/game/pages/resources";
import { distance, travelTime } from "@/game/travel";
import { FLOOD_STYLE, mountFloodNotice, mountFloodPlanner } from "./mount";
import { isUnderBeginnerProtection, readAttackForm } from "./page";
import { readProfile } from "@/game/pages/scores";
import { checkLaunches } from "@/data/on-way";
import {
  clearDefense,
  flushQueuedLaunches,
  loadCountLodge,
  loadDefense,
  queueLaunch,
  saveCountLodge,
  saveDefense,
} from "@/data/launches";
import { fetchGamePage } from "@/utils/game-page";

/** Kept above the 50 % limit: other attacks and hunts may move the fields before arrival. */
export const FLOOD_MARGIN = 0.01;

async function liveField(pseudo: string): Promise<number | null> {
  try {
    const doc = await fetchGamePage(`/Membre.php?Pseudo=${encodeURIComponent(pseudo)}`);
    return (doc && readProfile(doc)?.scores.field) ?? null;
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
      // The army is kept by the collect feature; the attacks on their way are checked here.
      await checkLaunches(origin, new Date(), document);
      return;
    }

    if (path !== "/ennemie.php" || !new URL(location.href).searchParams.has("Attaquer")) return;
    const form = readAttackForm(document);
    const me = readLoggedInPseudo(document);
    const stock = readStock(document);
    if (!form || !me || !stock) return;
    const now = new Date();
    const [playersExport, levels, launches, defense, countLodge] = await Promise.all([
      // The export only gives the trip and a fallback field: without it, the plan is still made.
      loadPlayersExport(origin).catch((error: unknown) => {
        console.warn("[Optizzz] flood plan: public export unavailable", error);
        return null;
      }),
      loadLevelsOf(origin, ["attackSpeed", "weapons", "shield"]).catch((error: unknown) => ({ error })),
      checkLaunches(origin, now),
      loadDefense(origin, form.targetId),
      loadCountLodge(origin),
    ]);
    const style = document.createElement("style");
    style.textContent = FLOOD_STYLE;
    document.head.append(style);
    if ("error" in levels) {
      mountFloodNotice(
        document,
        `${unknownLevelsHint(levels.error)} Le plan en a besoin (attaques simultanées, combat).`,
      );
      return;
    }
    const sender = playersExport?.players.find((player) => player.pseudo.toLowerCase() === me.toLowerCase());
    const target = playersExport?.players.find((player) => player.id === form.targetId);
    const field = (await liveField(form.target)) ?? target?.field;
    if (field === undefined) {
      mountFloodNotice(document, `TDC de ${form.target} illisible (profil et export public) : pas de plan.`);
      return;
    }

    mountFloodPlanner(
      document,
      {
        me: { field: stock.huntingField, weapons: levels.weapons, shield: levels.shield },
        target: { id: form.targetId, pseudo: form.target, field },
        available: form.available,
        attackSpeed: levels.attackSpeed,
        travelSeconds: sender && target ? travelTime(distance(sender, target), levels.attackSpeed) : null,
        onWay: launches,
        defense,
        countLodge,
        protectedMe: isUnderBeginnerProtection(document),
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
