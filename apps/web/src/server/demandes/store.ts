// What the Demandes read and write on the site (docs/features/site-demandes.md), apart from Prisma so the rules
// (demande-service.ts) run in a test with a store in memory. The site's store is prisma-store.ts. Who is in a space,
// with which role and what they send, comes from the Envois' store.
import type { DemandeStatus } from "@optizzz/game/site-links/demandes";
import type { EnvoiStore, PlayerRef } from "~/server/envois/store";

export interface DemandeRow extends PlayerRef {
  id: string;
  spaceId: string;
  status: DemandeStatus;
  rank: number;
  blob: string;
  keyVersion: number;
  createdAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
  decidedByPseudo: string | null;
  endedAt: Date | null;
}

/** What a change of status writes besides it. */
export interface DemandeChange {
  status: DemandeStatus;
  decidedAt?: Date;
  decidedByPseudo?: string;
  endedAt?: Date;
  expiresAt?: Date;
}

export interface DemandeStore extends Pick<EnvoiStore, "playersOf" | "spaceOf" | "space" | "settingsOf"> {
  /** The space's Demandes not yet past their date. */
  demandes(spaceId: string, now: Date): Promise<DemandeRow[]>;
  /** One Demande, if not past its date. */
  demande(id: string, now: Date): Promise<DemandeRow | null>;
  /** Adds a Demande last in its requester's order; false when its id is taken. The space's expired ones go. */
  create(row: Omit<DemandeRow, "rank" | "updatedAt" | "createdAt">, now: Date): Promise<boolean>;
  /**
   * Moves a Demande to a new status, only while it is still in one of `from`: false when someone changed it first.
   * Its `updatedAt` moves to `now`, which the relève follows.
   */
  change(id: string, from: readonly DemandeStatus[], change: DemandeChange, now: Date): Promise<boolean>;
  /** The requester's order: each id gets its index as rank. */
  reorder(ids: readonly string[], now: Date): Promise<void>;
}
