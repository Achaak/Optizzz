// History of the alliances' totals, from the public exports — see docs/features/statistiques-alliance.md.
import { z } from "zod";
import { cachedVersion, loadEachVersion } from "@/data/export-history";
import { getJson } from "@/data/exports";
import { allianceSchema } from "@optizzz/game/exports";
import type { AllianceScores } from "@optizzz/game/pages/alliance-ranking";

/** Every alliance's totals in one export. */
export interface AllianceSnapshot {
  /** UTC date of the export, AAAAMMJJHHmm. */
  version: string;
  /** By tag, as the export writes it. */
  alliances: Map<string, AllianceScores>;
}

/** What is stored per version: all the alliances in columns. */
interface StoredSnapshot {
  tags: string[];
  members: number[];
  field: number[];
  building: number[];
  technology: number[];
  trophy: number[];
}

const cacheKey = (origin: string, version: string) =>
  `local:alliance-stats:${new URL(origin).host}:${version}` as const;

const historyAllianceSchema = allianceSchema.pick({
  tag: true,
  playersCount: true,
  totalField: true,
  totalBuildingScore: true,
  totalTechnologyScore: true,
  totalTrophyScore: true,
});

function toStored(alliances: z.infer<typeof historyAllianceSchema>[]): StoredSnapshot {
  return {
    tags: alliances.map((alliance) => alliance.tag),
    members: alliances.map((alliance) => alliance.playersCount),
    field: alliances.map((alliance) => alliance.totalField),
    building: alliances.map((alliance) => alliance.totalBuildingScore),
    technology: alliances.map((alliance) => alliance.totalTechnologyScore),
    trophy: alliances.map((alliance) => alliance.totalTrophyScore),
  };
}

function fromStored(version: string, stored: StoredSnapshot): AllianceSnapshot {
  const alliances = new Map<string, AllianceScores>();
  stored.tags.forEach((tag, i) => {
    alliances.set(tag, {
      members: stored.members[i] ?? 0,
      field: stored.field[i] ?? 0,
      building: stored.building[i] ?? 0,
      technology: stored.technology[i] ?? 0,
      trophy: stored.trophy[i] ?? 0,
    });
  });
  return { version, alliances };
}

async function loadSnapshot(origin: string, version: string): Promise<AllianceSnapshot> {
  const stored = await cachedVersion(cacheKey(origin, version), async () =>
    toStored(
      z.array(historyAllianceSchema).parse(await getJson(`${origin}/api/exports/alliances/?version=${version}`)),
    ),
  );
  return fromStored(version, stored);
}

/** The totals of every alliance at each of `versions`, in the same order, loaded latest first. */
export function loadAllianceHistory(
  origin: string,
  versions: readonly string[],
  onProgress?: (snapshots: AllianceSnapshot[]) => void,
  signal?: AbortSignal,
): Promise<AllianceSnapshot[]> {
  return loadEachVersion(versions, (version) => loadSnapshot(origin, version), onProgress, signal);
}
