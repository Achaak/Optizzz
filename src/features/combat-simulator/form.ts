// The simulator's form, apart from React: what fills it and what the engine gets from it.
import { PLACES, type Attacker, type Defender, type Place } from "@/game/army/battle";
import { armyFromKeys, armyToKeys, parseCounts, unitKeyOf, type Army } from "@/game/army/units";
import type { StoredLevels } from "../game-levels/levels";
import type { Garrison } from "./garrison";
import type { SimulatorSide } from "./open";

/** Unit counts by unit key; units at 0 are left out. */
export type Counts = Partial<Record<string, number>>;

export interface AttackerForm {
  army: Counts;
  weapons: number;
  shield: number;
  /** Hunting field, cm²: attacks only reach 50 % to 300 % of it. */
  field: number;
  /** Étable à pucerons: the loot. */
  aphids: number;
}

export interface DefenderForm {
  armies: Record<Place, Counts>;
  weapons: number;
  shield: number;
  dome: number;
  lodge: number;
  field: number;
  food: number;
  materials: number;
}

export interface SimulatorForm {
  attacker: AttackerForm;
  defender: DefenderForm;
  target: Place;
}

export function emptyForm(): SimulatorForm {
  return {
    attacker: { army: {}, weapons: 0, shield: 0, field: 0, aphids: 0 },
    defender: {
      armies: { field: {}, nest: {}, lodge: {} },
      weapons: 0,
      shield: 0,
      dome: 0,
      lodge: 0,
      field: 0,
      food: 0,
      materials: 0,
    },
    target: "field",
  };
}

const countsOf = (army: Army): Counts =>
  Object.fromEntries(Object.entries(armyToKeys(army)).filter(([, count]) => count > 0));

/** The player's remembered army and levels on their side; the other side is left as it is. */
export function prefill(
  form: SimulatorForm,
  side: SimulatorSide,
  garrison: Garrison | null,
  levels: Pick<StoredLevels, "weapons" | "shield" | "aphids">,
): SimulatorForm {
  const weapons = levels.weapons ?? 0;
  const shield = levels.shield ?? 0;
  if (side === "attack") {
    const whole = garrison
      ? PLACES.reduce<number[]>(
          (sum, place) => sum.map((count, i) => count + (garrison.armies[place][i] ?? 0)),
          armyFromKeys({}),
        )
      : null;
    return {
      ...form,
      attacker: {
        army: whole ? countsOf(whole) : form.attacker.army,
        weapons,
        shield,
        field: garrison?.field ?? form.attacker.field,
        aphids: levels.aphids ?? 0,
      },
    };
  }
  return {
    ...form,
    defender: {
      ...form.defender,
      armies: garrison
        ? {
            field: countsOf(garrison.armies.field),
            nest: countsOf(garrison.armies.nest),
            lodge: countsOf(garrison.armies.lodge),
          }
        : form.defender.armies,
      weapons,
      shield,
      dome: garrison?.dome ?? form.defender.dome,
      lodge: garrison?.lodge ?? form.defender.lodge,
      field: garrison?.field ?? form.defender.field,
    },
  };
}

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

const toArmy = (counts: Counts) =>
  armyFromKeys(Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, count ?? 0])));

export function toBattle(form: SimulatorForm): { attacker: Attacker; defender: Defender } {
  const { attacker, defender } = form;
  return {
    attacker: { army: toArmy(attacker.army), weapons: attacker.weapons, shield: attacker.shield },
    defender: {
      armies: {
        field: toArmy(defender.armies.field),
        nest: toArmy(defender.armies.nest),
        lodge: toArmy(defender.armies.lodge),
      },
      weapons: defender.weapons,
      shield: defender.shield,
      dome: defender.dome,
      lodge: defender.lodge,
    },
  };
}
