// The last list of the player's alliance members read on the game's Members page, with its date, one per server. Kept
// by `collect` when the player opens the page, never by a request to the game: an Admin's approval reads it, handed by
// the background to the Alliance Space page open in this browser (features/optizzz-account/space-page.ts), and so do
// the departure alerts of an Admin's or Délégué's page (docs/features/site-comptes-espaces.md). It is never sent to the
// site's server: the page sends only the absences it finds, encrypted with the Clé d'alliance.
import { readAllianceTag, readMembersHuntingField } from "@optizzz/game/pages/alliance";
import { storage } from "wxt/utils/storage";

export interface AllianceMembers {
  /** The alliance's tag, from the page's hidden data; null when the page does not say it. */
  tag: string | null;
  /** The members' pseudos, as the page lists them. */
  pseudos: string[];
  readAt: Date;
}

const key = (origin: string) => `local:allianceMembers:${new URL(origin).host}` as const;

/** What alliance.php?Membres shows; null on a page without the members table. */
export function readAllianceMembers(doc: Document, readAt: Date): AllianceMembers | null {
  if (!doc.querySelector("#tabMembresAlliance")) return null;
  const pseudos = [...readMembersHuntingField(doc).keys()];
  return pseudos.length > 0 ? { tag: readAllianceTag(doc), pseudos, readAt } : null;
}

export async function storeAllianceMembers(origin: string, members: AllianceMembers): Promise<void> {
  await storage.setItem(key(origin), { ...members, readAt: members.readAt.getTime() });
}

export async function loadAllianceMembers(origin: string): Promise<AllianceMembers | null> {
  const stored = await storage.getItem<Omit<AllianceMembers, "readAt"> & { readAt: number }>(key(origin));
  return stored ? { ...stored, readAt: new Date(stored.readAt) } : null;
}
