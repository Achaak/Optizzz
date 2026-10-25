// Departure alerts (docs/features/site-comptes-espaces.md, « Départs »): a member of the space missing from the game's
// Members page is flagged from the first reading where they are missing, « absent depuis le … », until they are back.
// Nothing is removed on its own. The list comes from the extension of the Admin or Délégué whose page is open
// (extension-bridge.ts) and never reaches the site; what reaches it is this record, encrypted with the Clé d'alliance
// in the browser (ADR 0005): the site keeps it for the other Admins and Délégués without being able to read it.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { decryptData, encryptData } from "@optizzz/crypto/data";
import type { MembersList } from "@optizzz/game/site-links/space-bridge";
import { z } from "zod";

export interface Absence {
  playerId: number;
  pseudo: string;
  /** When the first list where the member is missing was read, in milliseconds since 1970. */
  since: number;
}

export interface AbsenceRecord {
  /** When the list last used was read: an older one, from another Admin's extension, is not used. */
  listReadAt: number;
  absent: Absence[];
}

interface SpaceMembers {
  tag: string;
  members: readonly { playerId: number; pseudo: string; joinedAt: Date }[];
}

const RECORD = z.object({
  listReadAt: z.number().int().nonnegative(),
  absent: z
    .array(
      z.object({
        playerId: z.number().int(),
        pseudo: z.string().max(100),
        since: z.number().int().nonnegative(),
      }),
    )
    .max(1000),
});

/**
 * The record after a new reading of the Members page, or null when that reading changes nothing: a list of another
 * alliance, or not newer than the last one used. A member who joined the space after the reading is not flagged.
 */
export function updateAbsences(
  previous: AbsenceRecord | null,
  list: MembersList,
  space: SpaceMembers,
): AbsenceRecord | null {
  if (list.tag !== null && list.tag.toLowerCase() !== space.tag.toLowerCase()) return null;
  if (previous && list.readAt <= previous.listReadAt) return null;
  const listed = new Set(list.pseudos);
  const absent = space.members
    .filter((m) => !listed.has(m.pseudo) && m.joinedAt.getTime() < list.readAt)
    .map((m) => ({
      playerId: m.playerId,
      pseudo: m.pseudo,
      since: previous?.absent.find((a) => a.playerId === m.playerId)?.since ?? list.readAt,
    }));
  return { listReadAt: list.readAt, absent };
}

/** The alerts to show: members still in the space, with their pseudo of today. */
export function absencesToShow(
  record: AbsenceRecord | null,
  members: readonly { playerId: number; pseudo: string }[],
): Absence[] {
  return (record?.absent ?? []).flatMap((a) => {
    const member = members.find((m) => m.playerId === a.playerId);
    return member ? [{ ...a, pseudo: member.pseudo }] : [];
  });
}

/** Encrypted with the newest version of the Clé d'alliance (ADR 0005, « Donnée d'alliance chiffrée »). */
export const lockAbsences = (record: AbsenceRecord, keyring: AllianceKeyring): Promise<string> =>
  encryptData(JSON.stringify(record), keyring);

/** Throws when it does not open, or is not an alerts record. */
export async function openAbsences(blob: string, keyring: AllianceKeyring): Promise<AbsenceRecord> {
  return RECORD.parse(JSON.parse(await decryptData(blob, keyring)));
}
