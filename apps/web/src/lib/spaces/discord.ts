// The alliance's Discord webhook in an Admin's browser (docs/features/site-discord.md). Its address and the events
// that go there are encrypted here with the Clé d'alliance (ADR 0005, « Discord »): the site keeps the record for the
// members' extensions without being able to read it, and never posts to it (its own content-free reminders go to a
// second webhook: ./reminders.ts).
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { dataKeyVersion, decryptData, encryptData } from "@optizzz/crypto/data";
import { formatDateTime } from "@optizzz/game/format/time-format";
import { discordSettingsFrom, discordSettingsText, type DiscordSettings } from "@optizzz/game/site-links/discord";

/** Encrypted with the newest version of the Clé d'alliance (ADR 0005, « Donnée d'alliance chiffrée »). */
export const lockDiscord = (settings: DiscordSettings, keyring: AllianceKeyring): Promise<string> =>
  encryptData(discordSettingsText(settings), keyring);

/** Throws when it does not open, or does not hold a Discord webhook. */
export async function openDiscord(blob: string, keyring: AllianceKeyring): Promise<DiscordSettings> {
  return discordSettingsFrom(JSON.parse(await decryptData(blob, keyring)));
}

/** Encrypted with an older version than the space's newest (a member was excluded since): to encrypt again. */
export const staleDiscord = (blob: string, newest: number): boolean => (dataKeyVersion(blob) ?? 0) < newest;

/** The address was entered before a member's exclusion: that member knows it, and could post to the channel. */
export const knownByExcluded = (settings: DiscordSettings, newest: number): boolean =>
  settings.url !== null && settings.urlSetAtVersion < newest;

/** What Discord's answer means for the Admin. */
function refusalReason(status: number): string {
  if (status === 404) return "ce webhook n'existe plus (supprimé dans Discord ?)";
  if (status === 401 || status === 403) return "l'adresse du webhook n'est pas valable";
  return `erreur ${String(status)}`;
}

/** « Discord a refusé le dernier rappel du site le 26/10 à 13 h 00 : … » (src/server/reminders/). */
export function suspensionText(suspension: { status: number; at: Date }): string {
  return `Discord a refusé le dernier rappel du site, le ${formatDateTime(suspension.at)} : ${refusalReason(suspension.status)}. Les rappels sont suspendus : enregistrez une nouvelle adresse.`;
}

/** « Discord a refusé le dernier message, envoyé depuis l'extension de Bruno le 26/10 à 13 h 00 : … ». */
export function refusalText(refusal: { status: number; at: Date; pseudo: string }): string {
  return `Discord a refusé le dernier message, envoyé depuis l'extension de ${refusal.pseudo} le ${formatDateTime(refusal.at)} : ${refusalReason(refusal.status)}. Enregistrez une nouvelle adresse.`;
}
