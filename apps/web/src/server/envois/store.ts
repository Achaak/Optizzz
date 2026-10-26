// What the Envois read and write on the site (docs/features/site-envois.md), apart from Prisma so the rules
// (envoi-service.ts) run in a test with a store in memory. The site's store is prisma-store.ts.

export interface PlayerRef {
  server: string;
  playerId: number;
}

interface SpaceMemberInfo extends PlayerRef {
  pseudo: string;
  userId: string;
  role: "admin" | "delegate" | "member";
  /** What this Joueur sends (SENT_CATEGORIES), as their extension last said. */
  categories: string[];
}

export interface KeyVersionInfo {
  version: number;
  createdAt: Date;
  createdByPseudo: string | null;
}

export interface SpaceInfo {
  id: string;
  server: string;
  tag: string;
  name: string;
  /** Ascending. */
  versions: KeyVersionInfo[];
  members: SpaceMemberInfo[];
}

/** An item as an extension sends it, encrypted. */
export interface ItemInput {
  fingerprint: string;
  blob: string;
  /** The Admins' blob (the army sent with a flood), or null: handed to the space's Admins only. */
  detail: string | null;
  keyVersion: number;
  expiresAt: Date;
}

export interface ItemRow extends PlayerRef {
  id: string;
  category: string;
  fingerprint: string;
  blob: string;
  detail: string | null;
  updatedAt: Date;
}

export interface EnvoiStore {
  playersOf(userId: string): Promise<(PlayerRef & { pseudo: string })[]>;
  /** The space a Player is in, if any. */
  spaceOf(player: PlayerRef): Promise<string | null>;
  space(spaceId: string): Promise<SpaceInfo | null>;
  settingsOf(player: PlayerRef): Promise<string[]>;
  saveSettings(player: PlayerRef, categories: string[]): Promise<void>;
  /**
   * Writes the Joueur's items of a category in a space: a new fingerprint is added, a known one replaced only when its
   * blob or its detail changed (its `updatedAt` then moves to `now`, which the relève follows), and the fingerprints `removed` go.
   * Rows past their `expiresAt` in the space go too.
   */
  writeItems(
    spaceId: string,
    player: PlayerRef,
    category: string,
    items: ItemInput[],
    removed: string[],
    now: Date,
  ): Promise<void>;
  /**
   * A Joueur's states unchecked: the rows of `removed` go (in every space), and the Admins' blob of `withoutDetail`
   * (their `updatedAt` then moves to `now`, for the relève).
   */
  forgetStates(player: PlayerRef, removed: string[], withoutDetail: string[], now: Date): Promise<void>;
  /** The space's items not yet expired; with `since`, only those written after it. */
  items(spaceId: string, now: Date, since?: Date): Promise<ItemRow[]>;
  /** The ids of every item of the space not yet expired: what the readers keep. */
  liveIds(spaceId: string, now: Date): Promise<string[]>;
}
