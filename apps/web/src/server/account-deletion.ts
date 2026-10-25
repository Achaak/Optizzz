// What may stop an Optizzz account from being deleted (docs/features/site-comptes-espaces.md). Deleting it erases
// everything it owns at once, by the database's cascades from `User` (sessions, extension tokens, declared Players and
// their memberships, sealed keys, requests, the key pair and the trust list): every table of the « accounts » schema
// hangs off User with onDelete: Cascade. A space where the account is alone goes with it (src/server/auth.ts).

/** One rule: why this account cannot be deleted now (shown as is to the person), or null. */
export type DeletionCheck = (userId: string) => Promise<string | null>;

/** The first reason that blocks deleting this account, or null when it can be deleted. */
export async function accountDeletionBlocker(userId: string, checks: DeletionCheck[] = []): Promise<string | null> {
  for (const check of checks) {
    const reason = await check(userId);
    if (reason) return reason;
  }
  return null;
}
