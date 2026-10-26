// The reminders' store in memory, for the tests of the rules (reminder-service.test.ts). It follows prisma-store.ts.
import type { SpaceRole } from "~/server/spaces/store";
import type { ReminderStore, RemindersRow } from "./store";

export function memoryReminderStore() {
  const roles = new Map<string, SpaceRole>();
  const names = new Map<string, string>();
  const rows = new Map<string, RemindersRow>();
  const sent = new Map<string, Date>();

  const store: ReminderStore = {
    roleOf: (spaceId, userId) => Promise.resolve(roles.get(`${spaceId}|${userId}`) ?? null),
    spaceName: (spaceId) => Promise.resolve(names.get(spaceId) ?? null),
    reminders: (spaceId) => {
      const row = rows.get(spaceId);
      return Promise.resolve(row ? { ...row, kinds: [...row.kinds] } : null);
    },
    saveReminders: (spaceId, sealedUrl, kinds) => {
      rows.set(spaceId, { sealedUrl, kinds: [...kinds], suspension: null });
      return Promise.resolve();
    },
    saveKinds: (spaceId, kinds) => {
      const row = rows.get(spaceId);
      if (row) row.kinds = [...kinds];
      return Promise.resolve(row !== undefined);
    },
    removeReminders: (spaceId) => {
      rows.delete(spaceId);
      return Promise.resolve();
    },
    claim: (spaceId, kind, now, notAfter) => {
      const key = `${spaceId}|${kind}`;
      const last = sent.get(key);
      if (last && last > notAfter) return Promise.resolve(false);
      sent.set(key, now);
      return Promise.resolve(true);
    },
    suspend: (spaceId, sealedUrl, status, at) => {
      const row = rows.get(spaceId);
      if (row?.sealedUrl === sealedUrl) row.suspension = { status, at };
      return Promise.resolve();
    },
  };

  return {
    store,
    addSpace(spaceId: string, name: string, members: Record<string, SpaceRole>) {
      names.set(spaceId, name);
      for (const [userId, role] of Object.entries(members)) roles.set(`${spaceId}|${userId}`, role);
    },
    row: (spaceId: string) => rows.get(spaceId),
  };
}
