// Client for the public exports API — see docs/research/fourmizzz-api-exports.md.
import { storage } from "wxt/utils/storage";
import * as v from "valibot";

const integer = v.pipe(v.number(), v.integer());

const playerSchema = v.object({
  id: integer,
  pseudo: v.string(),
  alliance: v.nullable(v.string()),
  masterPlayerId: v.nullable(integer),
  x: integer,
  y: integer,
  field: v.number(),
  grade: v.nullable(v.string()),
  buildingScore: v.number(),
  technologyScore: v.number(),
  trophyScore: v.number(),
  onHoliday: v.boolean(),
  isBanned: v.boolean(),
});

export type Player = v.InferOutput<typeof playerSchema>;

const versionsSchema = v.object({ players: v.array(v.string()) });

export interface PlayersExport {
  /** UTC date of the export, AAAAMMJJHHmm. */
  version: string;
  players: Player[];
}

const cacheKey = (origin: string) => `local:allianceMap:${new URL(origin).host}:playersExport` as const;

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fourmizzz API: ${response.status} on ${url}`);
  return response.json();
}

/**
 * Latest players export of the `origin` server (e.g. "https://s5.fourmizzz.fr").
 * A published version never changes: it is downloaded only once.
 */
export async function loadPlayersExport(origin: string): Promise<PlayersExport> {
  const cached = await storage.getItem<PlayersExport>(cacheKey(origin));

  let latest: string | undefined;
  try {
    latest = v.parse(versionsSchema, await getJson(`${origin}/api/exports/`)).players[0];
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
  if (!latest) throw new Error("Fourmizzz API: no players export available");
  if (cached?.version === latest) return cached;

  const players = v.parse(v.array(playerSchema), await getJson(`${origin}/api/exports/players/?version=${latest}`));
  const playersExport = { version: latest, players };
  await storage.setItem(cacheKey(origin), playersExport);
  return playersExport;
}
