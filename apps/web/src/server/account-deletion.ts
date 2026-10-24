// What may stop an Optizzz account from being deleted (docs/features/site-comptes-espaces.md). Deleting it erases
// everything it owns at once, by the database's cascades from `User` (sessions today; declared Players, keys,
// memberships tomorrow): every new table of the « accounts » schema hangs off User with onDelete: Cascade.

/** One rule: why this account cannot be deleted now (shown as is to the person), or null. */
type DeletionCheck = (userId: string) => Promise<string | null>;

/**
 * Hook for the Alliance Spaces (ticket 16): blocked while the person is the last Admin of a space that has other
 * members (« Nommez un autre Admin de [nom] d'abord ») ; a space where the person is alone is deleted with the account.
 */
const deletionChecks: DeletionCheck[] = [];

/** The first reason that blocks deleting this account, or null when it can be deleted. */
export async function accountDeletionBlocker(userId: string, checks = deletionChecks): Promise<string | null> {
  for (const check of checks) {
    const reason = await check(userId);
    if (reason) return reason;
  }
  return null;
}
