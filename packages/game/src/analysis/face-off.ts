// Two alliances face to face: who can take whom. See docs/features/analyse-alliances.md.
import { inRange } from "../attack";
import { distance } from "../travel";

export interface FaceOffInput {
  pseudo: string;
  field: number;
  x: number;
  y: number;
  /** On holiday or banned: listed, out of the totals and of the reach. */
  unavailable: boolean;
}

export interface FaceOffMember {
  pseudo: string;
  field: number;
  unavailable: boolean;
  /** How many on the other side it can attack. */
  canTake: number;
  /** The nearest of them, distance in squares. */
  nearest: { pseudo: string; distance: number } | null;
}

export interface FaceOffSide {
  /** Most targets first, then the biggest; the unavailable last. */
  members: FaceOffMember[];
  /** The field of the members at least one on the other side can attack. */
  exposedField: number;
  exposedCount: number;
  /** Members who can neither attack nor be attacked by anyone on the other side. */
  outOfReach: number;
  /** Members neither on holiday nor banned. */
  available: number;
}

export interface FaceOff {
  ours: FaceOffSide;
  theirs: FaceOffSide;
  /** Median distance between the members of the two sides, in squares; null when a side is empty. */
  medianDistance: number | null;
}

function side(members: readonly FaceOffInput[], others: readonly FaceOffInput[]): FaceOffSide {
  const active = others.filter((other) => !other.unavailable);
  const rows = members.map((member): FaceOffMember => {
    const targets = member.unavailable ? [] : active.filter((other) => inRange(member.field, other.field));
    const nearest = targets
      .map((other) => ({ pseudo: other.pseudo, distance: distance(member, other) }))
      .sort((a, b) => a.distance - b.distance)[0];
    return {
      pseudo: member.pseudo,
      field: member.field,
      unavailable: member.unavailable,
      canTake: targets.length,
      nearest: nearest ?? null,
    };
  });
  rows.sort((a, b) => Number(a.unavailable) - Number(b.unavailable) || b.canTake - a.canTake || b.field - a.field);
  const available = members.filter((member) => !member.unavailable);
  const exposed = available.filter((member) => active.some((other) => inRange(other.field, member.field)));
  const outOfReach = available.filter(
    (member) => !active.some((other) => inRange(other.field, member.field) || inRange(member.field, other.field)),
  );
  return {
    members: rows,
    exposedField: exposed.reduce((total, member) => total + member.field, 0),
    exposedCount: exposed.length,
    outOfReach: outOfReach.length,
    available: available.length,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function faceOff(ours: readonly FaceOffInput[], theirs: readonly FaceOffInput[]): FaceOff {
  const distances = ours
    .filter((member) => !member.unavailable)
    .flatMap((member) => theirs.filter((other) => !other.unavailable).map((other) => distance(member, other)));
  return { ours: side(ours, theirs), theirs: side(theirs, ours), medianDistance: median(distances) };
}
