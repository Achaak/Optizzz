// The state of the site's hunt simulator in its address (`/tools/hunt#p=1.…`): the army sent, levels, fields, settings,
// the hunts changed by hand and the display. The extension's hunt launcher builds the same links. See
// docs/features/site-chasse.md and site-outils.md.
import { z } from "zod";
import { countsToArmy, type Counts } from "../army/army-text";
import { UNITS } from "../army/units";
import type { HuntForm } from "../hunt/hunt-form";
import { defineLinkFormat } from "./link-state";

export interface HuntToolState {
  form: HuntForm;
  /** The advanced display; the simple one otherwise. */
  advanced: boolean;
}

const level = z.number().int().min(0).max(1000).nullable();
const amount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Counts in `UNITS` order (append-only), trailing zeros left out. */
const counts = z.array(amount).max(UNITS.length);

const wireSchema = z.object({
  u: counts,
  l: z.tuple([level, level, level, level]),
  p: z.tuple([level, level, level]),
  f: amount.nullable(),
  a: amount.nullable(),
  b: z.number().int().min(0).max(1000),
  o: z.enum(["r", "y"]),
  r: z.number().min(0).max(1000),
  y: z.number().min(0).max(1),
  d: z.enum(["m", "w"]),
  k: z.number().int().min(1).max(1000).nullable(),
  m: amount.min(1).nullable(),
  e: z.array(z.object({ a: amount.min(1), u: counts })).nullable(),
  v: z.boolean(),
});

type Wire = z.infer<typeof wireSchema>;

/** An army as counts in `UNITS` order, without the trailing zeros: a full army stays short. */
const shortCounts = (army: Counts): number[] => {
  const list = countsToArmy(army);
  while (list.length > 0 && list[list.length - 1] === 0) list.pop();
  return list;
};

const fromShort = (list: readonly number[]): Counts =>
  Object.fromEntries(UNITS.flatMap((unit, i) => ((list[i] ?? 0) > 0 ? [[unit.key, list[i]]] : [])));

/**
 * Short keys: `u` units sent in `UNITS` order, `l` Armes, Bouclier, Vitesse de chasse, Étable à cochenilles, `p`
 * Couveuse, Solarium, Technique de ponte, `f` field at launch, `a` at arrival, `b` slots taken, `o` objective, `r`
 * ratio, `y` losses accepted, `d` dispatch, `k` number of hunts, `m` surface per hunt, `e` hunts changed by hand, `v`
 * advanced display.
 */
export const huntLinkFormat = defineLinkFormat({
  version: 1,
  schema: wireSchema,
  toWire: ({ form, advanced }: HuntToolState): Wire => ({
    u: shortCounts(form.army),
    l: [form.levels.weapons, form.levels.shield, form.levels.huntSpeed, form.levels.cochineal],
    p: [form.laying.nursery, form.laying.solarium, form.laying.laying],
    f: form.launchField,
    a: form.arrivalField,
    b: form.takenSlots,
    o: form.objective === "ratio" ? "r" : "y",
    r: form.ratio,
    y: form.maxLossShare,
    d: form.dispatch === "waves" ? "w" : "m",
    k: form.huntCount,
    m: form.huntAmount,
    e: form.edited?.map((hunt) => ({ a: hunt.amount, u: shortCounts(hunt.army) })) ?? null,
    v: advanced,
  }),
  fromWire: (wire): HuntToolState => ({
    form: {
      army: fromShort(wire.u),
      levels: { weapons: wire.l[0], shield: wire.l[1], huntSpeed: wire.l[2], cochineal: wire.l[3] },
      laying: { nursery: wire.p[0], solarium: wire.p[1], laying: wire.p[2] },
      launchField: wire.f,
      arrivalField: wire.a,
      takenSlots: wire.b,
      objective: wire.o === "r" ? "ratio" : "yield",
      ratio: wire.r,
      maxLossShare: wire.y,
      dispatch: wire.d === "w" ? "waves" : "mix",
      huntCount: wire.k,
      huntAmount: wire.m,
      edited: wire.e?.map((hunt) => ({ amount: hunt.a, army: fromShort(hunt.u) })) ?? null,
    },
    advanced: wire.v,
  }),
});
