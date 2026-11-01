// The Plan de passage of an alliance's chain (docs/features/site-chaine.md, « Plan de passage »): the members' fields
// over time, with the floods already on their way and the hunts coming back, and the floods to launch so that the
// field climbs from the hunters to the granaries without touching one already on its way. A flood on its way keeps the
// take its sender expected: nothing planned lands before it on its target, nor on its attacker.
import { inRange, maxTake } from "../attack";
import { planChain, type Gap } from "./chain";
import type { Role } from "./roles";
import { ARRIVAL_SPACING_SECONDS, LEAD_SECONDS } from "./schedule";

export interface PassageMember {
  id: number;
  pseudo: string;
  /** The field when it was read, at `fieldAt`: what landed before is in it already. */
  field: number;
  fieldAt: number;
}

/** A flood on its way, as the Envoi « Floods » tells it: `take` is the Plan de flood's, null without it. */
export interface FloodOnWay {
  from: string;
  target: string;
  at: number;
  take: number | null;
}

export interface HuntReturn {
  memberId: number;
  at: number;
  gain: number;
}

/**
 * A flood on its way between members, at its arrival: `holds` takes what it expected, `reduced` takes less because
 * another landed before it on the same target (`before` names that one's sender), `fails` lands out of range and takes
 * nothing.
 */
export interface ProjectedFlood {
  from: string;
  target: string;
  at: number;
  expected: number;
  actual: number;
  status: "holds" | "reduced" | "fails";
  targetBefore: number;
  targetAfter: number;
  before: string | null;
}

export interface ChainProjection {
  /** The floods on their way to a member, by arrival. */
  floods: ProjectedFlood[];
  /** A member's field at `time`, all that landed by then counted. */
  fieldAt: (memberId: number, time: number) => number;
}

/** A change of a member's field at a time. */
interface Move {
  memberId: number;
  at: number;
  delta: number;
}

const key = (pseudo: string) => pseudo.toLowerCase();

export function projectChain(input: {
  members: readonly PassageMember[];
  floods: readonly FloodOnWay[];
  hunts: readonly HuntReturn[];
}): ChainProjection {
  const byPseudo = new Map(input.members.map((m) => [key(m.pseudo), m]));
  const byId = new Map(input.members.map((m) => [m.id, m]));
  const moves: Move[] = input.hunts.map((h) => ({ memberId: h.memberId, at: h.at, delta: h.gain }));
  // What landed before a member's field was read is in that field already.
  const counts = (memberId: number, at: number) => at > (byId.get(memberId)?.fieldAt ?? Infinity);
  const fieldAt = (memberId: number, time: number) =>
    moves.reduce(
      (field, move) =>
        move.memberId === memberId && move.at <= time && counts(memberId, move.at) ? field + move.delta : field,
      byId.get(memberId)?.field ?? 0,
    );

  const floods: ProjectedFlood[] = [];
  const sorted = [...input.floods].sort(
    (a, b) => a.at - b.at || key(a.from).localeCompare(key(b.from)) || key(a.target).localeCompare(key(b.target)),
  );
  for (const flood of sorted) {
    const target = byPseudo.get(key(flood.target));
    const attacker = byPseudo.get(key(flood.from));
    if (!target) {
      // On someone outside the chain: only its sender's field moves, by what it expected.
      if (attacker && flood.take !== null) moves.push({ memberId: attacker.id, at: flood.at, delta: flood.take });
      continue;
    }
    const before = fieldAt(target.id, flood.at - 1);
    const attackerField = attacker ? fieldAt(attacker.id, flood.at - 1) : null;
    const expected = flood.take ?? maxTake(before);
    const fails = attackerField !== null && !inRange(attackerField, before);
    const actual = fails ? 0 : Math.min(expected, maxTake(before));
    const previous = floods.findLast((f) => key(f.target) === key(target.pseudo) && f.status !== "fails");
    floods.push({
      from: attacker?.pseudo ?? flood.from,
      target: target.pseudo,
      at: flood.at,
      expected,
      actual,
      status: fails ? "fails" : actual < expected ? "reduced" : "holds",
      targetBefore: before,
      targetAfter: before - actual,
      before: !fails && actual < expected ? (previous?.from ?? null) : null,
    });
    if (actual === 0) continue;
    moves.push({ memberId: target.id, at: flood.at, delta: -actual });
    if (attacker) moves.push({ memberId: attacker.id, at: flood.at, delta: actual });
  }
  return { floods, fieldAt };
}

export interface PlanInput {
  members: readonly PassageMember[];
  roles: ReadonlyMap<number, Role>;
  /** Field each hunter keeps. */
  keep: ReadonlyMap<number, number>;
  floods: readonly FloodOnWay[];
  hunts: readonly HuntReturn[];
  /** Attacks each member may have on their way at once: Attack Speed + 1. */
  slots: ReadonlyMap<number, number>;
  /** Each member's army, when known (Envoi « Armée »): it caps a flood's take. */
  ants?: ReadonlyMap<number, number>;
  now: number;
  /** How far ahead floods are planned, in ms. */
  horizon: number;
  /** The trip of an attack; `approx` when the attacker's Attack Speed is unknown. */
  travel: (attackerId: number, targetId: number) => { seconds: number; approx: boolean };
  /** Kept above the 50 % limit, as the Plan de flood: 0.01. */
  margin: number;
}

/** A flood to launch: `attackerId` takes `take` from `targetId`, landing at `arrival`, leaving between the two times. */
export interface Launch {
  /** Its place in the landing order, from 1. */
  n: number;
  attackerId: number;
  targetId: number;
  take: number;
  arrival: number;
  departFrom: number;
  departTo: number;
  approx: boolean;
  attackerBefore: number;
  attackerAfter: number;
  targetBefore: number;
  targetAfter: number;
}

export interface PassagePlan {
  projection: ChainProjection;
  launches: Launch[];
  /** Hunters whose field reaches no granary. */
  gaps: (Gap & { from: number })[];
  /** Transfers left out: they would land after the horizon. */
  dropped: number;
  /** A member's field at `time`, the floods on their way and the ones to launch counted. */
  fieldAt: (memberId: number, time: number) => number;
}

const ROUNDING_MS = 5 * 60_000;
const SPACING_MS = ARRIVAL_SPACING_SECONDS * 1000;
const ceilTo = (time: number, step: number) => Math.ceil(time / step) * step;

/**
 * The floods to launch, from the time rounded up to five minutes so that every member computing it gets the same plan.
 * The chain is planned on the fields once the floods on their way have landed; each flood to launch lands a minute
 * after the last one on its way that involves its attacker or its target, and a minute after the one before it.
 */
export function planPassage(input: PlanInput): PassagePlan {
  const now = ceilTo(input.now, ROUNDING_MS);
  const projection = projectChain(input);
  const byPseudo = new Map(input.members.map((m) => [key(m.pseudo), m.id]));
  const landsAt = (pseudo: string) => byPseudo.get(key(pseudo));

  // The last flood on its way that involves each member: nothing planned for them lands before it.
  const settled = new Map<number, number>();
  const busy = new Map<number, number>();
  for (const flood of input.floods) {
    for (const id of [landsAt(flood.from), landsAt(flood.target)]) {
      if (id !== undefined) settled.set(id, Math.max(settled.get(id) ?? 0, flood.at));
    }
    const sender = landsAt(flood.from);
    if (sender !== undefined && flood.at > now) busy.set(sender, (busy.get(sender) ?? 0) + 1);
  }

  const chain = planChain(
    {
      members: input.members.map((m) => ({
        id: m.id,
        field: projection.fieldAt(m.id, Math.max(now, settled.get(m.id) ?? 0)),
        slots: Math.max(0, (input.slots.get(m.id) ?? 0) - (busy.get(m.id) ?? 0)),
        ants: input.ants?.get(m.id),
      })),
      roles: input.roles,
      keep: input.keep,
    },
    input.margin,
  );

  const launches: Launch[] = [];
  let dropped = 0;
  let previous = -Infinity;
  for (const [index, transfer] of chain.transfers.entries()) {
    const placed: Launch[] = [];
    for (const hit of transfer.hits) {
      const trip = input.travel(hit.attackerId, hit.targetId);
      const arrival = ceilTo(
        Math.max(
          now + (LEAD_SECONDS + trip.seconds) * 1000,
          (settled.get(hit.attackerId) ?? -Infinity) + SPACING_MS,
          (settled.get(hit.targetId) ?? -Infinity) + SPACING_MS,
          previous + SPACING_MS,
        ),
        60_000,
      );
      previous = arrival;
      placed.push({
        n: 0,
        attackerId: hit.attackerId,
        targetId: hit.targetId,
        take: hit.take,
        arrival,
        departFrom: arrival - trip.seconds * 1000,
        departTo: 0,
        approx: trip.approx,
        attackerBefore: hit.attackerAfter - hit.take,
        attackerAfter: hit.attackerAfter,
        targetBefore: hit.targetAfter + hit.take,
        targetAfter: hit.targetAfter,
      });
    }
    if (placed.some((launch) => launch.arrival > now + input.horizon)) {
      dropped = chain.transfers.length - index;
      break;
    }
    launches.push(...placed);
  }

  // Each may land as late as a minute before the next one that involves its attacker or its target, or the horizon.
  for (const [i, launch] of launches.entries()) {
    const shares = (other: Launch) =>
      [other.attackerId, other.targetId].some((id) => id === launch.attackerId || id === launch.targetId);
    const next = launches.slice(i + 1).find(shares);
    const latest = next ? next.arrival - SPACING_MS : now + input.horizon;
    launch.n = i + 1;
    launch.departTo = latest - (launch.arrival - launch.departFrom);
  }

  const fieldAt = (memberId: number, time: number) =>
    launches.reduce(
      (field, launch) => {
        if (launch.arrival > time) return field;
        if (launch.attackerId === memberId) return field + launch.take;
        if (launch.targetId === memberId) return field - launch.take;
        return field;
      },
      projection.fieldAt(memberId, time),
    );

  return { projection, launches, gaps: chain.gaps, dropped, fieldAt };
}
