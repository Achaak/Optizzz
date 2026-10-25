// The Alliance Spaces' store in memory, for the tests of the rules (space-service.test.ts) and of the browsers' flows.
// It follows the Prisma store (prisma-store.ts): one space per Player, cascades, « clé à renvoyer » on a reset.
import type {
  AbsenceAlertsRow,
  KeyRow,
  MemberRow,
  PlayerRef,
  RequestRow,
  SealedKeyInput,
  SpaceRole,
  SpaceRow,
  SpaceStore,
  SpaceSummary,
  SpaceTransaction,
} from "./store";

interface Member extends PlayerRef {
  spaceId: string;
  role: SpaceRole;
  joinedAt: Date;
  publicKey: string;
  sealed: SealedKeyInput[];
  resendNeeded?: boolean;
}

interface Request extends PlayerRef {
  id: string;
  spaceId: string;
  status: "pending" | "refused";
  createdAt: Date;
  decidedAt: Date | null;
}

export function memoryStore(now: () => Date = () => new Date("2026-10-25T10:00:00Z")) {
  const keys = new Map<string, KeyRow>();
  const players: (PlayerRef & { pseudo: string; userId: string; alliance: string | null })[] = [];
  const linked = new Set<string>();
  const spaces = new Map<string, SpaceRow>();
  let members: Member[] = [];
  let requests: Request[] = [];
  const certificates = new Map<string, string[]>();
  const versions = new Map<string, Set<number>>();
  const absences = new Map<string, AbsenceAlertsRow>();
  let nextRequest = 1;

  const same = (a: PlayerRef, b: PlayerRef) => a.server === b.server && a.playerId === b.playerId;
  const playerOf = (ref: PlayerRef) => {
    const player = players.find((p) => same(p, ref));
    if (!player) throw new Error("Unknown player");
    return player;
  };
  const summary = (space: SpaceRow): SpaceSummary => {
    const inSpace = members.filter((m) => m.spaceId === space.id);
    return {
      ...space,
      admins: inSpace.filter((m) => m.role === "admin").map((m) => playerOf(m).pseudo),
      memberCount: inSpace.length,
    };
  };

  const transaction = (spaceId: string): SpaceTransaction => ({
    space: () => Promise.resolve(spaces.get(spaceId) ?? null),
    members: () =>
      Promise.resolve(
        members
          .filter((m) => m.spaceId === spaceId)
          .map((m): MemberRow => {
            const player = playerOf(m);
            return {
              server: m.server,
              playerId: m.playerId,
              pseudo: player.pseudo,
              userId: player.userId,
              role: m.role,
              joinedAt: m.joinedAt,
              sealedFor: m.publicKey,
              currentKey: keys.get(player.userId)?.publicKey ?? null,
              versions: m.sealed.map((s) => s.version).sort((a, b) => a - b),
              resendNeeded: m.resendNeeded ?? false,
            };
          }),
      ),
    requests: () =>
      Promise.resolve(
        requests
          .filter((r) => r.spaceId === spaceId)
          .map((r): RequestRow => {
            const player = playerOf(r);
            return {
              id: r.id,
              server: r.server,
              playerId: r.playerId,
              pseudo: player.pseudo,
              userId: player.userId,
              status: r.status,
              createdAt: r.createdAt,
              decidedAt: r.decidedAt,
              currentKey: keys.get(player.userId)?.publicKey ?? null,
            };
          }),
      ),
    versions: () => Promise.resolve([...(versions.get(spaceId) ?? [])].sort((a, b) => a - b)),
    sealedFor: (player) => Promise.resolve(members.find((m) => m.spaceId === spaceId && same(m, player))?.sealed ?? []),
    certificates: () => Promise.resolve([...(certificates.get(spaceId) ?? [])]),
    spaceOfPlayer: (player) => Promise.resolve(members.find((m) => same(m, player))?.spaceId ?? null),
    addMember: (member, sealed) => {
      if (members.some((m) => same(m, member))) throw new Error("Unique violation");
      members.push({ ...member, spaceId, joinedAt: now(), sealed: [...sealed] });
      return Promise.resolve();
    },
    sealFor: (player, publicKey, sealed) => {
      const member = members.find((m) => m.spaceId === spaceId && same(m, player));
      if (member) Object.assign(member, { publicKey, sealed: [...sealed], resendNeeded: false });
      return Promise.resolve();
    },
    askResend: (player) => {
      const member = members.find((m) => m.spaceId === spaceId && same(m, player));
      if (member) member.resendNeeded = true;
      return Promise.resolve();
    },
    addVersion: (version) => {
      const known = versions.get(spaceId) ?? new Set<number>();
      if (known.has(version)) return Promise.resolve("taken");
      versions.set(spaceId, known.add(version));
      return Promise.resolve("added");
    },
    absenceAlerts: () => Promise.resolve(absences.get(spaceId) ?? null),
    saveAbsenceAlerts: (blob, expected) => {
      const revision = absences.get(spaceId)?.revision ?? 0;
      if (revision !== expected) return Promise.resolve(null);
      absences.set(spaceId, { blob, revision: revision + 1 });
      return Promise.resolve(revision + 1);
    },
    setRole: (player, role) => {
      const member = members.find((m) => m.spaceId === spaceId && same(m, player));
      if (member) member.role = role;
      return Promise.resolve();
    },
    removeMember: (player) => {
      members = members.filter((m) => !(m.spaceId === spaceId && same(m, player)));
      return Promise.resolve();
    },
    addCertificates: (blobs) => {
      const known = certificates.get(spaceId) ?? [];
      certificates.set(spaceId, [...known, ...blobs.filter((b) => !known.includes(b))]);
      return Promise.resolve();
    },
    putRequest: (player, at) => {
      requests = requests.filter((r) => !(r.spaceId === spaceId && same(r, player)));
      requests.push({
        ...player,
        id: `request-${String(nextRequest++)}`,
        spaceId,
        status: "pending",
        createdAt: at,
        decidedAt: null,
      });
      return Promise.resolve();
    },
    deleteRequest: (id) => {
      requests = requests.filter((r) => r.id !== id);
      return Promise.resolve();
    },
    refuseRequest: (id, at) => {
      const request = requests.find((r) => r.id === id);
      if (request) Object.assign(request, { status: "refused", decidedAt: at });
      return Promise.resolve();
    },
    rename: (name) => {
      const space = spaces.get(spaceId);
      if (space) space.name = name;
      return Promise.resolve();
    },
    deleteSpace: () => {
      spaces.delete(spaceId);
      members = members.filter((m) => m.spaceId !== spaceId);
      requests = requests.filter((r) => r.spaceId !== spaceId);
      certificates.delete(spaceId);
      versions.delete(spaceId);
      absences.delete(spaceId);
      return Promise.resolve();
    },
  });

  const store: SpaceStore = {
    key: (userId) => Promise.resolve(keys.get(userId) ?? null),
    createKey: (userId, publicKey, lockedPrivateKey) => {
      if (keys.has(userId)) return Promise.resolve("exists");
      keys.set(userId, { publicKey, lockedPrivateKey, trustList: null, trustListRevision: 0 });
      return Promise.resolve("created");
    },
    relockKey: (userId, publicKey, lockedPrivateKey) => {
      const key = keys.get(userId);
      if (key?.publicKey !== publicKey) return Promise.resolve(false);
      key.lockedPrivateKey = lockedPrivateKey;
      return Promise.resolve(true);
    },
    resetKey: (userId, publicKey, lockedPrivateKey) => {
      const revision = keys.get(userId)?.trustListRevision ?? 0;
      keys.set(userId, { publicKey, lockedPrivateKey, trustList: null, trustListRevision: revision + 1 });
      for (const m of members) if (playerOf(m).userId === userId) m.sealed = [];
      return Promise.resolve();
    },
    saveTrustList: (userId, trustList, expected) => {
      const key = keys.get(userId);
      if (key?.trustListRevision !== expected) return Promise.resolve(null);
      key.trustList = trustList;
      key.trustListRevision += 1;
      return Promise.resolve(key.trustListRevision);
    },
    playersOf: (userId) =>
      Promise.resolve(
        players
          .filter((p) => p.userId === userId)
          .map(({ server, playerId, pseudo }) => ({ server, playerId, pseudo })),
      ),
    exportAlliance: (ref) => Promise.resolve(players.find((p) => same(p, ref))?.alliance),
    extensionLinked: (userId) => Promise.resolve(linked.has(userId)),
    createSpace: (space, creator, sealed) => {
      if (spaces.has(space.id) || members.some((m) => same(m, creator))) return Promise.resolve("taken");
      spaces.set(space.id, { ...space, createdAt: now() });
      versions.set(space.id, new Set([1]));
      members.push({ ...creator, spaceId: space.id, role: "admin", joinedAt: now(), sealed: [...sealed] });
      return Promise.resolve("created");
    },
    spaceSummary: (spaceId) => {
      const space = spaces.get(spaceId);
      return Promise.resolve(space ? summary(space) : null);
    },
    spacesOfAlliance: (server, tag) =>
      Promise.resolve(
        [...spaces.values()]
          .filter((s) => s.server === server && s.tag.toLowerCase() === tag.toLowerCase())
          .map(summary),
      ),
    membershipsOf: (userId) =>
      Promise.resolve(
        members
          .filter((m) => playerOf(m).userId === userId)
          .map((m) => ({
            server: m.server,
            playerId: m.playerId,
            spaceId: m.spaceId,
            spaceName: spaces.get(m.spaceId)?.name ?? "",
            spaceTag: spaces.get(m.spaceId)?.tag ?? "",
            role: m.role,
            sealedFor: m.publicKey,
            resendNeeded: m.resendNeeded ?? false,
          })),
      ),
    requestsOf: (userId) =>
      Promise.resolve(
        requests
          .filter((r) => playerOf(r).userId === userId)
          .map((r) => ({
            server: r.server,
            playerId: r.playerId,
            spaceId: r.spaceId,
            spaceName: spaces.get(r.spaceId)?.name ?? "",
            status: r.status,
            createdAt: r.createdAt,
            decidedAt: r.decidedAt,
          })),
      ),
    inSpace: (spaceId, work) => work(transaction(spaceId)),
  };

  return {
    store,
    /** A Player declared by an account, with its alliance in the export. */
    addPlayer(userId: string, player: PlayerRef & { pseudo: string; alliance: string | null }) {
      players.push({ ...player, userId });
    },
    /** The Player's alliance in a newer export. */
    setAlliance(ref: PlayerRef, alliance: string | null) {
      playerOf(ref).alliance = alliance;
    },
    link(userId: string) {
      linked.add(userId);
    },
    deleteUser(userId: string) {
      const owned = players.filter((p) => p.userId === userId);
      members = members.filter((m) => !owned.some((p) => same(p, m)));
      requests = requests.filter((r) => !owned.some((p) => same(p, r)));
      keys.delete(userId);
    },
  };
}
