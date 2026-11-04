// What the travel tool keeps in its address (`#p=2.…`) and in the browser: the server, the two ends, the sender's
// Attack Speed, the departure if one is set, and the alliances when it goes towards them. The links of the first
// version (towards a point) are still read. See docs/features/site-trajets.md and site-outils.md.
import { defineLinkFormat, earlierFormat } from "@optizzz/game/site-links/link-state";
import { z } from "zod";
import type { PickedEnd } from "../player-picker";

export interface TravelState {
  /** Null: no server, positions only. */
  server: string | null;
  /** The sender's end: a player of `server` or a position. */
  from: PickedEnd | null;
  to: PickedEnd | null;
  /** The sender's « Vitesse d'attaque » level. */
  attackSpeed: number | null;
  /** A day and time of Paris, « 2026-10-23T20:15 »; null: now. */
  departure: string | null;
  /** Towards the end `to`, or towards every member of `alliances`. */
  mode: TravelMode;
  /** Tags of `server`, as the export writes them, in the order chosen. */
  alliances: readonly string[];
}

export type TravelMode = "point" | "alliances";

/** The alliances the tool takes at once: about 2,000 members at most. */
export const MAX_ALLIANCES = 10;

export const EMPTY_TRAVEL: TravelState = {
  server: null,
  from: null,
  to: null,
  attackSpeed: null,
  departure: null,
  mode: "point",
  alliances: [],
};

/** « Inverser »: the ends swap; the Attack Speed stays as typed (the new sender's, to type). */
export const swapEnds = (state: TravelState): TravelState => ({ ...state, from: state.to, to: state.from });

/** A player or an alliance of another server is not one of this server: only the positions stay. */
export function withServer(state: TravelState, server: string | null): TravelState {
  if (server === state.server) return state;
  const kept = (end: PickedEnd | null) => (end?.kind === "player" ? null : end);
  return { ...state, server, from: kept(state.from), to: kept(state.to), alliances: [] };
}

export function withAlliance(state: TravelState, tag: string): TravelState {
  if (state.alliances.includes(tag) || state.alliances.length >= MAX_ALLIANCES) return state;
  return { ...state, alliances: [...state.alliances, tag] };
}

export const withoutAlliance = (state: TravelState, tag: string): TravelState => ({
  ...state,
  alliances: state.alliances.filter((chosen) => chosen !== tag),
});

const coordinate = z.number().int().min(0).max(100_000).nullable();
/** A player is their id; a position is `[x, y]`. */
const endSchema = z.union([z.number().int().positive(), z.tuple([coordinate, coordinate])]).nullable();

const firstSchema = z.object({
  s: z
    .string()
    .regex(/^s\d{1,2}$/)
    .nullable(),
  a: endSchema,
  b: endSchema,
  v: z.number().int().min(0).max(1000).nullable(),
  d: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable(),
});

const wireSchema = firstSchema.extend({
  /** Towards alliances; absent: towards a point. */
  m: z.literal("t").optional(),
  t: z.array(z.string().min(1).max(20)).max(MAX_ALLIANCES).optional(),
});

type FirstWire = z.infer<typeof firstSchema>;
type Wire = z.infer<typeof wireSchema>;
type WireEnd = Wire["a"];

const endToWire = (end: PickedEnd | null): WireEnd =>
  end === null ? null : end.kind === "player" ? end.id : [end.x, end.y];

const endFromWire = (end: WireEnd): PickedEnd | null =>
  end === null
    ? null
    : typeof end === "number"
      ? { kind: "player", id: end }
      : { kind: "position", x: end[0], y: end[1] };

const fromFirstWire = (wire: FirstWire): TravelState => ({
  server: wire.s,
  from: endFromWire(wire.a),
  to: endFromWire(wire.b),
  attackSpeed: wire.v,
  departure: wire.d,
  mode: "point",
  alliances: [],
});

export const travelFormat = defineLinkFormat({
  version: 2,
  schema: wireSchema,
  earlier: { 1: earlierFormat(firstSchema, fromFirstWire) },
  toWire: (state: TravelState): Wire => ({
    s: state.server,
    a: endToWire(state.from),
    b: endToWire(state.to),
    v: state.attackSpeed,
    d: state.departure,
    ...(state.mode === "alliances" && { m: "t" as const }),
    ...(state.alliances.length > 0 && { t: [...state.alliances] }),
  }),
  fromWire: (wire): TravelState => ({
    ...fromFirstWire(wire),
    mode: wire.m === "t" ? "alliances" : "point",
    alliances: wire.t ?? [],
  }),
});
