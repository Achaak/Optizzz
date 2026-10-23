// The state of the site's flood simulator in its address (`/tools/flood#p=1.…`): the server and both ends if chosen,
// both hunting fields, my army, levels and attacks on their way, and the target's pasted defense. The extension's
// « Plan de flood » builds the same links, and `floodToolPlan` gives the site the same attacks as its plan.
// See docs/features/site-flood.md and site-outils.md.
import { z } from "zod";
import { UNITS, type Army } from "../army/units";
import { attackSlots } from "../attack";
import { FLOOD_MARGIN, floodPlan, type FloodBlock, type PlannedAttack } from "../flood";
import { defineLinkFormat } from "./link-state";

/** One end of the flood: a player of the server (their id) or a position. */
export type FloodEnd = { kind: "player"; id: number } | { kind: "position"; x: number | null; y: number | null };

export interface FloodToolState {
  /** Null: no server chosen, everything typed by hand. */
  server: string | null;
  attacker: FloodEnd | null;
  target: FloodEnd | null;
  /** Hunting fields (TDC), cm²; taken from the site's database when a player is chosen, then editable. */
  attackerField: number | null;
  targetField: number | null;
  /** The ants I send, all attacks together, in `UNITS` order. */
  army: number[];
  attackSpeed: number | null;
  weapons: number | null;
  shield: number | null;
  /** My attacks already on their way: each takes a slot. */
  underWay: number;
  /** The target's army on its hunting field, pasted, in `UNITS` order; null: unknown. */
  defense: number[] | null;
}

export const EMPTY_FLOOD: FloodToolState = {
  server: null,
  attacker: null,
  target: null,
  attackerField: null,
  targetField: null,
  army: UNITS.map(() => 0),
  attackSpeed: null,
  weapons: null,
  shield: null,
  underWay: 0,
  defense: null,
};

const level = z.number().int().min(0).max(1000);
const amount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Counts in `UNITS` order (append-only), trailing zeros left out. */
const counts = z.array(amount).max(UNITS.length);
const coordinate = z.number().int().min(0).max(100_000).nullable();
/** A player is their id; a position is `[x, y]`. */
const end = z.union([z.number().int().positive(), z.tuple([coordinate, coordinate])]).nullable();

const wireSchema = z.object({
  s: z
    .string()
    .regex(/^s\d{1,2}$/)
    .nullable(),
  a: end,
  c: end,
  f: z.tuple([amount.nullable(), amount.nullable()]),
  u: counts,
  v: level.nullable(),
  w: level.nullable(),
  b: level.nullable(),
  e: z.number().int().min(0).max(1000),
  d: counts.nullable(),
});

type Wire = z.infer<typeof wireSchema>;

const shortCounts = (army: Army): number[] => {
  const list = UNITS.map((_, i) => army[i] ?? 0);
  while (list.length > 0 && list[list.length - 1] === 0) list.pop();
  return list;
};

const fullCounts = (list: readonly number[]): number[] => UNITS.map((_, i) => list[i] ?? 0);

const endToWire = (value: FloodEnd | null): Wire["a"] =>
  value === null ? null : value.kind === "player" ? value.id : [value.x, value.y];

const endFromWire = (value: Wire["a"]): FloodEnd | null =>
  value === null
    ? null
    : typeof value === "number"
      ? { kind: "player", id: value }
      : { kind: "position", x: value[0], y: value[1] };

/**
 * Short keys: `s` server, `a` attacker and `c` target (an id or `[x, y]`), `f` both fields (mine, its), `u` my army,
 * `v` Vitesse d'attaque, `w` Armes, `b` Bouclier, `e` attacks on their way, `d` its defense.
 */
export const floodLinkFormat = defineLinkFormat({
  version: 1,
  schema: wireSchema,
  toWire: (state: FloodToolState): Wire => ({
    s: state.server,
    a: endToWire(state.attacker),
    c: endToWire(state.target),
    f: [state.attackerField, state.targetField],
    u: shortCounts(state.army),
    v: state.attackSpeed,
    w: state.weapons,
    b: state.shield,
    e: state.underWay,
    d: state.defense && shortCounts(state.defense),
  }),
  fromWire: (wire): FloodToolState => ({
    server: wire.s,
    attacker: endFromWire(wire.a),
    target: endFromWire(wire.c),
    attackerField: wire.f[0],
    targetField: wire.f[1],
    army: fullCounts(wire.u),
    attackSpeed: wire.v,
    weapons: wire.w,
    shield: wire.b,
    underWay: wire.e,
    defense: wire.d && fullCounts(wire.d),
  }),
});

/** A field the plan needs and the visitor has not typed yet. */
export type FloodField = "attackerField" | "targetField" | "attackSpeed" | "weapons" | "shield";

export type FloodToolPlan =
  | { kind: "missing"; fields: FloodField[] }
  | { kind: "plan"; slots: number; attacks: PlannedAttack[]; block: FloodBlock | null };

const hasDefense = (defense: Army | null): defense is Army => defense?.some((count) => count > 0) ?? false;

/** The site's plan: the extension's (`floodPlan`, same margin) once the fields it needs are typed. */
export function floodToolPlan(state: FloodToolState): FloodToolPlan {
  const defense = hasDefense(state.defense) ? state.defense : null;
  const { attackerField, targetField, attackSpeed, weapons, shield } = state;
  const missing: FloodField[] = [];
  if (attackerField === null) missing.push("attackerField");
  if (targetField === null) missing.push("targetField");
  if (attackSpeed === null) missing.push("attackSpeed");
  // Weapons and Shield only fight a defense.
  if (defense && weapons === null) missing.push("weapons");
  if (defense && shield === null) missing.push("shield");
  if (attackerField === null || targetField === null || attackSpeed === null || missing.length > 0)
    return { kind: "missing", fields: missing };
  const slots = attackSlots(attackSpeed, state.underWay);
  const plan = floodPlan({
    attackerField,
    targetField,
    slots,
    margin: FLOOD_MARGIN,
    available: state.army,
    defense,
    levels: { weapons: weapons ?? 0, shield: shield ?? 0 },
  });
  return { kind: "plan", slots, ...plan };
}
