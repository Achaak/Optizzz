// The TDC chain's roles of an Alliance Space (docs/features/site-chaine.md), as they are encrypted with the Clé
// d'alliance: set on optizzz.fr by an Admin or a Délégué, taken up by every member's extension.
import { z } from "zod";
import { roleKey, type Role } from "../tdc-chain/roles";

/** Keyed by player id, as in the extension's chain. */
export interface ChainRolesRecord {
  roles: Record<string, Role>;
  /** Field each hunter keeps. */
  keep: Record<string, number>;
}

const PLAYER_ID = z.string().regex(/^\d{1,10}$/);

const RECORD = z.object({
  v: z.literal(1),
  spaceId: z.string(),
  roles: z.record(PLAYER_ID, z.string()).refine((roles) => Object.keys(roles).length <= 500),
  keep: z.record(PLAYER_ID, z.number().int().nonnegative()).refine((keep) => Object.keys(keep).length <= 500),
});

/** « granary », « passer:2 »… back to a role; null for anything else. */
function roleOf(key: string): Role | null {
  if (key === "granary" || key === "hunter" || key === "drain" || key === "protected" || key === "out")
    return { kind: key };
  const passer = /^passer:([1-9]\d{0,2})$/.exec(key);
  return passer ? { kind: "passer", rank: Number(passer[1]) } : null;
}

/** The record as it is encrypted: the space's id inside, so that it does not open in another space. */
export const chainRolesText = (record: ChainRolesRecord, spaceId: string): string =>
  JSON.stringify({
    v: 1,
    spaceId,
    roles: Object.fromEntries(Object.entries(record.roles).map(([id, role]) => [id, roleKey(role)])),
    keep: record.keep,
  });

/** The record once decrypted; throws when it is malformed, holds an unknown role, or belongs to another space. */
export function chainRolesFrom(value: unknown, spaceId: string): ChainRolesRecord {
  const parsed = RECORD.parse(value);
  if (parsed.spaceId !== spaceId) throw new Error("Chain roles of another space.");
  const roles: Record<string, Role> = {};
  for (const [id, key] of Object.entries(parsed.roles)) {
    const role = roleOf(key);
    if (!role) throw new Error(`Unknown chain role: ${key}`);
    roles[id] = role;
  }
  return { roles, keep: parsed.keep };
}
