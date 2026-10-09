// The attacks on their way, shared by the flood plan and the « Flood max » column of the targets.
import { attackSlots } from "@/game/attack";
import { readAttacksOnWay, reconcileLaunches } from "@/features/flood/attacks";
import { loadLaunches, saveLaunches, type Launch } from "@/data/launches";
import { fetchGamePage } from "@/utils/game-page";

export interface OnWay {
  /** Attacks sent through the form and still on their way, all targets, matched with the game's list. */
  launches: Launch[];
  /** Attacks on their way sent without the flood plan: they take a slot, their take is unknown. */
  unknown: number;
}

/**
 * The launches still on their way, checked against the game's list on Armee.php (`doc`, or read in the
 * background): a cancelled attack is forgotten, one sent without this plan is counted in `unknown`.
 */
export async function checkLaunches(origin: string, now: Date, doc?: Document): Promise<OnWay> {
  const launches = await loadLaunches(origin, now);
  try {
    const page = doc ?? (await fetchGamePage("/Armee.php"));
    if (!page) throw new Error("Fourmizzz: error status on Armee.php");
    const checked = reconcileLaunches(launches, readAttacksOnWay(page, now));
    await saveLaunches(origin, checked.launches);
    return checked;
  } catch (error) {
    console.warn("[Optizzz] could not check the attacks on their way", error);
    return { launches, unknown: 0 };
  }
}

/** The fields once the attacks on their way have landed, and the attacks I can still launch. */
export function afterOnWay(
  myField: number,
  target: { id: number; field: number },
  onWay: OnWay,
  attackSpeed: number,
): { myField: number; targetField: number; slots: number; onTarget: number } {
  const onTarget = onWay.launches.filter((launch) => launch.targetId === target.id);
  return {
    myField: myField + onWay.launches.reduce((sum, launch) => sum + launch.take, 0),
    targetField: target.field - onTarget.reduce((sum, launch) => sum + launch.take, 0),
    slots: attackSlots(attackSpeed, onWay.launches.length + onWay.unknown),
    onTarget: onTarget.length,
  };
}
