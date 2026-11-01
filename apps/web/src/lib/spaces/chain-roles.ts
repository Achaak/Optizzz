// The TDC chain's roles in an Admin's or a Délégué's browser (docs/features/site-chaine.md). They are encrypted here
// with the Clé d'alliance (ADR 0005, « Donnée d'alliance chiffrée »): the site keeps them for the members' extensions
// without knowing who is a granary, a passer or a hunter.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { dataKeyVersion, decryptData, encryptData } from "@optizzz/crypto/data";
import { chainRolesFrom, chainRolesText, type ChainRolesRecord } from "@optizzz/game/site-links/chain-roles";
import { chainRoles, roleKey, type Role } from "@optizzz/game/tdc-chain/roles";

/** Encrypted with the newest version of the Clé d'alliance. */
export const lockChainRoles = (record: ChainRolesRecord, spaceId: string, keyring: AllianceKeyring): Promise<string> =>
  encryptData(chainRolesText(record, spaceId), keyring);

/** Throws when it does not open, or is not this space's roles. */
export async function openChainRoles(blob: string, spaceId: string, keyring: AllianceKeyring) {
  return chainRolesFrom(JSON.parse(await decryptData(blob, keyring)), spaceId);
}

/** Encrypted with an older version than the space's newest (a member was excluded since): to encrypt again. */
export const staleChainRoles = (blob: string, newest: number): boolean => (dataKeyVersion(blob) ?? 0) < newest;

/** A member of the alliance as the export shows them, in the space or not. */
export interface RosterMember {
  id: number;
  pseudo: string;
  field: number;
  onHoliday: boolean;
  isBanned: boolean;
}

const OUT: Role = { kind: "out" };

/**
 * The roles shown for the alliance's members, as the extension's chain shows them: the saved ones (a member arrived
 * since is out, and among the `newcomers`), or until then the ones proposed from the export's fields. Holidays and
 * banned players are never in the chain.
 */
export function shownRoles(
  roster: readonly RosterMember[],
  saved: ChainRolesRecord | null,
): { roles: Map<number, Role>; newcomers: number[] } {
  const inChain = roster.filter((m) => !m.onHoliday && !m.isBanned);
  const roles = chainRoles(inChain, saved?.roles ?? null);
  return {
    roles: new Map(roster.map((m) => [m.id, roles.get(m.id) ?? OUT])),
    newcomers: saved ? inChain.filter((m) => !(String(m.id) in saved.roles)).map((m) => m.id) : [],
  };
}

const sameMember = (a: ChainRolesRecord, b: ChainRolesRecord, id: string) =>
  (a.roles[id] ? roleKey(a.roles[id]) : null) === (b.roles[id] ? roleKey(b.roles[id]) : null) &&
  a.keep[id] === b.keep[id];

/** The members (player ids) whose role or field to keep differs between two records, in id order. */
export function changedMembers(before: ChainRolesRecord, after: ChainRolesRecord): string[] {
  const ids = new Set([
    ...Object.keys(before.roles),
    ...Object.keys(before.keep),
    ...Object.keys(after.roles),
    ...Object.keys(after.keep),
  ]);
  return [...ids].filter((id) => !sameMember(before, after, id)).sort((a, b) => Number(a) - Number(b));
}

/**
 * Someone saved while I was editing: my changes (from `base`, what I read) put on `theirs`, the newer roles. Mine win
 * on the members I touched, theirs everywhere else.
 */
export function rebaseRoles(
  base: ChainRolesRecord,
  mine: ChainRolesRecord,
  theirs: ChainRolesRecord,
): ChainRolesRecord {
  const touched = new Set(changedMembers(base, mine));
  const merge = <T>(theirs: Record<string, T>, mine: Record<string, T>): Record<string, T> =>
    Object.fromEntries([
      ...Object.entries(theirs).filter(([id]) => !touched.has(id)),
      ...Object.entries(mine).filter(([id]) => touched.has(id)),
    ]);
  return { roles: merge(theirs.roles, mine.roles), keep: merge(theirs.keep, mine.keep) };
}
