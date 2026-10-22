// A laying template: several units laid one after the other. See docs/features/laying-templates.md.
import type { Place } from "@optizzz/game/army/battle";
import { UNITS, WORKER_FOOD, WORKER_LAYING_SECONDS } from "@optizzz/game/army/units";
import { dailyBalance, timeToAfford, type Affordability, type ColonyState } from "@optizzz/game/forecast";
import { MAX_LAYING_MS, maxAffordable, nextParisTime, UPKEEP } from "@/features/laying-planner/laying";

const HOUR = 3_600_000;

/** Unit key, or « worker ». */
export type LayingUnit = string;
export const WORKER = "worker";

export interface TemplateLine {
  unit: LayingUnit;
  /** Ignored for workers. */
  destination: Place;
  /** The count laid, or the line's share when the template has a target. */
  amount: number;
}

/** What the template's shares are scaled to. */
export type Target =
  /** The template itself lasts this long. */
  | { kind: "duration"; hours: number }
  /** It ends at the next time a Paris clock shows this, after the queue. */
  | { kind: "until"; clock: { hours: number; minutes: number } }
  /** What the food pays now. */
  | { kind: "food" };

export interface Template {
  lines: readonly TemplateLine[];
  /** Null: the amounts are the counts laid in each rotation. */
  target: Target | null;
  /**
   * How many times the lines take turns in the queue (1 by default): with 10, the units come out mixed over the whole
   * laying instead of one after the other. Fixed amounts are laid once per rotation; a target covers all of them.
   */
  rotations?: number;
}

export interface PlanContext {
  /** The player's laying speed, bonuses included (`readLayingSpeed`). */
  speed: number;
  state: ColonyState;
  /** When the layings already queued end (now when none). */
  queueEnd: Date;
  /** Unit keys the player can lay; workers always can. */
  layable: readonly string[];
  /** When `state` was read. */
  readAt: Date;
  now: Date;
}

export interface LinePlan extends TemplateLine {
  count: number;
  food: number;
  /** Milliseconds. */
  duration: number;
  /** Null when it can never be paid. */
  endsAt: Date | null;
  /** Not unlocked on this server yet. */
  locked: boolean;
  /** Longer than the week the game's slider offers: the game may refuse it. */
  tooLong: boolean;
}

/** One laying sent to the game: a line's share of one rotation. */
export interface Laying {
  /** Index of its line in the template. */
  line: number;
  unit: LayingUnit;
  destination: Place;
  count: number;
  food: number;
  /** Milliseconds. */
  duration: number;
  /** Null when it can never be paid. */
  endsAt: Date | null;
  tooLong: boolean;
}

export interface TemplatePlan {
  /** Each line's totals over all rotations; it ends with its last laying. */
  lines: LinePlan[];
  /** In queue order: each rotation's lines, empty ones left out. */
  layings: Laying[];
  food: number;
  duration: number;
  affordability: Affordability;
  upkeepPerDay: number;
  balanceAfter: number;
  /** Something to lay, every unit unlocked, and all of it paid now. */
  launchable: boolean;
}

/** Food and milliseconds to lay one. */
export function unitCost(unit: LayingUnit, speed: number): { food: number; duration: number } {
  if (unit === WORKER) return { food: WORKER_FOOD, duration: WORKER_LAYING_SECONDS * speed * 1000 };
  const known = UNITS.find((candidate) => candidate.key === unit);
  return { food: known?.food ?? 0, duration: (known?.layingSeconds ?? 0) * speed * 1000 };
}

/** How many times the shares fit the target; null without one. */
function scaleFactor(template: Template, context: PlanContext): number | null {
  const { target } = template;
  if (!target) return null;
  if (target.kind === "food") {
    const shareFood = template.lines.reduce(
      (sum, line) => sum + Math.max(0, line.amount) * unitCost(line.unit, context.speed).food,
      0,
    );
    return shareFood > 0 ? maxAffordable(1, context.state, context.now, context.readAt) / shareFood : 0;
  }
  const shareDuration = template.lines.reduce(
    (sum, line) => sum + Math.max(0, line.amount) * unitCost(line.unit, context.speed).duration,
    0,
  );
  const start = new Date(Math.max(context.now.getTime(), context.queueEnd.getTime()));
  const wanted =
    target.kind === "duration" ? target.hours * HOUR : nextParisTime(start, target.clock).getTime() - start.getTime();
  return shareDuration > 0 ? wanted / shareDuration : 0;
}

/** `total` split into `parts` as evenly as whole units allow, the first parts taking the extra ones. */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, i) => base + (i < total % parts ? 1 : 0));
}

/** The whole template is paid when launched, then each laying waits for the one before it. */
export function planTemplate(template: Template, context: PlanContext): TemplatePlan {
  const { state, now } = context;
  const rotations = Math.max(1, Math.floor(template.rotations ?? 1));
  const factor = scaleFactor(template, context);
  // Food: rounded down, so that the whole template stays payable.
  const round = template.target?.kind === "food" ? Math.floor : Math.round;
  const totals = template.lines.map((line) =>
    Math.max(0, factor === null ? Math.floor(line.amount) * rotations : round(line.amount * factor)),
  );
  const shares = totals.map((total) => split(total, rotations));

  const food = template.lines.reduce(
    (sum, line, i) => sum + (totals[i] ?? 0) * unitCost(line.unit, context.speed).food,
    0,
  );
  const affordability = timeToAfford(state, { food, materials: 0, workers: 0 }, context.readAt);
  const paidAt = affordability.kind === "now" ? now : affordability.kind === "at" ? affordability.at : null;
  let end = paidAt ? Math.max(paidAt.getTime(), context.queueEnd.getTime()) : null;
  const layings: Laying[] = [];
  for (let rotation = 0; rotation < rotations; rotation++) {
    template.lines.forEach((line, i) => {
      const count = shares[i]?.[rotation] ?? 0;
      if (count === 0) return;
      const cost = unitCost(line.unit, context.speed);
      const duration = count * cost.duration;
      if (end !== null) end += duration;
      layings.push({
        line: i,
        unit: line.unit,
        destination: line.destination,
        count,
        food: count * cost.food,
        duration,
        endsAt: end === null ? null : new Date(end),
        tooLong: duration > MAX_LAYING_MS,
      });
    });
  }

  const lines = template.lines.map((line, i): LinePlan => {
    const own = layings.filter((laying) => laying.line === i);
    return {
      ...line,
      count: totals[i] ?? 0,
      food: own.reduce((sum, laying) => sum + laying.food, 0),
      duration: own.reduce((sum, laying) => sum + laying.duration, 0),
      endsAt: own.at(-1)?.endsAt ?? null,
      locked: line.unit !== WORKER && !context.layable.includes(line.unit),
      tooLong: own.some((laying) => laying.tooLong),
    };
  });
  const upkeepPerDay = lines.reduce(
    (sum, line) => sum + (line.unit === WORKER ? 0 : line.food * UPKEEP[line.destination]),
    0,
  );
  return {
    lines,
    layings,
    food,
    duration: layings.reduce((sum, laying) => sum + laying.duration, 0),
    affordability,
    upkeepPerDay,
    balanceAfter: dailyBalance(state).food - upkeepPerDay,
    launchable: affordability.kind === "now" && layings.length > 0 && !lines.some((line) => line.locked),
  };
}
