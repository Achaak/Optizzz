// The state of the costs tool, kept in the fragment of its address (`#p=1.…`) and in the browser. See
// docs/features/site-couts.md and site-outils.md.
import { LEVEL_BASES, type LevelKey } from "@optizzz/game/level-costs";
import { defineLinkFormat } from "@optizzz/game/site-links/link-state";
import { z } from "zod";

/** The highest level the tool computes: past Toolzzz's 50 (the table goes on beyond it without a limit). */
export const MAX_LEVEL = 60;

export interface CostsState {
  element: LevelKey;
  /** The level held (0 or more); null while the field is empty. */
  from: number | null;
  /** The level aimed at. */
  to: number | null;
  /** Both time bonuses are kept, so that switching from a building to a research keeps each one. */
  architecture: number | null;
  analysisRoom: number | null;
}

export const EMPTY_COSTS: CostsState = { element: "mushroom", from: 0, to: 10, architecture: null, analysisRoom: null };

const LEVEL_KEYS = Object.keys(LEVEL_BASES) as [LevelKey, ...LevelKey[]];
const level = z.number().int().min(0).max(MAX_LEVEL).nullable();

const wireSchema = z.object({ e: z.enum(LEVEL_KEYS), f: level, t: level, a: level, s: level });

type Wire = z.infer<typeof wireSchema>;

/** Short keys: `e` the element, `f` and `t` the levels, `a` Architecture, `s` Salle d'analyse. */
export const costsFormat = defineLinkFormat({
  version: 1,
  schema: wireSchema,
  toWire: (state: CostsState): Wire => ({
    e: state.element,
    f: state.from,
    t: state.to,
    a: state.architecture,
    s: state.analysisRoom,
  }),
  fromWire: (wire): CostsState => ({
    element: wire.e,
    from: wire.f,
    to: wire.t,
    architecture: wire.a,
    analysisRoom: wire.s,
  }),
});
