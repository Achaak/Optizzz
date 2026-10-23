// The state of the site's combat simulator in its address (`/tools/combat#p=1.…`): both sides as typed, the place
// attacked, and the side « Mes niveaux » fill. The extension's simulator builds the same links. See
// docs/features/site-combat.md and site-outils.md.
import { z } from "zod";
import { countsToArmy, type Counts } from "../army/army-text";
import type { Place } from "../army/battle";
import type { SimulatorForm } from "../army/battle-form";
import { UNITS } from "../army/units";
import { defineLinkFormat } from "./link-state";

/** The attacking or the defending side. */
export type CombatSide = "attack" | "defend";

export interface CombatToolState {
  form: SimulatorForm;
  /** The side « Mes niveaux » fill: the visitor's. */
  mine: CombatSide;
}

const level = z.number().int().min(0).max(1000);
const amount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Counts in `UNITS` order (append-only), trailing zeros left out. */
const counts = z.array(amount).max(UNITS.length);

const wireSchema = z.object({
  a: z.object({ u: counts, w: level, s: level, f: amount, p: level }),
  d: z.object({
    u: z.object({ f: counts, n: counts, l: counts }),
    w: level,
    s: level,
    o: level,
    g: level,
    f: amount,
    n: amount,
    m: amount,
  }),
  t: z.enum(["field", "nest", "lodge"] satisfies Place[]),
  m: z.enum(["a", "d"]),
});

type Wire = z.infer<typeof wireSchema>;

/** An army as counts in `UNITS` order, without the trailing zeros: a full battle stays under 1,000 characters. */
const shortCounts = (army: Counts): number[] => {
  const list = countsToArmy(army);
  while (list.length > 0 && list[list.length - 1] === 0) list.pop();
  return list;
};

const fromShort = (list: readonly number[]): Counts =>
  Object.fromEntries(UNITS.flatMap((unit, i) => ((list[i] ?? 0) > 0 ? [[unit.key, list[i]]] : [])));

/**
 * Short keys: `a` attacker (`u` units in `UNITS` order, `w` Armes, `s` Bouclier, `f` TDC, `p` Étable à pucerons), `d` defender (`u`
 * units by place, `o` Dôme, `g` Loge, `n` food, `m` materials), `t` the place attacked, `m` the side of « Mes niveaux ».
 */
export const combatLinkFormat = defineLinkFormat({
  version: 1,
  schema: wireSchema,
  toWire: ({ form: { attacker, defender, target }, mine }: CombatToolState): Wire => ({
    a: {
      u: shortCounts(attacker.army),
      w: attacker.weapons,
      s: attacker.shield,
      f: attacker.field,
      p: attacker.aphids,
    },
    d: {
      u: {
        f: shortCounts(defender.armies.field),
        n: shortCounts(defender.armies.nest),
        l: shortCounts(defender.armies.lodge),
      },
      w: defender.weapons,
      s: defender.shield,
      o: defender.dome,
      g: defender.lodge,
      f: defender.field,
      n: defender.food,
      m: defender.materials,
    },
    t: target,
    m: mine === "attack" ? "a" : "d",
  }),
  fromWire: ({ a, d, t, m }): CombatToolState => ({
    form: {
      attacker: { army: fromShort(a.u), weapons: a.w, shield: a.s, field: a.f, aphids: a.p },
      defender: {
        armies: { field: fromShort(d.u.f), nest: fromShort(d.u.n), lodge: fromShort(d.u.l) },
        weapons: d.w,
        shield: d.s,
        dome: d.o,
        lodge: d.g,
        field: d.f,
        food: d.n,
        materials: d.m,
      },
      target: t,
    },
    mine: m === "a" ? "attack" : "defend",
  }),
});
