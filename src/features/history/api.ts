// History of the players' scores, from the public exports — see docs/features/historique.md.
import { storage } from "wxt/utils/storage";
import { z } from "zod";
import { getJson, playerSchema } from "@/features/alliance-map/api";

export interface Scores {
  /** Hunting field (TDC), cm². */
  field: number;
  building: number;
  technology: number;
  /** « Combat » on the profile page. */
  trophy: number;
}

/** Every player's scores in one export. */
export interface Snapshot {
  /** UTC date of the export, AAAAMMJJHHmm. */
  version: string;
  /** By player id. */
  players: Map<number, Scores>;
}

/** What is stored per version: all the players in columns, ~25 KB on S5, ~500 KB on S2. */
interface StoredSnapshot {
  ids: number[];
  field: number[];
  building: number[];
  technology: number[];
  trophy: number[];
}

const cacheKey = (origin: string, version: string) => `local:history:${new URL(origin).host}:${version}` as const;

const historyPlayerSchema = playerSchema.pick({
  id: true,
  field: true,
  buildingScore: true,
  technologyScore: true,
  trophyScore: true,
});

function toStored(players: z.infer<typeof historyPlayerSchema>[]): StoredSnapshot {
  return {
    ids: players.map((player) => player.id),
    field: players.map((player) => player.field),
    building: players.map((player) => player.buildingScore),
    technology: players.map((player) => player.technologyScore),
    trophy: players.map((player) => player.trophyScore),
  };
}

function fromStored(version: string, stored: StoredSnapshot): Snapshot {
  const players = new Map<number, Scores>();
  stored.ids.forEach((id, i) => {
    players.set(id, {
      field: stored.field[i] ?? 0,
      building: stored.building[i] ?? 0,
      technology: stored.technology[i] ?? 0,
      trophy: stored.trophy[i] ?? 0,
    });
  });
  return { version, players };
}

/** One version, from the cache or downloaded then cached: a published version never changes. */
async function loadSnapshot(origin: string, version: string): Promise<Snapshot> {
  const key = cacheKey(origin, version);
  const cached = await storage.getItem<StoredSnapshot>(key);
  if (cached) return fromStored(version, cached);

  const players = z
    .array(historyPlayerSchema)
    .parse(await getJson(`${origin}/api/exports/players/?version=${version}`));
  const stored = toStored(players);
  try {
    await storage.setItem(key, stored);
  } catch (error) {
    console.warn(`[Optizzz] could not cache the players export ${version}`, error);
  }
  return fromStored(version, stored);
}

/**
 * The scores of every player at each of `versions`, in the same order. Loaded latest first,
 * one at a time, with `onProgress` called after each; a version the API cannot give is skipped.
 */
export async function loadHistory(
  origin: string,
  versions: readonly string[],
  onProgress?: (snapshots: Snapshot[]) => void,
): Promise<Snapshot[]> {
  const loaded = new Map<string, Snapshot>();
  const inOrder = () => versions.flatMap((version) => loaded.get(version) ?? []);
  for (const version of [...versions].reverse()) {
    try {
      loaded.set(version, await loadSnapshot(origin, version));
    } catch (error) {
      console.warn(`[Optizzz] players export ${version} unavailable`, error);
      continue;
    }
    onProgress?.(inOrder());
  }
  return inOrder();
}
