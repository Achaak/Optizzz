// What a map shows, kept in its address (`?p=…`) to be shared, and in the browser to come back to it.
// See docs/features/site-carte.md.
import type { Chip } from "@optizzz/map/selection";
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

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)),
  );

/** The state as the `p` of the address: short keys, base64url. */
export function encodeMapState(state: MapState): string {
  const c = state.chips.map((chip) =>
    chip.kind === "player"
      ? { p: chip.id, k: chip.color }
      : chip.kind === "alliance"
        ? { a: chip.tag, k: chip.color, ...(chip.filter && { f: chip.filter }) }
        : { u: 1 as const, k: chip.color, ...(chip.filter && { f: chip.filter }) },
  );
  return toBase64Url(JSON.stringify({ c, r: state.reference, v: state.level }));
}

/** The state back from `p`; null when it is not one (an old or hand-edited address). */
export function decodeMapState(text: string): MapState | null {
  let json: unknown;
  try {
    json = JSON.parse(fromBase64Url(text));
  } catch {
    return null;
  }
  const parsed = stateSchema.safeParse(json);
  if (!parsed.success) return null;
  const chips = parsed.data.c.map((chip): Chip => {
    if ("p" in chip) return { kind: "player", id: chip.p, color: chip.k };
    if ("a" in chip) return { kind: "alliance", tag: chip.a, color: chip.k, ...(chip.f && { filter: chip.f }) };
    return { kind: "unaffiliated", color: chip.k, ...(chip.f && { filter: chip.f }) };
  });
  return { chips, reference: parsed.data.r, level: parsed.data.v };
}
