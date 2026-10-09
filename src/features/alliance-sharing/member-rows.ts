// The rows of the alliance's table (« Partage »), from the states remembered (docs/features/partage-alliance.md).
import {
  sharedValue,
  valueOf,
  VALUE_KEYS,
  type SharedStates,
  type SharedWork,
  type ValueKey,
} from "@/data/shared-states";
import { BUILDINGS, RESEARCH, sameName } from "@/game/levels";

const HOUR = 60 * 60_000;
/** A change stays highlighted this long after the state that shows it was read. */
const CHANGE_MS = 24 * HOUR;
/** Past this age, a state is greyed. */
const STALE_MS = 3 * 24 * HOUR;

export interface Cell {
  value: number;
  manual: boolean;
  /** Against the state before, when the latest one is less than 24 hours old. */
  change: "up" | "down" | null;
}

export interface MemberRow {
  pseudo: string;
  /** When the member's latest state was read; null when they shared nothing. */
  readAt: Date | null;
  stale: boolean;
  cells: Partial<Record<ValueKey, Cell>>;
  works: (SharedWork & { done: boolean })[];
  /** Troops away could not be counted in the army. */
  armyIncomplete: boolean;
  armyReturnsAt: Date | null;
}

/** The level key a work raises: « Armes » → research.weapons. */
function workKey(name: string): ValueKey | null {
  const building = BUILDINGS.find((candidate) => sameName(candidate.name, name));
  if (building) return `buildings.${building.key}`;
  const research = RESEARCH.find((candidate) => sameName(candidate.name, name));
  return research ? `research.${research.key}` : null;
}

export function memberRows(members: readonly string[], states: SharedStates, now: Date): MemberRow[] {
  return members.map((pseudo) => {
    const known = states.members[pseudo];
    const latest = known?.latest;
    const works = (latest?.works ?? []).map((work) => ({ ...work, done: work.endsAt <= now }));
    const recent = !!latest && now.getTime() - latest.readAt.getTime() < CHANGE_MS;

    const cells: MemberRow["cells"] = {};
    for (const valueKey of VALUE_KEYS) {
      const value = valueOf(states, pseudo, valueKey);
      if (!value) continue;
      let shown = value.value;
      if (!value.manual) {
        for (const work of works) if (work.done && workKey(work.name) === valueKey) shown = Math.max(shown, work.level);
      }
      const before = known?.previous && sharedValue(known.previous, valueKey);
      const change =
        value.manual || !recent || before === undefined || before === shown ? null : shown > before ? "up" : "down";
      cells[valueKey] = { value: shown, manual: value.manual, change };
    }

    return {
      pseudo,
      readAt: latest?.readAt ?? null,
      stale: !!latest && now.getTime() - latest.readAt.getTime() > STALE_MS,
      cells,
      works,
      armyIncomplete: latest?.army?.incomplete ?? false,
      armyReturnsAt: latest?.army?.returnsAt ?? null,
    };
  });
}
