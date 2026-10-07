// Ant units as a hunt sees them. Order matters: it is the order in which our units take the prey's damage.
// Figures: game help, Reine.php and docs/research/combat.md (elite Doorkeeper and Tank: Calystene, Outiiil);
// promotion weights from the « Chasse à zéro perte » reconstruction (docs/research/chasse.md).

export interface Unit {
  key: string;
  /** Number of the `uniteN` field of the hunt form (AcquerirTerrain.php). */
  field: number;
  name: string;
  /** As written in reports and on Ressources.php (« 1 975 Jeunes Soldates Naines »). */
  plural: string;
  hp: number;
  attack: number;
  /** Damage dealt when defending (fights between players). */
  defense: number;
  /** Food needed to lay one. */
  food: number;
  /** Weight in the promotion formula. */
  weight: number;
  /** Key of the unit it becomes when promoted. */
  promotesTo: string | null;
}

export const UNITS: readonly Unit[] = [
  {
    key: "JSN",
    field: 1,
    name: "Jeune Soldate Naine",
    plural: "Jeunes Soldates Naines",
    hp: 8,
    attack: 3,
    defense: 2,
    food: 16,
    weight: 85,
    promotesTo: "SN",
  },
  {
    key: "SN",
    field: 2,
    name: "Soldate Naine",
    plural: "Soldates Naines",
    hp: 10,
    attack: 5,
    defense: 4,
    food: 20,
    weight: 125,
    promotesTo: "NE",
  },
  {
    key: "NE",
    field: 3,
    name: "Naine d’Elite",
    plural: "Naines d’Elite",
    hp: 13,
    attack: 7,
    defense: 6,
    food: 26,
    weight: 170,
    promotesTo: null,
  },
  {
    key: "JS",
    field: 4,
    name: "Jeune Soldate",
    plural: "Jeunes Soldates",
    hp: 16,
    attack: 10,
    defense: 9,
    food: 30,
    weight: 227,
    promotesTo: "S",
  },
  {
    key: "S",
    field: 5,
    name: "Soldate",
    plural: "Soldates",
    hp: 20,
    attack: 15,
    defense: 14,
    food: 36,
    weight: 312,
    promotesTo: "SE",
  },
  {
    key: "C",
    field: 6,
    name: "Concierge",
    plural: "Concierges",
    hp: 30,
    attack: 1,
    defense: 25,
    food: 70,
    weight: 434,
    promotesTo: null,
  },
  {
    key: "CE",
    field: 14,
    name: "Concierge d’élite",
    plural: "Concierges d’élite",
    hp: 40,
    attack: 1,
    defense: 35,
    food: 100,
    weight: 592,
    promotesTo: null,
  },
  {
    key: "A",
    field: 7,
    name: "Artilleuse",
    plural: "Artilleuses",
    hp: 10,
    attack: 30,
    defense: 15,
    food: 30,
    weight: 295,
    promotesTo: "AE",
  },
  {
    key: "AE",
    field: 8,
    name: "Artilleuse d’élite",
    plural: "Artilleuses d’élite",
    hp: 12,
    attack: 35,
    defense: 18,
    food: 34,
    weight: 349,
    promotesTo: null,
  },
  {
    key: "SE",
    field: 9,
    name: "Soldate d’élite",
    plural: "Soldates d’élite",
    hp: 27,
    attack: 24,
    defense: 23,
    food: 44,
    weight: 460,
    promotesTo: null,
  },
  {
    key: "Tk",
    field: 10,
    name: "Tank",
    plural: "Tanks",
    hp: 35,
    attack: 55,
    defense: 1,
    food: 100,
    weight: 642,
    promotesTo: null,
  },
  {
    key: "TkE",
    field: 13,
    name: "Tank d’élite",
    plural: "Tanks d’élite",
    hp: 50,
    attack: 80,
    defense: 1,
    food: 150,
    weight: 990,
    promotesTo: null,
  },
  {
    key: "Tu",
    field: 11,
    name: "Tueuse",
    plural: "Tueuses",
    hp: 50,
    attack: 50,
    defense: 50,
    food: 80,
    weight: 909,
    promotesTo: "TuE",
  },
  {
    key: "TuE",
    field: 12,
    name: "Tueuse d’élite",
    plural: "Tueuses d’élite",
    hp: 55,
    attack: 55,
    defense: 55,
    food: 90,
    weight: 1000,
    promotesTo: null,
  },
];

/** Unit counts in `UNITS` order. */
export type Army = readonly number[];

export const emptyArmy = (): number[] => UNITS.map(() => 0);

export function armyFromKeys(counts: Readonly<Record<string, number>>): number[] {
  return UNITS.map((unit) => counts[unit.key] ?? 0);
}

export function armyToKeys(army: Army): Record<string, number> {
  return Object.fromEntries(UNITS.map((unit, i) => [unit.key, army[i] ?? 0]));
}

export interface Levels {
  weapons: number;
  shield: number;
  huntSpeed: number;
  /** Étable à cochenilles, boosts promotions. */
  cochineal: number;
}

/** Total attack with the Weapons bonus. */
export function armyAttack(army: Army, levels: Pick<Levels, "weapons">): number {
  let attack = 0;
  army.forEach((count, i) => (attack += count * (UNITS[i]?.attack ?? 0)));
  return attack * (1 + 0.1 * levels.weapons);
}

/** What the army cost to lay, in food: the yardstick for losses. */
export function armyFood(army: Army): number {
  let food = 0;
  army.forEach((count, i) => (food += count * (UNITS[i]?.food ?? 0)));
  return food;
}

/** Unit key from its name as the game writes it, singular or plural; `undefined` when unknown. */
export function unitKeyOf(name: string): string | undefined {
  const normalized = name.replace(/'/g, "’").trim().toLowerCase();
  return UNITS.find(
    (unit) =>
      unit.plural.toLowerCase() === normalized ||
      unit.name.toLowerCase() === normalized ||
      unit.key.toLowerCase() === normalized,
  )?.key;
}

/** « 1 921 Jeunes Soldates Naines, 119 Soldates Naines » → name → count, names as written. */
export function parseCounts(text: string): [string, number][] {
  return text.split(",").flatMap((part) => {
    const match = /^\s*(\d{1,3}(?:\s\d{3})*|\d+)\s+(\D.*?)[\s.]*$/.exec(part);
    return match?.[1] && match[2] ? [[match[2], Number(match[1].replace(/\D/g, ""))] as [string, number]] : [];
  });
}
