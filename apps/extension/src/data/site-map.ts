// The server map's positions read on the Optizzz site, much lighter than the export (S4: about 1 MB against 44 MB).
// Public data, read without an account nor anything about the player (ADR 0005, docs/features/site-carte.md).
import { serverById } from "@optizzz/game/servers";
import { decodeMapData, mapDataSchema } from "@optizzz/map/map-data";
import type { AlliancesExport, PlayersExport } from "./exports";

export const SITE_URL = "https://optizzz.fr";

/** Past this, the map falls back on the export rather than waiting. */
const TIMEOUT_MS = 15_000;

/**
 * The players and alliances of the `origin` server as the site serves them; null when it cannot (site unreachable,
 * an answer that is not a map, a server it has not read yet): the map then reads the export.
 */
export async function loadSiteMap(
  origin: string,
): Promise<{ players: PlayersExport; alliances: AlliancesExport } | null> {
  const server = serverById(new URL(origin).hostname.split(".")[0] ?? "");
  if (!server) return null;
  try {
    const response = await fetch(`${SITE_URL}/api/${server.id}/carte`, {
      credentials: "omit",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const { version, players, alliances } = decodeMapData(mapDataSchema.parse(await response.json()));
    return { players: { version, players }, alliances: { version, alliances } };
  } catch (error) {
    console.warn("[Optizzz] server map: the site's positions could not be read, the export is used", error);
    return null;
  }
}
