// The Alliance Spaces' store on the site's database: it writes in the « accounts » schema only, and reads the public
// export's players for their alliance (docs/adr/0008). Every operation on a space runs in a transaction that first
// locks the space's row: two Admins acting at once are served one after the other (never zero Admins left).
import type { Prisma, PrismaClient } from "~/generated/prisma/client";
import type { MemberRow, PlayerRef, RequestRow, SpaceStore, SpaceSummary, SpaceTransaction } from "./store";

type Db = PrismaClient | Prisma.TransactionClient;

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

const memberKey = (spaceId: string, player: PlayerRef) => ({
  spaceId_server_playerId: { spaceId, server: player.server, playerId: player.playerId },
});

const PLAYER_WITH_KEY = {
  select: { pseudo: true, userId: true, user: { select: { personalKey: { select: { publicKey: true } } } } },
} as const;

async function summaries(db: Db, where: Prisma.SpaceWhereInput): Promise<SpaceSummary[]> {
  const spaces = await db.space.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { members: { select: { role: true, player: { select: { pseudo: true } } } } },
  });
  return spaces.map(({ members, ...space }) => ({
    ...space,
    admins: members.filter((m) => m.role === "admin").map((m) => m.player.pseudo),
    memberCount: members.length,
  }));
}

function transaction(tx: Prisma.TransactionClient, spaceId: string): SpaceTransaction {
  return {
    space: () => tx.space.findUnique({ where: { id: spaceId } }),
    async members() {
      const rows = await tx.spaceMember.findMany({
        where: { spaceId },
        orderBy: [{ joinedAt: "asc" }, { playerId: "asc" }],
        include: { player: PLAYER_WITH_KEY, sealedKeys: { select: { version: true }, orderBy: { version: "asc" } } },
      });
      return rows.map((m): MemberRow => ({
        server: m.server,
        playerId: m.playerId,
        pseudo: m.player.pseudo,
        userId: m.player.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        sealedFor: m.publicKey,
        currentKey: m.player.user.personalKey?.publicKey ?? null,
        versions: m.sealedKeys.map((k) => k.version),
      }));
    },
    async requests() {
      const rows = await tx.joinRequest.findMany({
        where: { spaceId },
        orderBy: { createdAt: "asc" },
        include: { player: PLAYER_WITH_KEY },
      });
      return rows.map((r): RequestRow => ({
        id: r.id,
        server: r.server,
        playerId: r.playerId,
        pseudo: r.player.pseudo,
        userId: r.player.userId,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        currentKey: r.player.user.personalKey?.publicKey ?? null,
      }));
    },
    async versions() {
      const rows = await tx.allianceKeyVersion.findMany({
        where: { spaceId },
        select: { version: true },
        orderBy: { version: "asc" },
      });
      return rows.map((r) => r.version);
    },
    sealedFor: (player) =>
      tx.sealedAllianceKey.findMany({
        where: { spaceId, server: player.server, playerId: player.playerId },
        select: { version: true, sealed: true },
        orderBy: { version: "asc" },
      }),
    async certificates() {
      const rows = await tx.spaceCertificate.findMany({ where: { spaceId }, orderBy: { createdAt: "asc" } });
      return rows.map((r) => r.blob);
    },
    async spaceOfPlayer(player) {
      const row = await tx.spaceMember.findUnique({
        where: { server_playerId: { server: player.server, playerId: player.playerId } },
        select: { spaceId: true },
      });
      return row?.spaceId ?? null;
    },
    async addMember(member, sealed) {
      await tx.spaceMember.create({
        data: {
          spaceId,
          server: member.server,
          playerId: member.playerId,
          role: member.role,
          publicKey: member.publicKey,
          sealedKeys: { create: sealed.map((s) => ({ version: s.version, sealed: s.sealed })) },
        },
      });
    },
    async sealFor(player, publicKey, sealed) {
      await tx.sealedAllianceKey.deleteMany({ where: { spaceId, server: player.server, playerId: player.playerId } });
      await tx.spaceMember.update({
        where: memberKey(spaceId, player),
        data: { publicKey, sealedKeys: { create: sealed.map((s) => ({ version: s.version, sealed: s.sealed })) } },
      });
    },
    async addVersion(version) {
      // ON CONFLICT DO NOTHING: a version already there is told, without aborting the transaction.
      const { count } = await tx.allianceKeyVersion.createMany({ data: [{ spaceId, version }], skipDuplicates: true });
      return count === 1 ? "added" : "taken";
    },
    absenceAlerts: () =>
      tx.spaceAbsenceAlerts.findUnique({ where: { spaceId }, select: { blob: true, revision: true } }),
    async saveAbsenceAlerts(blob, expectedRevision) {
      if (expectedRevision === 0) {
        const created = await tx.spaceAbsenceAlerts.createMany({
          data: [{ spaceId, blob, revision: 1 }],
          skipDuplicates: true,
        });
        return created.count === 1 ? 1 : null;
      }
      const { count } = await tx.spaceAbsenceAlerts.updateMany({
        where: { spaceId, revision: expectedRevision },
        data: { blob, revision: { increment: 1 } },
      });
      return count === 1 ? expectedRevision + 1 : null;
    },
    async setRole(player, role) {
      await tx.spaceMember.update({ where: memberKey(spaceId, player), data: { role } });
    },
    async removeMember(player) {
      await tx.spaceMember.delete({ where: memberKey(spaceId, player) });
    },
    async addCertificates(blobs) {
      await tx.spaceCertificate.createMany({ data: blobs.map((blob) => ({ spaceId, blob })), skipDuplicates: true });
    },
    async putRequest(player, at) {
      await tx.joinRequest.upsert({
        where: { spaceId_server_playerId: { spaceId, server: player.server, playerId: player.playerId } },
        create: { spaceId, server: player.server, playerId: player.playerId, createdAt: at },
        update: { status: "pending", createdAt: at, decidedAt: null },
      });
    },
    async deleteRequest(id) {
      await tx.joinRequest.deleteMany({ where: { id, spaceId } });
    },
    async refuseRequest(id, at) {
      await tx.joinRequest.updateMany({ where: { id, spaceId }, data: { status: "refused", decidedAt: at } });
    },
    async rename(name) {
      await tx.space.update({ where: { id: spaceId }, data: { name } });
    },
    async deleteSpace() {
      await tx.space.delete({ where: { id: spaceId } });
    },
  };
}

export function prismaSpaceStore(db: PrismaClient): SpaceStore {
  return {
    key: (userId) =>
      db.personalKey.findUnique({
        where: { userId },
        select: { publicKey: true, lockedPrivateKey: true, trustList: true, trustListRevision: true },
      }),
    async createKey(userId, publicKey, lockedPrivateKey) {
      try {
        await db.personalKey.create({ data: { userId, publicKey, lockedPrivateKey } });
        return "created";
      } catch (error) {
        if (isUniqueViolation(error)) return "exists";
        throw error;
      }
    },
    async relockKey(userId, publicKey, lockedPrivateKey) {
      const { count } = await db.personalKey.updateMany({ where: { userId, publicKey }, data: { lockedPrivateKey } });
      return count === 1;
    },
    async resetKey(userId, publicKey, lockedPrivateKey) {
      await db.$transaction(async (tx) => {
        await tx.personalKey.update({
          where: { userId },
          data: { publicKey, lockedPrivateKey, trustList: null, trustListRevision: { increment: 1 } },
        });
        // Every membership of the account: « clé à renvoyer » (the old key stays on the row, for a revocation).
        await tx.sealedAllianceKey.deleteMany({ where: { member: { player: { userId } } } });
      });
    },
    async saveTrustList(userId, trustList, expectedRevision) {
      const { count } = await db.personalKey.updateMany({
        where: { userId, trustListRevision: expectedRevision },
        data: { trustList, trustListRevision: { increment: 1 } },
      });
      return count === 1 ? expectedRevision + 1 : null;
    },
    playersOf: (userId) =>
      db.declaredPlayer.findMany({
        where: { userId },
        select: { server: true, playerId: true, pseudo: true },
        orderBy: [{ server: "asc" }, { pseudo: "asc" }],
      }),
    async exportAlliance(player) {
      const row = await db.player.findUnique({
        where: { server_id: { server: player.server, id: player.playerId } },
        select: { alliance: true },
      });
      return row ? (row.alliance ?? null) : undefined;
    },
    async extensionLinked(userId) {
      return (await db.extensionToken.count({ where: { userId } })) > 0;
    },
    async createSpace(space, creator, sealed) {
      try {
        await db.space.create({
          data: {
            ...space,
            keyVersions: { create: { version: 1 } },
            members: {
              create: {
                server: creator.server,
                playerId: creator.playerId,
                role: "admin",
                publicKey: creator.publicKey,
                sealedKeys: { create: sealed.map((s) => ({ version: s.version, sealed: s.sealed })) },
              },
            },
          },
        });
        return "created";
      } catch (error) {
        if (isUniqueViolation(error)) return "taken";
        throw error;
      }
    },
    async spaceSummary(spaceId) {
      return (await summaries(db, { id: spaceId }))[0] ?? null;
    },
    spacesOfAlliance: (server, tag) => summaries(db, { server, tag: { equals: tag, mode: "insensitive" } }),
    async membershipsOf(userId) {
      const rows = await db.spaceMember.findMany({
        where: { player: { userId } },
        include: { space: { select: { name: true, tag: true } } },
      });
      return rows.map((m) => ({
        server: m.server,
        playerId: m.playerId,
        spaceId: m.spaceId,
        spaceName: m.space.name,
        spaceTag: m.space.tag,
        role: m.role,
        sealedFor: m.publicKey,
      }));
    },
    async requestsOf(userId) {
      const rows = await db.joinRequest.findMany({
        where: { player: { userId } },
        include: { space: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({
        server: r.server,
        playerId: r.playerId,
        spaceId: r.spaceId,
        spaceName: r.space.name,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
      }));
    },
    inSpace: (spaceId, work) =>
      db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM accounts.space WHERE id = ${spaceId} FOR UPDATE`;
        return work(transaction(tx, spaceId));
      }),
  };
}

/** For an account's deletion: each space where it is an Admin, with its numbers of Admins and members. */
export async function adminMemberships(db: PrismaClient, userId: string) {
  const rows = await db.spaceMember.findMany({
    where: { player: { userId }, role: "admin" },
    include: { space: { include: { members: { select: { role: true } } } } },
  });
  return rows.map((m) => ({
    spaceName: m.space.name,
    role: m.role,
    admins: m.space.members.filter((x) => x.role === "admin").length,
    members: m.space.members.length,
  }));
}

/** Spaces where the account's Players are the only members: they go with the account. */
export async function deleteLonelySpaces(db: PrismaClient, userId: string): Promise<void> {
  await db.space.deleteMany({ where: { members: { some: { player: { userId } }, every: { player: { userId } } } } });
}
