// Client for the public exports API — see docs/research/fourmizzz-api-exports.md.
import { storage } from "wxt/utils/storage";
import { z } from "zod";

// No `new Function` probing: extension pages forbid eval, and store reviewers flag it.
z.config({ jitless: true });

export const playerSchema = z.object({
  id: z.number().int(),
  pseudo: z.string(),
  alliance: z.string().nullable(),
  masterPlayerId: z.number().int().nullable(),
  x: z.number().int(),
  y: z.number().int(),
  field: z.number(),
  grade: z.string().nullable(),
  buildingScore: z.number(),
  technologyScore: z.number(),
  trophyScore: z.number(),
  onHoliday: z.boolean(),
  isBanned: z.boolean(),
});

export type Player = z.infer<typeof playerSchema>;

const allianceSchema = z.object({
  tag: z.string(),
  name: z.string(),
  playersCount: z.number().int(),
  totalField: z.number(),
  totalBuildingScore: z.number(),
  totalTechnologyScore: z.number(),
  totalTrophyScore: z.number(),
  diplomacy: z.object({
    /** `name` is the kind of pact (« PNA », « Total »), not an alliance name. */
    pacts: z.array(z.object({ tag: z.string(), name: z.string(), description: z.string() })),
    wars: z.array(z.string()),
  }),
});

export type Alliance = z.infer<typeof allianceSchema>;

const versionsSchema = z.object({ players: z.array(z.string()), alliances: z.array(z.string()) });

export interface PlayersExport {
  /** UTC date of the export, AAAAMMJJHHmm. */
  version: string;
  players: Player[];
}

export interface AlliancesExport {
  /** UTC date of the export, AAAAMMJJHHmm. */
  version: string;
  alliances: Alliance[];
}

type Kind = "players" | "alliances";

const cacheKey = (origin: string, kind: Kind) => `local:allianceMap:${new URL(origin).host}:${kind}Export` as const;

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fourmizzz API: ${response.status} on ${url}`);
  return response.json();
}

type Versions = z.infer<typeof versionsSchema>;

/** Requests of the versions list under way: views asking at the same time share one. */
const versionsRequests = new Map<string, Promise<Versions>>();

function loadVersions(origin: string): Promise<Versions> {
  let request = versionsRequests.get(origin);
  if (!request) {
    request = getJson(`${origin}/api/exports/`)
      .then((json) => versionsSchema.parse(json))
      .finally(() => versionsRequests.delete(origin));
    versionsRequests.set(origin, request);
  }
  return request;
}

/**
 * Latest export of one kind, cached as `{ version, [kind]: items }`.
 * A published version never changes: it is downloaded only once.
 */
async function loadExport<K extends Kind, T>(
  origin: string,
  kind: K,
  schema: z.ZodType<T>,
): Promise<{ version: string } & Record<K, T[]>> {
  type Export = { version: string } & Record<K, T[]>;
  const key = cacheKey(origin, kind);
  const cached = await storage.getItem<Export>(key);

  let latest: string | undefined;
  try {
    latest = (await loadVersions(origin))[kind][0];
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
  if (!latest) throw new Error(`Fourmizzz API: no ${kind} export available`);
  if (cached?.version === latest) return cached;

  const items = z.array(schema).parse(await getJson(`${origin}/api/exports/${kind}/?version=${latest}`));
  const fresh = { version: latest, [kind]: items } as Export;
  try {
    await storage.setItem(key, fresh);
  } catch (error) {
    // Storage full (quota): the page still gets the export, it will be downloaded again next time.
    console.warn(`[Optizzz] could not cache the ${kind} export`, error);
  }
  return fresh;
}

/** Published versions of the players export, latest first. */
export async function loadPlayersVersions(origin: string): Promise<string[]> {
  return (await loadVersions(origin)).players;
}

/** Latest players export of the `origin` server (e.g. "https://s5.fourmizzz.fr"). */
export function loadPlayersExport(origin: string): Promise<PlayersExport> {
  return loadExport(origin, "players", playerSchema);
}

/** Latest alliances export of the `origin` server, with their pacts and wars. */
export function loadAlliancesExport(origin: string): Promise<AlliancesExport> {
  return loadExport(origin, "alliances", allianceSchema);
}
