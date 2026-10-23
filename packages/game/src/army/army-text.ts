// An army typed or pasted as text: the troops of a report (« Troupes en défense : … ») or a plain list
// « 300 Jeunes Soldates, 2 Tanks ». Shared by the combat simulator, the flood plan and the site's tools.
import { armyFromKeys, armyToKeys, parseCounts, unitKeyOf, type Army } from "./units";

/** Unit counts by unit key; units at 0 are left out. */
export type Counts = Partial<Record<string, number>>;

const TROOPS: Record<"attack" | "defense", RegExp> = {
  attack: /Troupes en attaque\s*:\s*([^.]+)/,
  defense: /Troupes en défense\s*:\s*([^.]+)/,
};

/** Troops of a pasted report (« Troupes en défense : … »), or a plain « 300 Jeunes Soldates, 2 Tanks » list. */
export function readArmyText(text: string, role: "attack" | "defense"): { army: Counts; unknown: string[] } {
  const flat = text.replace(/\s+/g, " ");
  const list = TROOPS[role].exec(flat)?.[1] ?? flat;
  const army: Counts = {};
  const unknown: string[] = [];
  for (const [name, count] of parseCounts(list)) {
    const key = unitKeyOf(name);
    if (key) army[key] = (army[key] ?? 0) + count;
    else unknown.push(name);
  }
  return { army, unknown };
}

/** Counts by key to an army in `UNITS` order. */
export const countsToArmy = (counts: Counts): number[] =>
  armyFromKeys(Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, count ?? 0])));

/** An army to counts by key, without the units at 0. */
export const armyToCounts = (army: Army): Counts =>
  Object.fromEntries(Object.entries(armyToKeys(army)).filter(([, count]) => count > 0));
