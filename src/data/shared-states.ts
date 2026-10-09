// States the alliance members share by copy-paste (docs/features/partage-alliance.md), remembered per server.
import { storage } from "wxt/utils/storage";
import { BUILDINGS, RESEARCH, type BuildingKey, type ResearchKey } from "@/game/levels";

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

export interface ManualValue {
  value: number;
  at: Date;
}

export interface SharedStates {
  /** By nickname. */
  members: Partial<Record<string, MemberStates>>;
  /** Values entered by hand, by nickname. */
  manual: Partial<Record<string, Partial<Record<ValueKey, ManualValue>>>>;
}

/** Dates as numbers: browser storage keeps JSON only. */
interface StoredState extends Omit<SharedState, "readAt" | "works" | "army"> {
  readAt: number;
  works?: (Omit<SharedWork, "endsAt"> & { endsAt: number })[];
  army?: Omit<SharedArmy, "returnsAt"> & { returnsAt?: number };
}

interface Stored {
  alliance: string;
  members: Partial<Record<string, { latest: StoredState; previous?: StoredState }>>;
  manual: Partial<Record<string, Partial<Record<ValueKey, { value: number; at: number }>>>>;
  /** What I copied last time. */
  mine?: StoredState;
}

const key = (origin: string) => `local:allianceSharing:${new URL(origin).host}:states` as const;

function toStored(state: SharedState): StoredState {
  const { army, works, ...rest } = state;
  const stored: StoredState = { ...rest, readAt: state.readAt.getTime() };
  if (works) stored.works = works.map((work) => ({ ...work, endsAt: work.endsAt.getTime() }));
  if (army) {
    const { returnsAt, ...counts } = army;
    stored.army = returnsAt ? { ...counts, returnsAt: returnsAt.getTime() } : counts;
  }
  return stored;
}

function fromStored(stored: StoredState): SharedState {
  const { army, works, ...rest } = stored;
  const state: SharedState = { ...rest, readAt: new Date(stored.readAt) };
  if (works) state.works = works.map((work) => ({ ...work, endsAt: new Date(work.endsAt) }));
  if (army) {
    const { returnsAt, ...counts } = army;
    state.army = returnsAt === undefined ? counts : { ...counts, returnsAt: new Date(returnsAt) };
  }
  return state;
}

/** What is remembered for `alliance`: nothing when the player was in another alliance then. */
async function readStored(origin: string, alliance: string): Promise<Stored> {
  const stored = await storage.getItem<Stored>(key(origin));
  return stored?.alliance === alliance ? stored : { alliance, members: {}, manual: {} };
}

export async function loadSharedStates(origin: string, alliance: string): Promise<SharedStates> {
  const stored = await readStored(origin, alliance);
  const members: SharedStates["members"] = {};
  for (const [pseudo, states] of Object.entries(stored.members)) {
    if (!states) continue;
    members[pseudo] = { latest: fromStored(states.latest) };
    if (states.previous) members[pseudo].previous = fromStored(states.previous);
  }
  const manual: SharedStates["manual"] = {};
  for (const [pseudo, values] of Object.entries(stored.manual)) {
    manual[pseudo] = Object.fromEntries(
      Object.entries(values ?? {}).map(([valueKey, entry]) => [
        valueKey,
        { value: entry.value, at: new Date(entry.at) },
      ]),
    );
  }
  return { members, manual };
}

/** The value `state` shares for `valueKey`, if it shares it. */
export function sharedValue(state: SharedState, valueKey: ValueKey): number | undefined {
  if (valueKey === "huntingField") return state.huntingField;
  if (valueKey === "workers") return state.workers;
  if (valueKey === "army") return state.army?.total;
  const [group, level] = valueKey.split(".") as ["buildings" | "research", string];
  return (state[group] as Partial<Record<string, number>> | undefined)?.[level];
}

/** A member's value: the one entered by hand when it is newer than their latest state, else the shared one. */
export function valueOf(
  states: SharedStates,
  pseudo: string,
  valueKey: ValueKey,
): { value: number; manual: boolean; at: Date } | null {
  const latest = states.members[pseudo]?.latest;
  const shared = latest && sharedValue(latest, valueKey);
  const manual = states.manual[pseudo]?.[valueKey];
  if (manual && (!latest || shared === undefined || manual.at > latest.readAt)) return { ...manual, manual: true };
  return latest && shared !== undefined ? { value: shared, manual: false, at: latest.readAt } : null;
}

/** Enters a value by hand; null removes it, back to the shared value. */
export async function setManualValue(
  origin: string,
  alliance: string,
  pseudo: string,
  valueKey: ValueKey,
  value: number | null,
  at: Date,
): Promise<void> {
  const stored = await readStored(origin, alliance);
  const others = Object.entries(stored.manual[pseudo] ?? {}).filter(([other]) => other !== valueKey);
  stored.manual[pseudo] = Object.fromEntries(
    value === null ? others : [...others, [valueKey, { value, at: at.getTime() }]],
  );
  await storage.setItem(key(origin), stored);
}

/** Forgets the members no longer on the members page; everything when the player is now in another alliance. */
export async function forgetFormerMembers(origin: string, alliance: string, members: readonly string[]): Promise<void> {
  const stored = await readStored(origin, alliance);
  const kept = new Set(members);
  const keep = <T>(byPseudo: Partial<Record<string, T>>) =>
    Object.fromEntries(Object.entries(byPseudo).filter(([pseudo]) => kept.has(pseudo)));
  await storage.setItem(key(origin), { ...stored, members: keep(stored.members), manual: keep(stored.manual) });
}

/** Remembers what I copied, to show what changed in my next share. */
export async function rememberMyShare(origin: string, state: SharedState): Promise<void> {
  const stored = await readStored(origin, state.alliance);
  await storage.setItem(key(origin), { ...stored, mine: toStored(state) });
}

export async function loadMyLastShare(origin: string, alliance: string): Promise<SharedState | null> {
  const { mine } = await readStored(origin, alliance);
  return mine ? fromStored(mine) : null;
}

export interface ImportReport {
  updated: string[];
  /** Members whose pasted states were not newer than the one known. */
  unchanged: string[];
}

/**
 * Keeps each member's latest state and the one before it. A state older than the latest one only replaces the one
 * before when it is newer than it.
 */
export async function importStates(origin: string, alliance: string, states: SharedState[]): Promise<ImportReport> {
  const stored = await readStored(origin, alliance);
  const updated = new Set<string>();
  const seen = new Set<string>();
  for (const state of states) {
    seen.add(state.pseudo);
    const known = stored.members[state.pseudo];
    const time = state.readAt.getTime();
    if (!known || time > known.latest.readAt) {
      stored.members[state.pseudo] = known
        ? { latest: toStored(state), previous: known.latest }
        : { latest: toStored(state) };
      updated.add(state.pseudo);
    } else if (time < known.latest.readAt && time > (known.previous?.readAt ?? 0)) {
      known.previous = toStored(state);
    }
  }
  await storage.setItem(key(origin), stored);
  return { updated: [...updated], unchanged: [...seen].filter((pseudo) => !updated.has(pseudo)) };
}
