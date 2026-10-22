// The whole army for the advice: the garrison of Armee.php, plus the troops out attacking (Armee.php) and hunting
// (Ressources.php), which only Compte+ lists. A research raises them all.
import { readGarrison } from "@/data/garrison";
import { armyFromKeys, type Army } from "@optizzz/game/army/units";
import { readAttackLines } from "@/features/flood/attacks";
import { readOngoingHunts } from "@/features/hunt-launcher/pages";
import { readTroops } from "@optizzz/game/army/units";

export interface WholeArmy {
  army: Army;
  /** Attacks and hunts counted in `army`. */
  attacks: number;
  hunts: number;
  /** Attacks and hunts whose troops the game does not list (without Compte+). */
  unknown: number;
}

const add = (a: Army, b: Army) => a.map((count, i) => count + (b[i] ?? 0));

/** Null when `armee` is not Armee.php; `ressources` may be missing (hunts then left out). */
export function readWholeArmy(armee: Document, ressources: Document | null, now: Date): WholeArmy | null {
  const garrison = readGarrison(armee);
  if (!garrison) return null;
  const { field, nest, lodge } = garrison.armies;
  let army: Army = add(add(field, nest), lodge);
  const whole = { attacks: 0, hunts: 0, unknown: 0 };
  const away = [
    ...readAttackLines(armee, now).map((line) => ({
      kind: "attacks" as const,
      troops: line.troops && readTroops(line.troops.replace(/^Troupes en attaques\s*:/, "")),
    })),
    ...(ressources ? readOngoingHunts(ressources, now) : []).map((hunt) => ({
      kind: "hunts" as const,
      troops: hunt.troops,
    })),
  ];
  for (const { kind, troops } of away) {
    if (!troops) {
      whole.unknown++;
      continue;
    }
    army = add(army, armyFromKeys(troops));
    whole[kind]++;
  }
  return { army, ...whole };
}
