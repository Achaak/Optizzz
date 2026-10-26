// What the site's reminders read and write (docs/features/site-discord.md, « Rappels du site »), apart from Prisma so
// the rules (reminder-service.ts) run in a test with a store in memory. The site's store is prisma-store.ts.
import type { SpaceRole } from "~/server/spaces/store";

export interface RemindersRow {
  /** The webhook's address, encrypted with the site's key (at-rest.ts). */
  sealedUrl: string;
  kinds: string[];
  /** Discord said the webhook is gone (401, 404): no reminder leaves until an Admin saves an address again. */
  suspension: { status: number; at: Date } | null;
}

export interface ReminderStore {
  /** The account's role in the space, or null when it is not a member. */
  roleOf(spaceId: string, userId: string): Promise<SpaceRole | null>;
  spaceName(spaceId: string): Promise<string | null>;
  reminders(spaceId: string): Promise<RemindersRow | null>;
  /** A new address and its kinds; the suspension is forgotten. */
  saveReminders(spaceId: string, sealedUrl: string, kinds: string[]): Promise<void>;
  /** The kinds alone, the address kept: false when there is no address. */
  saveKinds(spaceId: string, kinds: string[]): Promise<boolean>;
  removeReminders(spaceId: string): Promise<void>;
  /**
   * Claims the right to post a reminder of this kind now: true, and `now` noted, when the last one was posted at or
   * before `notAfter` (or never); false otherwise. One write, so two events at once post once.
   */
  claim(spaceId: string, kind: string, now: Date, notAfter: Date): Promise<boolean>;
  /** Suspends the reminders, if the address is still `sealedUrl` (an Admin may have replaced it meanwhile). */
  suspend(spaceId: string, sealedUrl: string, status: number, at: Date): Promise<void>;
}
