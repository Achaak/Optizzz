// The Demandes' store in memory, for the tests of the rules (demande-service.test.ts). It follows the Prisma store
// (prisma-store.ts); the spaces and their members come from the Envois' store in memory.
import { memoryEnvoiStore } from "~/server/envois/memory-store";
import type { DemandeRow, DemandeStore } from "./store";

export function memoryDemandeStore() {
  const envois = memoryEnvoiStore();
  let rows: (DemandeRow & { expiresAt: Date | null })[] = [];
  const alive = (now: Date) => (r: { expiresAt: Date | null }) => r.expiresAt === null || r.expiresAt > now;
  const copy = (row: DemandeRow & { expiresAt: Date | null }): DemandeRow =>
    Object.fromEntries(Object.entries(row).filter(([field]) => field !== "expiresAt")) as unknown as DemandeRow;

  const store: DemandeStore = {
    playersOf: (userId) => envois.store.playersOf(userId),
    spaceOf: (player) => envois.store.spaceOf(player),
    space: (spaceId) => envois.store.space(spaceId),
    settingsOf: (player) => envois.store.settingsOf(player),
    demandes: (spaceId, now) =>
      Promise.resolve(
        rows
          .filter((r) => r.spaceId === spaceId && alive(now)(r))
          .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
          .map(copy),
      ),
    demande: (id, now) => {
      const row = rows.find((r) => r.id === id && alive(now)(r));
      return Promise.resolve(row ? copy(row) : null);
    },
    create: (row, now) => {
      rows = rows.filter((r) => r.spaceId !== row.spaceId || alive(now)(r));
      if (rows.some((r) => r.id === row.id)) return Promise.resolve(false);
      const mine = rows.filter((r) => r.server === row.server && r.playerId === row.playerId);
      rows.push({
        ...row,
        rank: Math.max(-1, ...mine.map((r) => r.rank)) + 1,
        createdAt: now,
        updatedAt: now,
        expiresAt: null,
      });
      return Promise.resolve(true);
    },
    change: (id, from, change, now) => {
      const row = rows.find((r) => r.id === id);
      if (!row || !from.includes(row.status)) return Promise.resolve(false);
      Object.assign(row, change, { updatedAt: now });
      return Promise.resolve(true);
    },
    reorder: (ids, now) => {
      ids.forEach((id, rank) => {
        const row = rows.find((r) => r.id === id);
        if (row && row.rank !== rank) Object.assign(row, { rank, updatedAt: now });
      });
      return Promise.resolve();
    },
  };

  return {
    ...envois,
    store,
    /** What a Joueur sends, as their extension said. */
    saveSettings: (player: { server: string; playerId: number }, categories: string[]) =>
      envois.store.saveSettings(player, categories),
    demandeRows: () => rows,
  };
}
