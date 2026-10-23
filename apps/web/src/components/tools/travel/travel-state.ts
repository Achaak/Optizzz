// What the travel tool keeps in its address (`#p=1.…`) and in the browser: the server, the two ends, the sender's
// Attack Speed and the departure if one is set. See docs/features/site-trajets.md and site-outils.md.
import { defineLinkFormat } from "@optizzz/game/site-links/link-state";
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
}

export const EMPTY_TRAVEL: TravelState = { server: null, from: null, to: null, attackSpeed: null, departure: null };

/** « Inverser »: the ends swap; the Attack Speed stays as typed (the new sender's, to type). */
export const swapEnds = (state: TravelState): TravelState => ({ ...state, from: state.to, to: state.from });

/** A player of another server is not one of this server: only the positions stay. */
export function withServer(state: TravelState, server: string | null): TravelState {
  if (server === state.server) return state;
  const kept = (end: PickedEnd | null) => (end?.kind === "player" ? null : end);
  return { ...state, server, from: kept(state.from), to: kept(state.to) };
}

const coordinate = z.number().int().min(0).max(100_000).nullable();
/** A player is their id; a position is `[x, y]`. */
const endSchema = z.union([z.number().int().positive(), z.tuple([coordinate, coordinate])]).nullable();

const wireSchema = z.object({
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

export const travelFormat = defineLinkFormat({
  version: 1,
  schema: wireSchema,
  toWire: (state: TravelState): Wire => ({
    s: state.server,
    a: endToWire(state.from),
    b: endToWire(state.to),
    v: state.attackSpeed,
    d: state.departure,
  }),
  fromWire: (wire): TravelState => ({
    server: wire.s,
    from: endFromWire(wire.a),
    to: endFromWire(wire.b),
    attackSpeed: wire.v,
    departure: wire.d,
  }),
});
