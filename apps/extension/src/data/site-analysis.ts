// A player's hourly analysis, read on the Optizzz site, which reads the hourly
// exports (docs/features/site-analyse.md). Public data; the request says which profile is open,
// nothing about the player (no account, no cookie): see PRIVACY.md.
import { playerAnalysisSchema, type PlayerAnalysis } from "@optizzz/game/analysis/player-analysis";
import { serverById } from "@optizzz/game/servers";
import type { z } from "zod";
import { SITE_ORIGIN } from "@/utils/site";

/** Past this, the box says the site does not answer rather than waiting. */
const TIMEOUT_MS = 10_000;

async function readSite<T>(origin: string, path: (server: string) => string, schema: z.ZodType<T>): Promise<T | null> {
  const server = serverById(new URL(origin).hostname.split(".")[0] ?? "");
  if (!server) return null;
  try {
    const response = await fetch(`${SITE_ORIGIN}/api/${server.id}/${path(server.id)}`, {
      credentials: "omit",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return schema.parse(await response.json());
  } catch (error) {
    console.warn("[Optizzz] the site's analysis could not be read", error);
    return null;
  }
}

/** The player `id`'s hourly analysis on the `origin` server; null when the site cannot say. */
export const loadPlayerAnalysis = (origin: string, id: number): Promise<PlayerAnalysis | null> =>
  readSite(origin, () => `players/${String(id)}/analysis`, playerAnalysisSchema);
