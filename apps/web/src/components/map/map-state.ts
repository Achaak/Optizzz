// What a map shows, kept in the fragment of its address (`#p=1.…`, @optizzz/game/site-links) to be shared, and in the browser to come back to
// it. The fragment never reaches the site's server. See docs/features/site-carte.md and site-outils.md.
import type { Chip, ChipTarget } from "@optizzz/map/selection";
import { defineLinkFormat, readLinkState } from "@optizzz/game/site-links/link-state";
import { z } from "zod";

export interface MapState {
  chips: Chip[];
  /** The player distances are measured from. */
  reference: number | null;
  /** The reference's Attack Speed, entered by the visitor. */
  level: number;
}

export const EMPTY_STATE: MapState = { chips: [], reference: null, level: 0 };

const bounds = z.object({ min: z.number().nullable(), max: z.number().nullable() });
const filter = z
  .object({ field: bounds.optional(), buildingScore: bounds.optional(), technologyScore: bounds.optional() })
  .optional();
const color = z.string().regex(/^#[0-9a-f]{6}$/i);

const stateSchema = z.object({
  c: z
    .array(
      z.union([
        z.object({ p: z.number().int(), k: color }),
        z.object({ a: z.string().min(1).max(20), k: color, f: filter }),
        z.object({ u: z.literal(1), k: color, f: filter }),
      ]),
    )
    .max(40),
  r: z.number().int().nullable(),
  v: z.number().int().min(0).max(100),
});

type Wire = z.infer<typeof stateSchema>;

/** Short keys in the address: a chip is `p` (player), `a` (alliance) or `u` (unaffiliated), with its colour `k`. */
const mapFormat = defineLinkFormat({
  version: 1,
  schema: stateSchema,
  toWire: (state: MapState): Wire => ({
    c: state.chips.map((chip) =>
      chip.kind === "player"
        ? { p: chip.id, k: chip.color }
        : chip.kind === "alliance"
          ? { a: chip.tag, k: chip.color, ...(chip.filter && { f: chip.filter }) }
          : { u: 1 as const, k: chip.color, ...(chip.filter && { f: chip.filter }) },
    ),
    r: state.reference,
    v: state.level,
  }),
  fromWire: (wire): MapState => ({
    chips: wire.c.map((chip): Chip => {
      if ("p" in chip) return { kind: "player", id: chip.p, color: chip.k };
      if ("a" in chip) return { kind: "alliance", tag: chip.a, color: chip.k, ...(chip.f && { filter: chip.f }) };
      return { kind: "unaffiliated", color: chip.k, ...(chip.f && { filter: chip.f }) };
    }),
    reference: wire.r,
    level: wire.v,
  }),
});

/** The state as the `p` of the fragment: the version, then short keys in base64url. */
export const encodeMapState = mapFormat.encode;

/** The state back from `p`; null when it is not one (a cut, hand-edited or unknown version of address). */
export const decodeMapState = mapFormat.decode;

/** What the address asks for: a shared state (`#p=`), a target (« Voir sur la carte » : `?player=`, `?alliance=`). */
export type MapRequest =
  { kind: "state"; state: MapState } | { kind: "invalid" } | { kind: "target"; target: ChipTarget } | { kind: "none" };

export function requestedMap(address: URL): MapRequest {
  const shared = readLinkState(address, mapFormat);
  if (shared.kind !== "none") return shared;
  const player = Number(address.searchParams.get("player"));
  if (Number.isInteger(player) && player > 0) return { kind: "target", target: { kind: "player", id: player } };
  const tag = address.searchParams.get("alliance");
  return tag ? { kind: "target", target: { kind: "alliance", tag } } : { kind: "none" };
}
