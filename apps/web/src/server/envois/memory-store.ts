// The Envois' store in memory, for the tests of the rules (envoi-service.test.ts). It follows the Prisma store
// (prisma-store.ts): one row per Joueur, category and fingerprint, rewritten only when its blob changes.
import type { EnvoiStore, ItemRow, KeyVersionInfo, PlayerRef, SpaceInfo } from "./store";

type Role = SpaceInfo["members"][number]["role"];

interface Space extends Omit<SpaceInfo, "members"> {
  members: (PlayerRef & { role?: Role })[];
}

export function memoryEnvoiStore() {
  const players: (PlayerRef & { pseudo: string; userId: string })[] = [];
  const spaces = new Map<string, Space>();
  const settings = new Map<string, string[]>();
  let rows: (ItemRow & { spaceId: string; expiresAt: Date })[] = [];
  let nextId = 1;

  const key = (p: PlayerRef) => `${p.server}:${String(p.playerId)}`;
  const same = (a: PlayerRef, b: PlayerRef) => a.server === b.server && a.playerId === b.playerId;

  const store: EnvoiStore = {
    playersOf: (userId) =>
      Promise.resolve(
        players
          .filter((p) => p.userId === userId)
          .map(({ server, playerId, pseudo }) => ({ server, playerId, pseudo })),
      ),
    spaceOf: (player) =>
      Promise.resolve([...spaces.values()].find((s) => s.members.some((m) => same(m, player)))?.id ?? null),
    space: (spaceId) => {
      const space = spaces.get(spaceId);
      if (!space) return Promise.resolve(null);
      return Promise.resolve({
        ...space,
        members: space.members.map((m) => {
          const player = players.find((p) => same(p, m));
          if (!player) throw new Error("Unknown player");
          return {
            server: m.server,
            playerId: m.playerId,
            role: m.role ?? "member",
            pseudo: player.pseudo,
            userId: player.userId,
            categories: settings.get(key(m)) ?? [],
          };
        }),
      });
    },
    settingsOf: (player) => Promise.resolve(settings.get(key(player)) ?? []),
    saveSettings: (player, categories) => {
      settings.set(key(player), [...categories]);
      return Promise.resolve();
    },
    writeItems: (spaceId, player, category, items, removed, now) => {
      rows = rows.filter(
        (r) =>
          r.expiresAt > now &&
          !(r.spaceId === spaceId && same(r, player) && r.category === category && removed.includes(r.fingerprint)),
      );
      for (const item of items) {
        const known = rows.find(
          (r) =>
            r.spaceId === spaceId && same(r, player) && r.category === category && r.fingerprint === item.fingerprint,
        );
        if (known) {
          if (known.blob !== item.blob || known.detail !== item.detail)
            Object.assign(known, { blob: item.blob, detail: item.detail, expiresAt: item.expiresAt, updatedAt: now });
          continue;
        }
        rows.push({
          id: String(nextId++),
          spaceId,
          server: player.server,
          playerId: player.playerId,
          category,
          fingerprint: item.fingerprint,
          blob: item.blob,
          detail: item.detail,
          expiresAt: item.expiresAt,
          updatedAt: now,
        });
      }
      return Promise.resolve();
    },
    forgetStates: (player, removed, withoutDetail, now) => {
      rows = rows.filter((r) => !(same(r, player) && removed.includes(r.category)));
      for (const r of rows)
        if (same(r, player) && withoutDetail.includes(r.category) && r.detail !== null)
          Object.assign(r, { detail: null, updatedAt: now });
      return Promise.resolve();
    },
    items: (spaceId, now, since) =>
      Promise.resolve(
        rows
          .filter((r) => r.spaceId === spaceId && r.expiresAt > now && (!since || r.updatedAt > since))
          .map((r) => ({
            id: r.id,
            server: r.server,
            playerId: r.playerId,
            category: r.category,
            fingerprint: r.fingerprint,
            blob: r.blob,
            detail: r.detail,
            updatedAt: r.updatedAt,
          })),
      ),
    liveIds: (spaceId, now) =>
      Promise.resolve(rows.filter((r) => r.spaceId === spaceId && r.expiresAt > now).map((r) => r.id)),
  };

  return {
    store,
    addPlayer(player: PlayerRef & { pseudo: string; userId: string }) {
      players.push(player);
    },
    addSpace(space: Omit<SpaceInfo, "members" | "versions"> & { versions?: KeyVersionInfo[] }, members: PlayerRef[]) {
      spaces.set(space.id, {
        ...space,
        versions: space.versions ?? [{ version: 1, createdAt: new Date(0), createdByPseudo: null }],
        members: [...members],
      });
    },
    addVersion(spaceId: string, version: KeyVersionInfo) {
      spaces.get(spaceId)?.versions.push(version);
    },
    setRole(spaceId: string, player: PlayerRef, role: Role) {
      const member = spaces.get(spaceId)?.members.find((m) => same(m, player));
      if (member) member.role = role;
    },
    removeMember(spaceId: string, player: PlayerRef) {
      const space = spaces.get(spaceId);
      if (space) space.members = space.members.filter((m) => !same(m, player));
    },
    /** As the account's deletion does: its Players, their settings and their rows go. */
    deleteUser(userId: string) {
      const gone = players.filter((p) => p.userId === userId);
      rows = rows.filter((r) => !gone.some((p) => same(p, r)));
      for (const p of gone) {
        settings.delete(key(p));
        for (const space of spaces.values()) space.members = space.members.filter((m) => !same(m, p));
        players.splice(players.indexOf(p), 1);
      }
    },
    rows: () => rows,
  };
}
