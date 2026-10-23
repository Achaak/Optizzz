// The combat simulator's form, apart from any view or storage: what each side holds and what the engine gets from it.
// Shared by the extension's simulator and the site's tool (docs/features/combat-simulator.md, site-combat.md).
import { countsToArmy, type Counts } from "./army-text";
import {
  battle,
  PLACES,
  spoils,
  type Attacker,
  type BattleResult,
  type Defender,
  type Place,
  type Spoils,
} from "./battle";

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

export function toBattle(form: SimulatorForm): { attacker: Attacker; defender: Defender } {
  const { attacker, defender } = form;
  return {
    attacker: { army: countsToArmy(attacker.army), weapons: attacker.weapons, shield: attacker.shield },
    defender: {
      armies: {
        field: countsToArmy(defender.armies.field),
        nest: countsToArmy(defender.armies.nest),
        lodge: countsToArmy(defender.armies.lodge),
      },
      weapons: defender.weapons,
      shield: defender.shield,
      dome: defender.dome,
      lodge: defender.lodge,
    },
  };
}

/** The fight the form describes and what it takes: the same in the extension and on the site. */
export function simulate(form: SimulatorForm): { fought: BattleResult; loot: Spoils } {
  const { attacker, defender } = toBattle(form);
  const fought = battle(attacker, defender, form.target);
  return {
    fought,
    loot: spoils(fought, form.target, {
      weapons: form.attacker.weapons,
      aphids: form.attacker.aphids,
      field: form.defender.field,
      food: form.defender.food,
      materials: form.defender.materials,
    }),
  };
}

const addCounts = (a: Counts, b: Counts): Counts => {
  const sum: Counts = { ...a };
  for (const [key, count] of Object.entries(b)) if (count) sum[key] = (sum[key] ?? 0) + count;
  return sum;
};

/**
 * « Échanger les côtés »: the players change roles. Their Weapons, Shield and hunting field go with them; the
 * defender's army, all places together, attacks, and the attacker's army defends on the hunting field. What belongs
 * to a role (the attacker's Étable à pucerons; the defender's Dôme, Loge and stock) stays with the role.
 */
export function swapSides(form: SimulatorForm): SimulatorForm {
  const { attacker, defender } = form;
  return {
    ...form,
    attacker: {
      ...attacker,
      army: PLACES.reduce<Counts>((sum, place) => addCounts(sum, defender.armies[place]), {}),
      weapons: defender.weapons,
      shield: defender.shield,
      field: defender.field,
    },
    defender: {
      ...defender,
      armies: { field: { ...attacker.army }, nest: {}, lodge: {} },
      weapons: attacker.weapons,
      shield: attacker.shield,
      field: attacker.field,
    },
  };
}
