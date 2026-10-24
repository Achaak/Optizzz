// The extension API's store on the site's database: it writes in the « accounts » schema only, and reads the public
// export's players (docs/adr/0008).
import type { PrismaClient } from "~/generated/prisma/client";
import type { ExtensionStore } from "./extension-api";

/** Prisma's error for a unique constraint: two declarations of the same Player at the same moment. */
const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

export function prismaExtensionStore(db: PrismaClient): ExtensionStore {
  return {
    async createToken(userId, tokenHash, browser) {
      await db.extensionToken.create({ data: { userId, tokenHash, browser } });
    },
    async userOfToken(tokenHash) {
      return (await db.extensionToken.findUnique({ where: { tokenHash }, select: { userId: true } }))?.userId ?? null;
    },
    async deleteToken(tokenHash) {
      await db.extensionToken.deleteMany({ where: { tokenHash } });
    },
    playersOf(userId) {
      return db.declaredPlayer.findMany({
        where: { userId },
        select: { server: true, playerId: true, pseudo: true, declaredAt: true },
        orderBy: [{ server: "asc" }, { pseudo: "asc" }],
      });
    },
    exportPlayer(server, pseudo) {
      return db.player.findFirst({ where: { server, pseudo }, select: { id: true, pseudo: true } });
    },
    async declarePlayer(userId, { server, playerId, pseudo }) {
      const owner = async () =>
        (await db.declaredPlayer.findUnique({ where: { server_playerId: { server, playerId } } }))?.userId;
      const current = await owner();
      if (current) return current === userId ? "mine" : "taken";
      try {
        await db.declaredPlayer.create({ data: { userId, server, playerId, pseudo } });
        return "declared";
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        return (await owner()) === userId ? "mine" : "taken";
      }
    },
  };
}
