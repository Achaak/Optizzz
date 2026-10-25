// The Envois' store on the site's database: it writes in the « accounts » schema only (docs/adr/0008).
import type { PrismaClient } from "~/generated/prisma/client";
import type { EnvoiStore } from "./store";

const playerKey = (p: { server: string; playerId: number }) => ({
  server_playerId: { server: p.server, playerId: p.playerId },
});

export function prismaEnvoiStore(db: PrismaClient): EnvoiStore {
  return {
    playersOf: (userId) =>
      db.declaredPlayer.findMany({
        where: { userId },
        select: { server: true, playerId: true, pseudo: true },
        orderBy: [{ server: "asc" }, { pseudo: "asc" }],
      }),
    async spaceOf(player) {
      const row = await db.spaceMember.findUnique({ where: playerKey(player), select: { spaceId: true } });
      return row?.spaceId ?? null;
    },
    async space(spaceId) {
      const space = await db.space.findUnique({
        where: { id: spaceId },
        include: {
          keyVersions: { orderBy: { version: "asc" } },
          members: {
            orderBy: [{ joinedAt: "asc" }, { playerId: "asc" }],
            include: {
              player: { select: { pseudo: true, userId: true, envoiSettings: { select: { categories: true } } } },
            },
          },
        },
      });
      if (!space) return null;
      return {
        id: space.id,
        server: space.server,
        tag: space.tag,
        name: space.name,
        versions: space.keyVersions.map((v) => ({
          version: v.version,
          createdAt: v.createdAt,
          createdByPseudo: v.createdByPseudo,
        })),
        members: space.members.map((m) => ({
          server: m.server,
          playerId: m.playerId,
          pseudo: m.player.pseudo,
          userId: m.player.userId,
          categories: m.player.envoiSettings?.categories ?? [],
        })),
      };
    },
    async settingsOf(player) {
      const row = await db.envoiSettings.findUnique({ where: playerKey(player), select: { categories: true } });
      return row?.categories ?? [];
    },
    async saveSettings(player, categories) {
      await db.envoiSettings.upsert({
        where: playerKey(player),
        create: { server: player.server, playerId: player.playerId, categories },
        update: { categories },
      });
    },
    async writeItems(spaceId, player, category, items, removed, now) {
      const mine = { spaceId, server: player.server, playerId: player.playerId, category };
      await db.$transaction(async (tx) => {
        await tx.envoiItem.deleteMany({ where: { spaceId, expiresAt: { lte: now } } });
        if (removed.length > 0) await tx.envoiItem.deleteMany({ where: { ...mine, fingerprint: { in: removed } } });
        if (items.length === 0) return;
        const known = new Map(
          (
            await tx.envoiItem.findMany({
              where: { ...mine, fingerprint: { in: items.map((i) => i.fingerprint) } },
              select: { fingerprint: true, blob: true },
            })
          ).map((r) => [r.fingerprint, r.blob]),
        );
        const added = items.filter((i) => !known.has(i.fingerprint));
        // Two Envois of the same Joueur at once: the second insert of a fingerprint is skipped, not an error.
        if (added.length > 0)
          await tx.envoiItem.createMany({
            data: added.map((i) => ({ ...mine, ...i, updatedAt: now })),
            skipDuplicates: true,
          });
        for (const item of items) {
          const blob = known.get(item.fingerprint);
          if (blob === undefined || blob === item.blob) continue;
          await tx.envoiItem.updateMany({
            where: { ...mine, fingerprint: item.fingerprint },
            data: { blob: item.blob, keyVersion: item.keyVersion, expiresAt: item.expiresAt, updatedAt: now },
          });
        }
      });
    },
    items: (spaceId, now, since) =>
      db.envoiItem.findMany({
        where: { spaceId, expiresAt: { gt: now }, ...(since && { updatedAt: { gt: since } }) },
        select: {
          id: true,
          server: true,
          playerId: true,
          category: true,
          fingerprint: true,
          blob: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      }),
    async liveIds(spaceId, now) {
      const rows = await db.envoiItem.findMany({ where: { spaceId, expiresAt: { gt: now } }, select: { id: true } });
      return rows.map((r) => r.id);
    },
  };
}
