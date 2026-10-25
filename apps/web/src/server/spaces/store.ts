// What the Alliance Spaces read and write on the site (docs/features/site-comptes-espaces.md), apart from Prisma so the
// rules (src/server/spaces/space-service.ts) run in a test with a store in memory. The site's store is prisma-store.ts.

export type SpaceRole = "admin" | "delegate" | "member";

/** A Player: a pseudo on a server, as the export numbers it. */
export interface PlayerRef {
  server: string;
  playerId: number;
}

export interface SealedKeyInput {
  version: number;
  sealed: string;
}

export interface KeyRow {
  publicKey: string;
  lockedPrivateKey: string;
  trustList: string | null;
  trustListRevision: number;
}

export interface SpaceRow {
  id: string;
  server: string;
  tag: string;
  name: string;
  createdAt: Date;
}

export interface MemberRow extends PlayerRef {
  pseudo: string;
  userId: string;
  role: SpaceRole;
  joinedAt: Date;
  /**
   * The key its Clés d'alliance were last sealed for. Another key than the account's today means « clé à renvoyer »
   * (passphrase forgotten): its boxes are gone, and the old key is still the one a revocation names.
   */
  sealedFor: string;
  /** The account's key today (null before a first passphrase). */
  currentKey: string | null;
  /** The versions of the Clé d'alliance sealed for it, ascending. */
  versions: number[];
  /**
   * « Accès à renvoyer » although nothing is missing: at an Admin's withdrawal, the Admin who withdrew did not believe
   * this member's key and did not seal every version again for it (ticket 18b). Its boxes stay.
   */
  resendNeeded: boolean;
}

export interface RequestRow extends PlayerRef {
  id: string;
  pseudo: string;
  userId: string;
  status: "pending" | "refused";
  createdAt: Date;
  decidedAt: Date | null;
  currentKey: string | null;
}

/** Every version of the Clé d'alliance sealed for one member. */
export interface SealedForMember {
  playerId: number;
  sealed: SealedKeyInput[];
}

/** The absence alerts of a space, encrypted with its Clé d'alliance (src/lib/spaces/absences.ts). */
export interface AbsenceAlertsRow {
  blob: string;
  revision: number;
}

/** What one space's operations read and write, inside one transaction that holds the space. */
export interface SpaceTransaction {
  space(): Promise<SpaceRow | null>;
  members(): Promise<MemberRow[]>;
  requests(): Promise<RequestRow[]>;
  /** The versions of the Clé d'alliance of the space, ascending: one row each, never two of the same number. */
  versions(): Promise<number[]>;
  sealedFor(player: PlayerRef): Promise<SealedKeyInput[]>;
  certificates(): Promise<string[]>;
  /** The space a Player is in, if any (one at most). */
  spaceOfPlayer(player: PlayerRef): Promise<string | null>;
  addMember(member: PlayerRef & { role: SpaceRole; publicKey: string }, sealed: SealedKeyInput[]): Promise<void>;
  /**
   * « Clé à renvoyer » done, or every version sealed again: the member's key, and every version sealed for it
   * (replacing older boxes, and clearing `resendNeeded`).
   */
  sealFor(player: PlayerRef, publicKey: string, sealed: SealedKeyInput[]): Promise<void>;
  /** Marks the member « à renvoyer », its boxes kept (`MemberRow.resendNeeded`). */
  askResend(player: PlayerRef): Promise<void>;
  /** A new version of the Clé d'alliance: « taken » when the space already has this number. */
  addVersion(version: number, createdByPseudo: string): Promise<"added" | "taken">;

  absenceAlerts(): Promise<AbsenceAlertsRow | null>;
  /** Writes the alerts if their revision is still `expectedRevision` (0: none yet); the new revision, or null. */
  saveAbsenceAlerts(blob: string, expectedRevision: number): Promise<number | null>;
  setRole(player: PlayerRef, role: SpaceRole): Promise<void>;
  removeMember(player: PlayerRef): Promise<void>;
  addCertificates(blobs: string[]): Promise<void>;
  /** A new pending request, or a refused one asked again. */
  putRequest(player: PlayerRef, at: Date): Promise<void>;
  deleteRequest(id: string): Promise<void>;
  refuseRequest(id: string, at: Date): Promise<void>;
  rename(name: string): Promise<void>;
  deleteSpace(): Promise<void>;
}

export interface SpaceSummary {
  id: string;
  name: string;
  server: string;
  tag: string;
  createdAt: Date;
  admins: string[];
  memberCount: number;
}

interface MembershipRow extends PlayerRef {
  spaceId: string;
  spaceName: string;
  spaceTag: string;
  role: SpaceRole;
  sealedFor: string;
  resendNeeded: boolean;
}

interface OwnRequestRow extends PlayerRef {
  spaceId: string;
  spaceName: string;
  status: "pending" | "refused";
  createdAt: Date;
  decidedAt: Date | null;
}

export interface SpaceStore {
  key(userId: string): Promise<KeyRow | null>;
  /** « exists » when the account already has a key pair. */
  createKey(userId: string, publicKey: string, lockedPrivateKey: string): Promise<"created" | "exists">;
  /** A new passphrase over the same pair: false when the account's public key is another one. */
  relockKey(userId: string, publicKey: string, lockedPrivateKey: string): Promise<boolean>;
  /**
   * « J'ai oublié ma phrase »: a new pair. Every membership becomes « clé à renvoyer » (its sealed keys are deleted,
   * its old key stays) and the trust list, which only the old key opened, is dropped.
   */
  resetKey(userId: string, publicKey: string, lockedPrivateKey: string): Promise<void>;
  /** Writes the trust list if its revision is still `expectedRevision`; the new revision, or null on a conflict. */
  saveTrustList(userId: string, trustList: string, expectedRevision: number): Promise<number | null>;
  playersOf(userId: string): Promise<(PlayerRef & { pseudo: string })[]>;
  /** The Player's alliance tag in the latest export: null without alliance, undefined when not in the export. */
  exportAlliance(player: PlayerRef): Promise<string | null | undefined>;
  extensionLinked(userId: string): Promise<boolean>;
  /** « taken » when the id is already used, or the Player is already in a space. Version 1 is the space's first. */
  createSpace(
    space: Omit<SpaceRow, "createdAt">,
    creator: PlayerRef & { publicKey: string; pseudo: string },
    sealed: SealedKeyInput[],
  ): Promise<"created" | "taken">;
  spaceSummary(spaceId: string): Promise<SpaceSummary | null>;
  spacesOfAlliance(server: string, tag: string): Promise<SpaceSummary[]>;
  membershipsOf(userId: string): Promise<MembershipRow[]>;
  requestsOf(userId: string): Promise<OwnRequestRow[]>;
  /** Runs `work` in a transaction that holds the space: two Admins acting at once are served one after the other. */
  inSpace<T>(spaceId: string, work: (tx: SpaceTransaction) => Promise<T>): Promise<T>;
}
