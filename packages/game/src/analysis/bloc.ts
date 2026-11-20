// An alliance's diplomatic bloc: its pacts, their pacts, its wars. See docs/features/analyse-alliances.md.
import { sameTag, type WarSide } from "../diplomacy";
import type { Alliance } from "../exports";
import { formatCompact, formatDecimal } from "../format/number-format";

export interface BlocMember {
  tag: string;
  field: number;
  members: number;
}

export interface BlocPact extends BlocMember {
  /** « PNA », « Total »: the kind of pact as the alliances write it. */
  kind: string;
}

export interface BlocAlly extends BlocMember {
  /** The direct ally it has a pact with. */
  via: string;
}

export interface BlocWar extends BlocMember {
  /** From the bloc's alliance: « us », it declared it. */
  side: WarSide;
}

export interface Bloc {
  center: BlocMember;
  /** Direct pacts, biggest first. */
  pacts: BlocPact[];
  /** Pacts of the direct allies, neither the alliance nor a direct ally nor an enemy, biggest first. */
  secondRing: BlocAlly[];
  wars: BlocWar[];
  /** The alliance and its direct pacts. */
  field: number;
  /** `field` against my alliance's; null on my own alliance or without one. */
  ratio: number | null;
}

const member = (alliance: Alliance): BlocMember => ({
  tag: alliance.tag,
  field: alliance.totalField,
  members: alliance.playersCount,
});
const biggestFirst = (a: BlocMember, b: BlocMember) => b.field - a.field;

/** The alliances `of` has a pact with, written on either side, with the kind of pact. */
function pactsOf(of: Alliance, alliances: readonly Alliance[]): { alliance: Alliance; kind: string }[] {
  return alliances.flatMap((other) => {
    if (sameTag(other.tag, of.tag)) return [];
    const written =
      of.diplomacy.pacts.find((pact) => sameTag(pact.tag, other.tag)) ??
      other.diplomacy.pacts.find((pact) => sameTag(pact.tag, of.tag));
    return written ? [{ alliance: other, kind: written.name.trim() }] : [];
  });
}

export function diplomaticBloc(tag: string, alliances: readonly Alliance[], myTag: string | null): Bloc | null {
  const center = alliances.find((alliance) => sameTag(alliance.tag, tag));
  if (!center) return null;
  const declares = (from: Alliance, to: Alliance) => from.diplomacy.wars.some((war) => sameTag(war, to.tag));
  const wars = alliances.flatMap((other): BlocWar[] => {
    if (sameTag(other.tag, center.tag)) return [];
    const ours = declares(center, other);
    const theirs = declares(other, center);
    if (!ours && !theirs) return [];
    return [{ ...member(other), side: ours && theirs ? "both" : ours ? "us" : "them" }];
  });
  const direct = pactsOf(center, alliances);
  const pacts = direct.map(({ alliance, kind }): BlocPact => ({ ...member(alliance), kind })).sort(biggestFirst);
  const taken = new Set([center.tag, ...pacts.map((pact) => pact.tag), ...wars.map((war) => war.tag)]);
  const secondRing: BlocAlly[] = [];
  for (const { alliance: ally } of [...direct].sort((a, b) => b.alliance.totalField - a.alliance.totalField)) {
    for (const { alliance } of pactsOf(ally, alliances)) {
      if (taken.has(alliance.tag)) continue;
      taken.add(alliance.tag);
      secondRing.push({ ...member(alliance), via: ally.tag });
    }
  }
  const field = center.totalField + pacts.reduce((total, pact) => total + pact.field, 0);
  const mine = myTag && !sameTag(myTag, center.tag) ? alliances.find((alliance) => sameTag(alliance.tag, myTag)) : null;
  return {
    center: member(center),
    pacts,
    secondRing: secondRing.sort(biggestFirst),
    wars: wars.sort(biggestFirst),
    field,
    ratio: mine && mine.totalField > 0 ? field / mine.totalField : null,
  };
}

/** « Avec ses 3 pactes, ce bloc pèse 41,2M de TDC, 3,4 fois votre alliance. » */
export function blocText(bloc: Bloc): string {
  const count = bloc.pacts.length;
  const pacts = count === 0 ? "Sans pacte" : count === 1 ? "Avec son pacte" : `Avec ses ${String(count)} pactes`;
  const ratio = bloc.ratio === null ? "" : `, ${formatDecimal(bloc.ratio)} fois votre alliance`;
  return `${pacts}, ce bloc pèse ${formatCompact(bloc.field)} de TDC${ratio}.`;
}

/** A node of the bloc's graph, in a `BLOC_WIDTH` × `BLOC_HEIGHT` box. */
export interface BlocNode {
  tag: string;
  kind: "center" | "pact" | "ally" | "war";
  x: number;
  y: number;
  /** Under the tag: the kind of pact, « pacte de KISS », « guerre subie »… */
  detail: string;
}

export interface BlocEdge {
  kind: "pact" | "ally" | "war";
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export const BLOC_WIDTH = 640;
export const BLOC_HEIGHT = 420;
/** More than this on a ring and the graph gets unreadable: the rest is only in the list. */
export const BLOC_RING_MAX = 8;

const WAR_DETAIL: Record<WarSide, string> = {
  us: "guerre déclarée",
  them: "guerre subie",
  both: "guerre réciproque",
};

/**
 * Where to draw each alliance: the bloc's in the middle, its pacts on the upper half of a first ring, its wars on
 * the lower half, the pacts of its allies on a second ring beside the ally they come from.
 */
export function blocLayout(bloc: Bloc): { nodes: BlocNode[]; edges: BlocEdge[]; hidden: number } {
  const center = { x: BLOC_WIDTH / 2, y: BLOC_HEIGHT / 2 };
  const at = (radius: number, degrees: number) => ({
    x: center.x + radius * 1.45 * Math.cos((degrees * Math.PI) / 180),
    y: center.y + radius * Math.sin((degrees * Math.PI) / 180),
  });
  /** `count` angles spread on an arc from `from` to `to` degrees, inside its ends. */
  const spread = (count: number, from: number, to: number) =>
    Array.from({ length: count }, (_, i) => from + ((to - from) * (i + 1)) / (count + 1));

  const nodes: BlocNode[] = [
    { tag: bloc.center.tag, kind: "center", ...center, detail: formatCompact(bloc.center.field) },
  ];
  const edges: BlocEdge[] = [];
  const pacts = bloc.pacts.slice(0, BLOC_RING_MAX);
  const wars = bloc.wars.slice(0, BLOC_RING_MAX);
  const angles = new Map<string, number>();
  spread(pacts.length, 180, 360).forEach((angle, i) => {
    const pact = pacts[i];
    if (!pact) return;
    const point = at(120, angle);
    angles.set(pact.tag, angle);
    nodes.push({ tag: pact.tag, kind: "pact", ...point, detail: pact.kind || "pacte" });
    edges.push({ kind: "pact", from: center, to: point });
  });
  spread(wars.length, 0, 180).forEach((angle, i) => {
    const war = wars[i];
    if (!war) return;
    // Two radii, one war in two: the lower half has room, and the boxes would touch on one ring.
    const point = at(wars.length > 4 && i % 2 === 1 ? 180 : 115, angle);
    nodes.push({ tag: war.tag, kind: "war", ...point, detail: WAR_DETAIL[war.side] });
    edges.push({ kind: "war", from: center, to: point });
  });
  // Spread evenly over the upper half, in the order of the allies they come from: grouped by ally, they would pile up.
  const allies = bloc.secondRing
    .filter((ally) => angles.has(ally.via))
    .slice(0, BLOC_RING_MAX)
    .sort((a, b) => (angles.get(a.via) ?? 0) - (angles.get(b.via) ?? 0));
  spread(allies.length, 180, 360).forEach((angle, i) => {
    const ally = allies[i];
    if (!ally) return;
    const point = at(185, angle);
    nodes.push({ tag: ally.tag, kind: "ally", ...point, detail: `pacte de ${ally.via}` });
    const from = nodes.find((node) => node.tag === ally.via);
    if (from) edges.push({ kind: "ally", from, to: point });
  });
  const hidden =
    bloc.pacts.length - pacts.length + (bloc.wars.length - wars.length) + (bloc.secondRing.length - allies.length);
  return { nodes, edges, hidden };
}
