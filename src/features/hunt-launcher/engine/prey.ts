// The 17 hunt predators, in the order they take our damage. Damage and HP: game help (Bestiaire).

export interface Prey {
  name: string;
  plural: string;
  damage: number;
  hp: number;
  /** Value in the promotion formula: √(hp × damage) / 1.1, to the nearest 0.05. */
  value: number;
  /** Food each one brings back: 0.8 × value. */
  food: number;
}

const prey = (name: string, plural: string, damage: number, hp: number): Prey => {
  const value = Math.round((20 * Math.sqrt(hp * damage)) / 1.1) / 20;
  return { name, plural, damage, hp, value, food: 0.8 * value };
};

export const PREYS: readonly Prey[] = [
  prey("Petite araignée", "Petites araignées", 13, 50),
  prey("Araignée", "Araignées", 19, 75),
  prey("Chenille", "Chenilles", 30, 100),
  prey("Criquet", "Criquets", 42, 100),
  prey("Guèpe", "Guèpes", 50, 140),
  prey("Cigale", "Cigales", 70, 200),
  prey("Abeille", "Abeilles", 115, 220),
  prey("Dionée", "Dionées", 70, 700),
  prey("Hanneton", "Hannetons", 140, 450),
  prey("Scarabée", "Scarabées", 230, 1000),
  prey("Mante religieuse", "Mantes religieuses", 1200, 800),
  prey("Lézard", "Lézards", 700, 5000),
  prey("Souris", "Souris", 1400, 5000),
  prey("Mulot", "Mulots", 3000, 8000),
  prey("Alouette", "Alouettes", 10000, 30000),
  prey("Rat", "Rats", 50000, 100000),
  prey("Tamanoir", "Tamanoirs", 1000000, 5000000),
];

/** Prey counts in `PREYS` order. */
export type Pack = readonly number[];
