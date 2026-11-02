// The back office's « Comptes et Espaces » (docs/features/site-back-office.md): who uses the site, never what the spaces
// hold. Addresses are masked: the admin sees how many and how active, not whom to write to.

/** « axel@gmail.com » → « a•••@gmail.com »: the first letter and the domain. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}

/** The latest of some dates, null when none. */
export function latest(dates: readonly (Date | null | undefined)[]): Date | null {
  let last: Date | null = null;
  for (const date of dates) if (date && (!last || date > last)) last = date;
  return last;
}

/** A space's Discord announcements, in words with their sign: refused, on, or none. */
export function discordState(discord: { refusedStatus: number | null } | null): string {
  if (!discord) return "— aucun";
  return discord.refusedStatus === null ? "✓ actif" : `▲ refusé (${String(discord.refusedStatus)})`;
}

/** The site's reminders of a space: suspended by Discord, on, or none. */
export function remindersState(reminders: { suspendedStatus: number | null; kinds: readonly string[] } | null): string {
  if (!reminders || reminders.kinds.length === 0) return "— aucun";
  return reminders.suspendedStatus === null ? "✓ actifs" : `▲ suspendus (${String(reminders.suspendedStatus)})`;
}
