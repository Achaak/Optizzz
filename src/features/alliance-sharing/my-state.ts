// The player's own state to share, from the pages read when they open « Mon état » (docs/features/partage-alliance.md).
import type { Launch } from "@/data/launches";
import { readGarrison } from "@/data/garrison";
import type { SharedArmy, SharedState } from "@/data/shared-states";
import { UNITS } from "@/game/army/units";
import { readBuildingLevels, readResearchLevels } from "@/game/pages/levels";
import { readStock } from "@/game/pages/resources";
import { readWorkQueue } from "@/game/pages/work-queue";
import { readAttacksOnWay, reconcileLaunches } from "@/features/flood/attacks";
import { readOngoingHunts } from "@/features/hunt-launcher/pages";

export interface ShareChoices {
  buildings: boolean;
  research: boolean;
  /** Constructions and research under way. */
  works: boolean;
  workers: boolean;
  huntingField: boolean;
  army: "none" | "total" | "units";
}

/** The pages « Mon état » reads; null when one did not answer. */
export interface MyPages {
  construction: Document | null;
  laboratory: Document | null;
  army: Document | null;
  resources: Document | null;
}

export interface Me {
  server: string;
  alliance: string;
  pseudo: string;
}

/**
 * The army present (Armee.php), plus what is known of the troops away: hunts with their troops (Compte+), and the
 * ants of the attacks sent with the flood plan. Anything else away makes the army incomplete.
 */
function readArmy(armyPage: Document, resources: Document | null, launches: Launch[], now: Date, detail: boolean) {
  const garrison = readGarrison(armyPage);
  const units = new Map<string, number>();
  const add = (key: string, count: number) => units.set(key, (units.get(key) ?? 0) + count);
  if (garrison) {
    for (const army of Object.values(garrison.armies)) army.forEach((count, i) => add(UNITS[i]?.key ?? "", count));
  }
  const hunts = resources ? readOngoingHunts(resources, now) : [];
  for (const hunt of hunts) for (const [key, count] of Object.entries(hunt.troops ?? {})) add(key, count);
  const onWay = reconcileLaunches(launches, readAttacksOnWay(armyPage, now));

  const present = [...units.values()].reduce((sum, count) => sum + count, 0);
  const army: SharedArmy = {
    total: present + onWay.launches.reduce((sum, launch) => sum + launch.ants, 0),
    incomplete: onWay.unknown > 0 || hunts.some((hunt) => hunt.troops === null),
  };
  if (detail) army.units = Object.fromEntries([...units].filter(([, count]) => count > 0));
  const lastReturn = Math.max(...hunts.map((hunt) => hunt.returnsAt.getTime()));
  if (hunts.length > 0) army.returnsAt = new Date(lastReturn);
  return army;
}

/** What the player chose to share, from the pages read; `missing` names the pages that did not answer. */
export function collectMyState(
  pages: MyPages,
  choices: ShareChoices,
  me: Me,
  launches: Launch[],
  now: Date,
): { state: SharedState; missing: string[] } {
  const state: SharedState = { ...me, readAt: now };
  const missing = new Set<string>();
  const need = <T>(page: Document | null, name: string, read: (doc: Document) => T): T | undefined => {
    if (page) return read(page);
    missing.add(name);
    return undefined;
  };

  const stock = [pages.resources, pages.army, pages.construction, pages.laboratory]
    .map((page) => page && readStock(page))
    .find((found) => found);
  if (choices.huntingField && stock) state.huntingField = stock.huntingField;
  if (choices.workers && stock) state.workers = stock.workers;
  if ((choices.huntingField || choices.workers) && !stock) missing.add("Ressources");

  if (choices.buildings) state.buildings = need(pages.construction, "Construction", readBuildingLevels);
  if (choices.research) state.research = need(pages.laboratory, "Laboratoire", readResearchLevels);
  if (choices.works) {
    const works = [
      need(pages.construction, "Construction", (doc) => readWorkQueue(doc, now).items),
      need(pages.laboratory, "Laboratoire", (doc) => readWorkQueue(doc, now).items),
    ];
    state.works = works
      .flatMap((items) => items ?? [])
      .map((item) => ({ name: item.name, level: item.targetLevel, endsAt: item.endsAt }));
  }
  if (choices.army !== "none") {
    state.army = need(pages.army, "Armée", (doc) =>
      readArmy(doc, pages.resources, launches, now, choices.army === "units"),
    );
  }

  // Parts whose page did not answer are left out rather than written as undefined.
  const shared = Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined)) as SharedState;
  return { state: shared, missing: [...missing] };
}
