// A member's state as the alliance shares it (docs/features/partage-alliance.md): copied from « Mon état » and pasted
// in Discord, or sent to the Alliance Space as Envois (docs/features/site-envois.md). The extension's « Partage » view
// and the space's « État » tab merge both, the newest reading of each part winning.
import { BUILDINGS, RESEARCH, type BuildingKey, type ResearchKey } from "../levels";

export interface SharedWork {
  /** As the game writes it: « Armes », « Champignonnière ». */
  name: string;
  /** The level reached when it ends. */
  level: number;
  endsAt: Date;
}

export interface SharedArmy {
  total: number;
  /** By unit key (« JSN »), when the player shares the detail. */
  units?: Partial<Record<string, number>>;
  /** Some troops are away and could not be counted (hunt without Compte+, attack sent outside the flood plan). */
  incomplete: boolean;
  /** When the troops away come back, if known. */
  returnsAt?: Date;
}

/** A colony and what it brought its master since it was taken, as colonies.php writes it. */
export interface SharedColony {
  pseudo: string;
  /** When it was taken (« Cette colonie vous appartient depuis … »). */
  since: Date;
  food: number;
  materials: number;
}

/** What the Production of GLOSSARY.md is computed from (Envoi « Production », never copied). */
export interface SharedProduction {
  /** Workers on each harvest, and the mushroom farm a day (Ressources.php). */
  foodWorkers: number;
  materialWorkers: number;
  mushroomPerDay: number;
  /** Share the colonizer takes, between 0 and 1: 0 when free. */
  taxRate: number;
  /** Who colonizes the member; null when free or unknown. */
  master: string | null;
  /** The member's colonies; null when colonies.php was never read. */
  colonies: SharedColony[] | null;
}

/** A hunt in progress (Envoi « Chasses »). */
export interface SharedHunt {
  returnsAt: Date;
  /** Hunting field it brings back, cm². */
  fieldGain: number;
}

/** What a member shared, each part only when they chose to share it. */
export interface SharedState {
  /** « s5 ». */
  server: string;
  /** Alliance tag. */
  alliance: string;
  pseudo: string;
  readAt: Date;
  huntingField?: number;
  workers?: number;
  buildings?: Partial<Record<BuildingKey, number>>;
  research?: Partial<Record<ResearchKey, number>>;
  works?: SharedWork[];
  army?: SharedArmy;
  production?: SharedProduction;
  hunts?: SharedHunt[];
  /** The warehouses' content and when the header showed it (Envoi « Production », never copied). */
  stock?: { food: number; materials: number; at: Date };
  /** The warehouses' capacities (Envoi « Niveaux et chantiers », never copied). */
  capacities?: { food: number; materials: number };
}

/** A member's states: the latest, and the one before it to show what changed. */
export interface MemberStates {
  latest: SharedState;
  previous?: SharedState;
}

/** A value of a member that can be shared or entered by hand. */
export type ValueKey = "huntingField" | "workers" | "army" | `buildings.${BuildingKey}` | `research.${ResearchKey}`;

/** Every value, in display order. */
export const VALUE_KEYS: readonly ValueKey[] = [
  "huntingField",
  "workers",
  "army",
  ...BUILDINGS.map((building) => `buildings.${building.key}` as const),
  ...RESEARCH.map((research) => `research.${research.key}` as const),
];

/** The value `state` shares for `valueKey`, if it shares it. */
export function sharedValue(state: SharedState, valueKey: ValueKey): number | undefined {
  if (valueKey === "huntingField") return state.huntingField;
  if (valueKey === "workers") return state.workers;
  if (valueKey === "army") return state.army?.total;
  const [group, level] = valueKey.split(".") as ["buildings" | "research", string];
  return (state[group] as Partial<Record<string, number>> | undefined)?.[level];
}

/** The parts of a state, each read on its own page and merged on its own. */
const PARTS = [
  "huntingField",
  "workers",
  "buildings",
  "research",
  "works",
  "army",
  "production",
  "hunts",
  "stock",
  "capacities",
] as const satisfies readonly (keyof SharedState)[];

/**
 * One member's states from several sources (pasted lines, Envois of each category) merged: for each part, the newest
 * reading that has it wins, and the one before it (an older reading of that part, from any source) shows what
 * changed. A reading seen twice (the same time) counts once. The merged state is dated by its newest part.
 */
export function mergeMemberStates(sources: readonly MemberStates[]): MemberStates | null {
  const [first] = sources;
  if (!first) return null;
  const readings = sources.flatMap((s) => (s.previous ? [s.latest, s.previous] : [s.latest]));
  const base = { server: first.latest.server, alliance: first.latest.alliance, pseudo: first.latest.pseudo };
  const latest: SharedState = { ...base, readAt: new Date(0) };
  const previous: SharedState = { ...base, readAt: new Date(0) };
  let hasPrevious = false;
  for (const part of PARTS) {
    const having = readings
      .filter((reading) => reading[part] !== undefined)
      .sort((a, b) => b.readAt.getTime() - a.readAt.getTime());
    const [newest] = having;
    if (!newest) continue;
    Object.assign(latest, { [part]: newest[part] });
    if (newest.readAt > latest.readAt) latest.readAt = newest.readAt;
    const before = having.find((reading) => reading.readAt < newest.readAt);
    if (!before) continue;
    Object.assign(previous, { [part]: before[part] });
    if (before.readAt > previous.readAt) previous.readAt = before.readAt;
    hasPrevious = true;
  }
  if (latest.readAt.getTime() === 0) latest.readAt = first.latest.readAt;
  return hasPrevious ? { latest, previous } : { latest };
}
