// The Demandes' store on the site's database: it writes in the « accounts » schema only (docs/adr/0008). Who is in a
// space, with which role and what they send, is read as the Envois read it.
import type { PrismaClient } from "~/generated/prisma/client";
import { prismaEnvoiStore } from "~/server/envois/prisma-store";
import type { DemandeStore } from "./store";

const SELECT = {
  id: true,
  spaceId: true,
  server: true,
  playerId: true,
  status: true,
  rank: true,
  blob: true,
  keyVersion: true,
  createdAt: true,
  updatedAt: true,
  decidedAt: true,
  decidedByPseudo: true,
  endedAt: true,
} as const;

const notExpired = (now: Date) => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

export function prismaDemandeStore(db: PrismaClient): DemandeStore {
  const envois = prismaEnvoiStore(db);
  return {
    playersOf: (userId) => envois.playersOf(userId),
    spaceOf: (player) => envois.spaceOf(player),
    space: (spaceId) => envois.space(spaceId),
    settingsOf: (player) => envois.settingsOf(player),
    demandes: (spaceId, now) =>
      db.demande.findMany({
        where: { spaceId, ...notExpired(now) },
        select: SELECT,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      }),
    demande: (id, now) => db.demande.findFirst({ where: { id, ...notExpired(now) }, select: SELECT }),
    async create(row, now) {
      return db.$transaction(async (tx) => {
        await tx.demande.deleteMany({ where: { spaceId: row.spaceId, expiresAt: { lte: now } } });
        if (await tx.demande.findUnique({ where: { id: row.id }, select: { id: true } })) return false;
        const last = await tx.demande.aggregate({
          where: { server: row.server, playerId: row.playerId },
          _max: { rank: true },
        });
        await tx.demande.create({
          data: { ...row, rank: (last._max.rank ?? -1) + 1, createdAt: now, updatedAt: now },
        });
        return true;
      });
    },
    async change(id, from, change, now) {
      // Only while its status is still one of `from`: two validators at once, the second changes nothing.
      const { count } = await db.demande.updateMany({
        where: { id, status: { in: [...from] } },
        data: { ...change, updatedAt: now },
      });
      return count === 1;
    },
    async reorder(ids, now) {
      await db.$transaction(
        ids.map((id, rank) =>
          db.demande.updateMany({ where: { id, rank: { not: rank } }, data: { rank, updatedAt: now } }),
        ),
      );
    },
  };
}
