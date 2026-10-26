// The reminders' store on Postgres (accounts.space_reminders and accounts.space_reminder_sent).
import type { PrismaClient } from "~/generated/prisma/client";
import type { ReminderStore } from "./store";

export function prismaReminderStore(db: PrismaClient): ReminderStore {
  return {
    async roleOf(spaceId, userId) {
      const member = await db.spaceMember.findFirst({
        where: { spaceId, player: { userId } },
        select: { role: true },
        // An account with two Players in one space cannot happen (one Player per server, a space on one server).
      });
      return member?.role ?? null;
    },
    async spaceName(spaceId) {
      return (await db.space.findUnique({ where: { id: spaceId }, select: { name: true } }))?.name ?? null;
    },
    async reminders(spaceId) {
      const row = await db.spaceReminders.findUnique({ where: { spaceId } });
      if (!row) return null;
      return {
        sealedUrl: row.sealedUrl,
        kinds: row.kinds,
        suspension:
          row.suspendedStatus !== null && row.suspendedAt !== null
            ? { status: row.suspendedStatus, at: row.suspendedAt }
            : null,
      };
    },
    async saveReminders(spaceId, sealedUrl, kinds) {
      const data = { sealedUrl, kinds, suspendedStatus: null, suspendedAt: null };
      await db.spaceReminders.upsert({ where: { spaceId }, create: { spaceId, ...data }, update: data });
    },
    async saveKinds(spaceId, kinds) {
      const { count } = await db.spaceReminders.updateMany({ where: { spaceId }, data: { kinds } });
      return count === 1;
    },
    async removeReminders(spaceId) {
      await db.spaceReminders.deleteMany({ where: { spaceId } });
    },
    async claim(spaceId, kind, now, notAfter) {
      // One statement: the first of two events at once inserts or moves the date, the second changes nothing.
      const count = await db.$executeRaw`
        INSERT INTO "accounts"."space_reminder_sent" ("spaceId", "kind", "sentAt") VALUES (${spaceId}, ${kind}, ${now})
        ON CONFLICT ("spaceId", "kind") DO UPDATE SET "sentAt" = EXCLUDED."sentAt"
        WHERE "space_reminder_sent"."sentAt" <= ${notAfter}`;
      return count === 1;
    },
    async suspend(spaceId, sealedUrl, status, at) {
      await db.spaceReminders.updateMany({
        where: { spaceId, sealedUrl },
        data: { suspendedStatus: status, suspendedAt: at },
      });
    },
  };
}
