// The back office's funnel (docs/features/site-back-office.md): how far each account got on the way to an Alliance
// Space that is used, and where the others stopped. Counts only: nothing of what the spaces hold.

/** What an account has done, as the site's tables tell it. */
export interface AccountProgress {
  /** A browser's extension is linked to it. */
  extension: boolean;
  /** A Player is attached (only the extension can do it). */
  player: boolean;
  /** The passphrase was chosen: the personal key exists. */
  key: boolean;
  /** One of its Players asked to join a space (pending or refused), or is in one. */
  requested: boolean;
  /** One of its Players is in a space. */
  member: boolean;
  /** …in a space with at least one other member. */
  withOthers: boolean;
  /** One of its Players shares relevés still valid (Envois). */
  sharing: boolean;
}

/** The steps, in order; the first is the account itself. */
export const FUNNEL_STEPS = [
  { label: "Compte créé", done: () => true },
  { label: "Extension liée", done: (p: AccountProgress) => p.extension },
  { label: "Joueur rattaché", done: (p: AccountProgress) => p.player },
  { label: "Phrase choisie", done: (p: AccountProgress) => p.key },
  { label: "Demande ou espace", done: (p: AccountProgress) => p.requested },
  { label: "Dans un espace", done: (p: AccountProgress) => p.member },
  { label: "Espace à plusieurs", done: (p: AccountProgress) => p.withOthers },
  { label: "Partage des relevés", done: (p: AccountProgress) => p.sharing },
] as const;

/**
 * The index of the furthest step done. A later step counts the earlier ones as passed: a Player attached means the
 * extension was linked once, even if it was unlinked since.
 */
export function furthestStep(progress: AccountProgress): number {
  for (let i = FUNNEL_STEPS.length - 1; i > 0; i--) if (FUNNEL_STEPS[i]?.done(progress)) return i;
  return 0;
}

export interface FunnelStep {
  label: string;
  /** Accounts that reached this step. */
  count: number;
  /** Their share of all accounts, 0 to 1. */
  share: number;
  /** Accounts that reached the step before and not this one. */
  lost: number;
}

/** How many accounts reached each step. */
export function funnel(accounts: readonly AccountProgress[]): FunnelStep[] {
  const furthest = accounts.map(furthestStep);
  const counts = FUNNEL_STEPS.map((_, i) => furthest.filter((f) => f >= i).length);
  return FUNNEL_STEPS.map((step, i) => {
    const count = counts[i] ?? 0;
    return {
      label: step.label,
      count,
      share: accounts.length === 0 ? 0 : count / accounts.length,
      lost: i === 0 ? 0 : (counts[i - 1] ?? 0) - count,
    };
  });
}

/** The furthest step an account reached, in the admin's words; « ✓ » when it went the whole way. */
export function reachedStep(progress: AccountProgress): string {
  const i = furthestStep(progress);
  const label = FUNNEL_STEPS[i]?.label ?? "";
  return i === FUNNEL_STEPS.length - 1 ? `✓ ${label}` : label;
}

const DAY = 24 * 60 * 60_000;

/**
 * Whether the account came back more than a day after its creation. `lastSeen` is its latest session's update, which
 * the site extends at most once a day on a visit: a sign-out or an expired session loses it.
 */
export function returnedLater(createdAt: Date, lastSeen: Date | null): boolean {
  return lastSeen !== null && lastSeen.getTime() - createdAt.getTime() > DAY;
}
