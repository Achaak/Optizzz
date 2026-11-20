// Probable floods, from the hunting fields of two exports an hour apart. See docs/features/site-analyse.md.
// The defender loses what the attacker takes; an hour's gap adds up all that happened in it (several floods, hunts
// back), so a loss is only matched when the sums agree, and is left without a culprit rather than a wrong one.
import { inRange } from "../attack";
import { sameTag } from "../diplomacy";

/** A player in one of the two exports. */
export interface HourPlayer {
  id: number;
  field: number;
  alliance: string | null;
}

export type FloodSureness = "sure" | "combination" | "candidates" | "unknown";

/** One loss of the hour, with who probably took it. */
export interface ProbableFlood {
  victimId: number;
  amount: number;
  /** Matched: one player (« sure »), or the one combination (« combination »); empty otherwise. */
  attackers: number[];
  /** Every player in range who gained in the hour, by id, at most `MAX_CANDIDATES`. */
  candidates: number[];
  /** The alliance all the attackers, or else all the candidates, share; null when none. */
  alliance: string | null;
  sureness: FloodSureness;
}

/** A loss under this share of the field is not counted (a hunt's losses, the colony tax). */
const MIN_LOSS = 0.01;
/** The attacker wins exactly what the victim loses: two sums agree only to the cm² (half a cm² for float noise). */
/** The largest combination tried: 2 to 4 players. */
const MAX_COMBINATION = 4;
/** The plausible gains (or losses) a combination is looked for among: beyond, too many sums for the cron. */
const MAX_CANDIDATES = 20;

interface Move {
  id: number;
  /** The field at the start of the hour. */
  from: number;
  amount: number;
  alliance: string | null;
}

const close = (value: number, target: number) => Math.abs(value - target) < 0.5;

/** The one combination of 2 to 4 of `pool` (biggest first) whose amounts make `target`; null when none or several. */
function uniqueCombination(pool: readonly Move[], target: number): Move[] | null {
  let found: Move[] | null = null;
  let count = 0;
  const search = (start: number, chosen: Move[], sum: number) => {
    if (count > 1) return;
    if (chosen.length >= 2 && close(sum, target)) {
      count++;
      found = chosen;
    }
    if (chosen.length === MAX_COMBINATION) return;
    for (let i = start; i < pool.length; i++) {
      const next = pool[i];
      if (!next || sum + next.amount > target + 0.5) continue;
      search(i + 1, [...chosen, next], sum + next.amount);
    }
  };
  search(0, [], 0);
  return count === 1 ? found : null;
}

export function probableFloods(before: readonly HourPlayer[], after: readonly HourPlayer[]): ProbableFlood[] {
  const start = new Map(before.map((player) => [player.id, player]));
  const losses: Move[] = [];
  const gains: Move[] = [];
  for (const player of after) {
    const was = start.get(player.id);
    if (!was) continue;
    const delta = player.field - was.field;
    const move = { id: player.id, from: was.field, amount: Math.abs(delta), alliance: player.alliance };
    if (delta > 0) gains.push(move);
    else if (delta < 0 && -delta > was.field * MIN_LOSS) losses.push(move);
  }
  // Gains by their field at the start: a loss's candidates are a slice of them, found by halves (216 000 players on S4).
  const byField = [...gains].sort((a, b) => a.from - b.from);
  const firstFrom = (field: number) => {
    let low = 0;
    let high = byField.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((byField[middle]?.from ?? Infinity) < field) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const candidatesOf = new Map(
    losses.map((loss) => {
      // In range of an attacker: from 50 % (included) to 300 % (excluded) of its field.
      const slice = byField.slice(firstFrom(loss.from / 3), firstFrom(loss.from * 2 + 1));
      return [loss.id, slice.filter((gain) => inRange(gain.from, loss.from)).sort((a, b) => a.id - b.id)];
    }),
  );
  // Each gain's losses it may have caused: the lookups below stay cheap on S2's thousands of moves an hour.
  const lossesOf = new Map<number, Move[]>();
  for (const loss of losses)
    for (const gain of candidatesOf.get(loss.id) ?? []) lossesOf.set(gain.id, [...(lossesOf.get(gain.id) ?? []), loss]);
  const resolved = new Map<number, { attackers: number[]; sureness: FloodSureness }>();
  const used = new Set<number>();

  // One for one: the only gain of a candidate that makes the loss, and the only loss that gain makes.
  for (const loss of losses) {
    const matching = (candidatesOf.get(loss.id) ?? []).filter((gain) => close(gain.amount, loss.amount));
    const gain = matching.length === 1 ? matching[0] : undefined;
    if (!gain || used.has(gain.id)) continue;
    const others = (lossesOf.get(gain.id) ?? []).filter((other) => close(gain.amount, other.amount));
    if (others.length !== 1) continue;
    resolved.set(loss.id, { attackers: [gain.id], sureness: "sure" });
    used.add(gain.id);
  }

  // Several for one: players who took from one victim together…
  for (const loss of losses) {
    if (resolved.has(loss.id)) continue;
    const pool = (candidatesOf.get(loss.id) ?? [])
      .filter((gain) => !used.has(gain.id) && gain.amount <= loss.amount)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_CANDIDATES);
    const combination = uniqueCombination(pool, loss.amount);
    if (!combination) continue;
    const attackers = combination.map((gain) => gain.id).sort((a, b) => a - b);
    resolved.set(loss.id, { attackers, sureness: "combination" });
    for (const id of attackers) used.add(id);
  }
  // …and one player who took from several victims.
  for (const gain of gains) {
    if (used.has(gain.id)) continue;
    const pool = (lossesOf.get(gain.id) ?? [])
      .filter((loss) => !resolved.has(loss.id) && loss.amount <= gain.amount)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_CANDIDATES);
    const combination = uniqueCombination(pool, gain.amount);
    if (!combination) continue;
    for (const loss of combination) resolved.set(loss.id, { attackers: [gain.id], sureness: "combination" });
    used.add(gain.id);
  }

  const allianceOf = new Map(after.map((player) => [player.id, player.alliance]));
  const shared = (ids: readonly number[]): string | null => {
    const tags = ids.map((id) => allianceOf.get(id) ?? null);
    const [first] = tags;
    return first && tags.every((tag) => tag !== null && sameTag(tag, first)) ? first : null;
  };
  return losses
    .map((loss): ProbableFlood => {
      const candidates = (candidatesOf.get(loss.id) ?? []).slice(0, MAX_CANDIDATES).map((gain) => gain.id);
      const match = resolved.get(loss.id);
      const attackers = match?.attackers ?? [];
      return {
        victimId: loss.id,
        amount: loss.amount,
        attackers,
        candidates,
        alliance: shared(attackers.length > 0 ? attackers : candidates),
        sureness: match?.sureness ?? (candidates.length > 0 ? "candidates" : "unknown"),
      };
    })
    .sort((a, b) => a.victimId - b.victimId);
}
