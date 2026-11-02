// Who opens the back office (docs/features/site-back-office.md): the accounts whose address is in ADMIN_EMAILS.

/** « a@x.fr, B@y.fr » → the addresses, lower case; unset or empty, nobody. */
export function parseAdminEmails(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Only a verified address counts: the magic link proved it belongs to whoever is signed in. */
export function isAdmin(admins: ReadonlySet<string>, user: { email: string; emailVerified: boolean }): boolean {
  return user.emailVerified && admins.has(user.email.toLowerCase());
}
