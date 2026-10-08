// Who can take hunting field from whom, and in which order: see docs/features/chaine-tdc.md.
import { inRange } from "@/game/flood";
import { rungs, type Role } from "./roles";

/** What a won attack takes on the hunting field, 1 cm² per ant at most (tutorial « Attaque »). */
const fullTake = (field: number) => Math.floor(field * 0.2);

/** Attacker by target: what a won attack takes, or null when out of range (or the same member). */
export function takeMatrix(members: readonly { field: number }[]): (number | null)[][] {
  return members.map((attacker, i) =>
    members.map((target, j) => (i !== j && inRange(attacker.field, target.field) ? fullTake(target.field) : null)),
  );
}

export interface ChainMember {
  id: number;
  field: number;
  /** Attacks it can have under way at once: Attack Speed + 1. */
  slots: number;
}

/** One attack of the plan: `attackerId` takes `take` cm² from `targetId`. */
export interface Hit {
  attackerId: number;
  targetId: number;
  take: number;
  attackerAfter: number;
  targetAfter: number;
}

/**
 * Field moved from `path[0]` up to its last member, each one attacking the one before. `up`: the first link
 * lands first (the field climbs); `down`: the top link lands first (the passers lend before they get it back).
 */
export interface Transfer {
  path: number[];
  order: "up" | "down";
  hits: Hit[];
  moved: number;
}

type State = Map<number, { field: number; slots: number }>;

const cloneState = (state: State): State => new Map([...state].map(([id, entry]) => [id, { ...entry }]));

/** Whether the target is in range at the arrival, `margin` above the 50 % limit: other moves may land first. */
const inRangeWithMargin = (attacker: number, target: number, margin: number) =>
  target * 2 >= attacker * (1 + margin) && target < attacker * 3;

/**
 * The attacks for `attackerId` to take `amount` from `targetId`, changing `state`: 20 % each while the target stays
 * in range for the next one, else the largest take that keeps it at the limit, then a last 20 %.
 */
function link(state: State, attackerId: number, targetId: number, amount: number, margin: number): Hit[] {
  const attacker = state.get(attackerId);
  const target = state.get(targetId);
  if (!attacker || !target) return [];
  const hits: Hit[] = [];
  let left = amount;
  while (left > 0 && attacker.slots > 0 && inRangeWithMargin(attacker.field, target.field, margin)) {
    let take = Math.min(fullTake(target.field), left);
    let last = false;
    if (take < left && !inRangeWithMargin(attacker.field + take, target.field - take, margin)) {
      const limit = Math.floor((2 * target.field - (1 + margin) * attacker.field) / (3 + margin));
      if (attacker.slots > 1 && limit > 0) take = Math.min(take, limit);
      else last = true;
    }
    if (take <= 0) break;
    attacker.field += take;
    target.field -= take;
    attacker.slots -= 1;
    left -= take;
    hits.push({ attackerId, targetId, take, attackerAfter: attacker.field, targetAfter: target.field });
    if (last) break;
  }
  return hits;
}

/**
 * Shortest path from `from` to `to`, each member able to attack the one before with an attack left (any number with
 * `ignoreSlots`); null when there is none.
 */
function shortestPath(
  state: State,
  from: number,
  to: number,
  canFlood: (attackerId: number, targetId: number) => boolean,
  margin: number,
  ignoreSlots = false,
): number[] | null {
  const previous = new Map<number, number>([[from, from]]);
  const queue = [from];
  for (let current = queue.shift(); current !== undefined && current !== to; current = queue.shift()) {
    const currentField = state.get(current)?.field ?? 0;
    for (const [id, { field, slots }] of state) {
      if (previous.has(id) || (!ignoreSlots && slots <= 0) || !canFlood(id, current)) continue;
      if (!inRangeWithMargin(field, currentField, margin)) continue;
      previous.set(id, current);
      queue.push(id);
    }
  }
  if (!previous.has(to)) return null;
  const path = [to];
  for (let step = to; step !== from;) {
    step = previous.get(step) ?? from;
    path.unshift(step);
  }
  return path;
}

function runPath(state: State, path: number[], order: Transfer["order"], amount: number, margin: number) {
  const links = path.slice(1).map((attackerId, i) => ({ attackerId, targetId: path[i] ?? attackerId }));
  if (order === "down") links.reverse();
  const hits = links.map(({ attackerId, targetId }) => link(state, attackerId, targetId, amount, margin));
  const moved = Math.min(...hits.map((linkHits) => linkHits.reduce((sum, hit) => sum + hit.take, 0)));
  return { hits: hits.flat(), moved };
}

/** Each link moves what the weakest one can: the passers end where they started. */
function transferOn(
  state: State,
  path: number[],
  order: Transfer["order"],
  amount: number,
  margin: number,
): { transfer: Transfer; state: State } {
  let wanted = amount;
  for (;;) {
    const after = cloneState(state);
    const { hits, moved } = runPath(after, path, order, wanted, margin);
    if (moved >= wanted || moved <= 0) {
      return {
        transfer: { path, order, hits: moved > 0 ? hits : [], moved: Math.max(moved, 0) },
        state: moved > 0 ? after : state,
      };
    }
    wanted = moved;
  }
}

/** The best of both orders on `state`: the one that moves the most, `up` on a tie. */
function bestTransfer(state: State, path: number[], amount: number, margin: number) {
  const up = transferOn(state, path, "up", amount, margin);
  const down = transferOn(state, path, "down", amount, margin);
  return down.transfer.moved > up.transfer.moved ? down : up;
}

const toState = (members: readonly ChainMember[]): State =>
  new Map(members.map(({ id, field, slots }) => [id, { field, slots }]));

/**
 * Where the chain breaks. `range`: nobody `below` reaches can be attacked by `above`; `attacks`: the fields would
 * allow it, but the members on the way have no attack left.
 */
export interface Gap {
  below: number;
  above: number;
  reason: "range" | "attacks";
}

/** The member reached from `from` closest under `to`'s field: where a passer is missing. */
function gapTo(
  state: State,
  from: number,
  to: number,
  canFlood: (attackerId: number, targetId: number) => boolean,
  margin: number,
): Gap {
  if (shortestPath(state, from, to, canFlood, margin, true)) return { below: from, above: to, reason: "attacks" };
  const toField = state.get(to)?.field ?? 0;
  let below = from;
  for (const [id, { field }] of state) {
    if (field >= toField || field <= (state.get(below)?.field ?? 0)) continue;
    if (shortestPath(state, from, id, canFlood, margin, true)) below = id;
  }
  return { below, above: to, reason: "range" };
}

/** Moves `amount` cm² from `from` to `to`, through other members when needed, or names the gap. */
export function planTransfer(
  members: readonly ChainMember[],
  { from, to, amount }: { from: number; to: number; amount: number },
  margin: number,
): Transfer | { gap: Gap } {
  const state = toState(members);
  const path = shortestPath(state, from, to, () => true, margin);
  if (!path) return { gap: gapTo(state, from, to, () => true, margin) };
  return bestTransfer(state, path, amount, margin).transfer;
}

/**
 * The passers missing between a giver of `lower` cm² and a receiver of `upper`: with one, the fields it may have
 * (the receiver can attack it, it can attack the giver).
 */
export function bridge(
  lower: number,
  upper: number,
  margin: number,
): { passers: 1; min: number; max: number } | { passers: number } {
  const min = Math.ceil((upper * (1 + margin)) / 2);
  const max = Math.floor((2 * lower) / (1 + margin));
  if (min <= max) return { passers: 1, min, max };
  const reach = 2 / (1 + margin);
  return { passers: Math.max(2, Math.ceil(Math.log(upper / lower) / Math.log(reach)) - 1) };
}

export interface ChainInput {
  members: readonly ChainMember[];
  roles: ReadonlyMap<number, Role>;
  /** Field each hunter keeps; a hunter without one gives nothing. */
  keep: ReadonlyMap<number, number>;
}

export interface ChainPlan {
  /** In landing order, one per hunter. */
  transfers: (Transfer & { from: number; to: number })[];
  /** Hunters that reach no granary. */
  gaps: (Gap & { from: number })[];
}

/**
 * Each hunter's field above what it keeps climbs to a granary, the smallest it can reach at that time, biggest
 * surplus first. Only a higher rung attacks a lower one; passers end where they started.
 */
export function planChain({ members, roles, keep }: ChainInput, margin: number): ChainPlan {
  const heights = rungs(roles);
  const canFlood = (attackerId: number, targetId: number) => {
    const attacker = heights.get(attackerId);
    const target = heights.get(targetId);
    return attacker !== undefined && target !== undefined && attacker > target;
  };
  let state = toState(members.filter((member) => heights.has(member.id)));
  const fieldOf = (id: number) => state.get(id)?.field ?? 0;
  const granaries = [...roles].filter(([, role]) => role.kind === "granary").map(([id]) => id);
  const surplus = (id: number) => fieldOf(id) - (keep.get(id) ?? fieldOf(id));
  const givers = [...roles]
    .filter(([id, role]) => role.kind === "hunter" && state.has(id) && surplus(id) > 0)
    .map(([id]) => id)
    .sort((a, b) => surplus(b) - surplus(a));

  const plan: ChainPlan = { transfers: [], gaps: [] };
  for (const from of givers) {
    const targets = granaries.filter((id) => state.has(id)).sort((a, b) => fieldOf(a) - fieldOf(b));
    const transfer = targets
      .map((to) => {
        const path = shortestPath(state, from, to, canFlood, margin);
        return { to, best: path && bestTransfer(state, path, surplus(from), margin) };
      })
      .find(({ best }) => best && best.transfer.moved > 0);
    if (transfer?.best) {
      state = transfer.best.state;
      plan.transfers.push({ from, to: transfer.to, ...transfer.best.transfer });
      continue;
    }
    const smallest = targets[0];
    if (smallest !== undefined) plan.gaps.push({ from, ...gapTo(state, from, smallest, canFlood, margin) });
  }
  return plan;
}
