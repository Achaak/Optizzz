// Client for the public exports API — see docs/research/fourmizzz-api-exports.md.
import { storage } from "wxt/utils/storage";
import { z } from "zod";

// No `new Function` probing: extension pages forbid eval, and store reviewers flag it.
z.config({ jitless: true });

const playerSchema = z.object({
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

const versionsSchema = z.object({ players: z.array(z.string()) });

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
    latest = versionsSchema.parse(await getJson(`${origin}/api/exports/`)).players[0];
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
  if (!latest) throw new Error("Fourmizzz API: no players export available");
  if (cached?.version === latest) return cached;

  const players = z.array(playerSchema).parse(await getJson(`${origin}/api/exports/players/?version=${latest}`));
  const playersExport = { version: latest, players };
  await storage.setItem(cacheKey(origin), playersExport);
  return playersExport;
}
