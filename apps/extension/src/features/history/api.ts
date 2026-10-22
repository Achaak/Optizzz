// History of the players' scores, from the public exports — see docs/features/historique.md.
import { z } from "zod";
import { cachedVersion, loadEachVersion } from "@/data/export-history";
import { getJson } from "@/data/exports";
import { playerSchema } from "@optizzz/game/exports";
import type { Scores } from "@optizzz/game/pages/scores";

/** Every player's scores in one export. */
export interface Snapshot {
  /** UTC date of the export, AAAAMMJJHHmm. */
  version: string;
  /** By player id. */
  players: Map<number, Scores>;
  /** Alliance tag of each player, null without one. */
  alliances: Map<number, string | null>;
}

/** What is stored per version: all the players in columns, ~30 KB on S5, ~600 KB on S2. */
interface StoredSnapshot {
  ids: number[];
  field: number[];
  building: number[];
  technology: number[];
  trophy: number[];
  /** Each alliance tag once; missing from the versions stored before the alliances were kept. */
  tags?: string[];
  /** Index in `tags` of each player's alliance, -1 without one. */
  alliance?: number[];
}

const cacheKey = (origin: string, version: string) => `local:history:${new URL(origin).host}:${version}` as const;

const historyPlayerSchema = playerSchema.pick({
  id: true,
  field: true,
  buildingScore: true,
  technologyScore: true,
  trophyScore: true,
  alliance: true,
});

function toStored(players: z.infer<typeof historyPlayerSchema>[]): StoredSnapshot {
  const tags = [...new Set(players.flatMap((player) => (player.alliance ? [player.alliance] : [])))];
  const tagIndex = new Map(tags.map((tag, i) => [tag, i]));
  return {
    ids: players.map((player) => player.id),
    field: players.map((player) => player.field),
    building: players.map((player) => player.buildingScore),
    technology: players.map((player) => player.technologyScore),
    trophy: players.map((player) => player.trophyScore),
    tags,
    alliance: players.map((player) => (player.alliance ? (tagIndex.get(player.alliance) ?? -1) : -1)),
  };
}

function fromStored(version: string, stored: StoredSnapshot): Snapshot {
  const players = new Map<number, Scores>();
  const alliances = new Map<number, string | null>();
  stored.ids.forEach((id, i) => {
    alliances.set(id, stored.tags?.[stored.alliance?.[i] ?? -1] ?? null);
    players.set(id, {
      field: stored.field[i] ?? 0,
      building: stored.building[i] ?? 0,
      technology: stored.technology[i] ?? 0,
      trophy: stored.trophy[i] ?? 0,
    });
  });
  return { version, players, alliances };
}

/** One version, from the cache or downloaded then cached. */
async function loadSnapshot(origin: string, version: string): Promise<Snapshot> {
  const stored = await cachedVersion(
    cacheKey(origin, version),
    async () =>
      toStored(z.array(historyPlayerSchema).parse(await getJson(`${origin}/api/exports/players/?version=${version}`))),
    (cached: StoredSnapshot) => cached.tags !== undefined,
  );
  return fromStored(version, stored);
}

/**
 * The scores of every player at each of `versions`, in the same order, loaded latest first (see `loadEachVersion`).
 */
export function loadHistory(
  origin: string,
  versions: readonly string[],
  onProgress?: (snapshots: Snapshot[]) => void,
  signal?: AbortSignal,
): Promise<Snapshot[]> {
  return loadEachVersion(versions, (version) => loadSnapshot(origin, version), onProgress, signal);
}
