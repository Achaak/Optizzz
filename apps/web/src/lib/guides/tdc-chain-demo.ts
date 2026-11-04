// The invented alliance of the « Chaîne de TDC » guide, and what Optizzz's own chain planner makes of it: who can take
// from whom, the passing order, the hunter no one reaches. See docs/features/site-guides.md.
import { UNITS } from "@optizzz/game/army/units";
import { bridge, planChain, takeMatrix } from "@optizzz/game/tdc-chain/chain";
import { CHAIN_MARGIN, type Role } from "@optizzz/game/tdc-chain/roles";
import { EMPTY_FLOOD, floodLinkFormat } from "@optizzz/game/site-links/flood";
import { linkFragment } from "@optizzz/game/site-links/link-state";
import { siteToolPath } from "@optizzz/game/site-links/site";

export interface DemoMember {
  id: number;
  name: string;
  field: number;
  role: Role;
  /** Field a hunter keeps; the rest climbs. */
  keep?: number;
}

/** Mandifloreck Speed of every member: five attacks at once, more than the demo needs. */
const ATTACK_SPEED = 4;

/** Invented names, absent from S1 to S5 when the guide was written (2026-11-04). */
const MEMBERS: readonly DemoMember[] = [
  { id: 1, name: "Brindebois", field: 1_200_000, role: { kind: "granary", rank: 1 } },
  { id: 2, name: "Chaumelune", field: 1_050_000, role: { kind: "granary", rank: 1 } },
  { id: 3, name: "Ardoisine", field: 560_000, role: { kind: "passer", rank: 2 } },
  { id: 4, name: "Terrepaille", field: 300_000, role: { kind: "passer", rank: 1 } },
  { id: 5, name: "Mandiflore", field: 160_000, role: { kind: "hunter" }, keep: 100_000 },
  { id: 6, name: "Pollenard", field: 155_000, role: { kind: "hunter" }, keep: 100_000 },
  { id: 7, name: "Ramille", field: 90_000, role: { kind: "hunter" }, keep: 30_000 },
];

export interface DemoHit {
  /** Landing order. */
  n: number;
  attacker: string;
  target: string;
  take: number;
  attackerAfter: number;
  targetAfter: number;
}

export interface DemoGap {
  name: string;
  field: number;
  /** The lowest passer, who should reach it. */
  above: string;
  /** Fields a missing passer may have. */
  min: number;
  max: number;
  /** Members of the chain within those fields. */
  candidates: string[];
}

export interface TdcChainDemo {
  members: readonly DemoMember[];
  /** Mandiflorecker (row) by target (column), in `members` order: what a won attack takes, null out of range. */
  matrix: (number | null)[][];
  /** « Mandiflorecker→Target » of the attacks in the plan. */
  planned: ReadonlySet<string>;
  hits: DemoHit[];
  gap: DemoGap | null;
  /** The plan's first attack in the flood simulator. */
  floodLink: string;
}

export function tdcChainDemo(): TdcChainDemo {
  const nameOf = (id: number) => MEMBERS.find((member) => member.id === id)?.name ?? "";
  const chainMembers = MEMBERS.map(({ id, field }) => ({ id, field, slots: ATTACK_SPEED + 1 }));
  const plan = planChain(
    {
      members: chainMembers,
      roles: new Map(MEMBERS.map((member) => [member.id, member.role])),
      keep: new Map(MEMBERS.flatMap((member) => (member.keep === undefined ? [] : [[member.id, member.keep]]))),
    },
    CHAIN_MARGIN,
  );

  const hits = plan.transfers
    .flatMap((transfer) => transfer.hits)
    .map((hit, i) => ({
      n: i + 1,
      attacker: nameOf(hit.attackerId),
      target: nameOf(hit.targetId),
      take: hit.take,
      attackerAfter: hit.attackerAfter,
      targetAfter: hit.targetAfter,
    }));

  const stuck = plan.gaps[0];
  const lowestPasser = MEMBERS.filter((member) => member.role.kind === "passer").at(-1);
  let gap: DemoGap | null = null;
  const stuckMember = stuck && MEMBERS.find((member) => member.id === stuck.from);
  if (stuckMember && lowestPasser) {
    const needed = bridge(stuckMember.field, lowestPasser.field, CHAIN_MARGIN);
    if ("min" in needed)
      gap = {
        name: stuckMember.name,
        field: stuckMember.field,
        above: lowestPasser.name,
        min: needed.min,
        max: needed.max,
        candidates: MEMBERS.filter((member) => member.field >= needed.min && member.field <= needed.max).map(
          (member) => member.name,
        ),
      };
  }

  const first = plan.transfers[0]?.hits[0];
  const fieldOf = (id: number | undefined) => MEMBERS.find((member) => member.id === id)?.field ?? null;
  const encoded = floodLinkFormat.encode({
    ...EMPTY_FLOOD,
    attackerField: fieldOf(first?.attackerId),
    targetField: fieldOf(first?.targetId),
    // As many Jeunes Soldates Naines as cm² to take: one cm² per ant at most.
    army: UNITS.map((_, i) => (i === 0 ? (first?.take ?? 0) : 0)),
    attackSpeed: ATTACK_SPEED,
  });

  return {
    members: MEMBERS,
    matrix: takeMatrix(MEMBERS, CHAIN_MARGIN),
    planned: new Set(hits.map((hit) => `${hit.attacker}→${hit.target}`)),
    hits,
    gap,
    floodLink: `${siteToolPath("flood")}${linkFragment(encoded)}`,
  };
}
