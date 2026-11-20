// A player's hourly analysis (docs/features/site-analyse.md): when its field moves, its probable floods. Public data,
// read by the extension's « Analyse » box on the game's profiles, without a permission nor anything about the reader.
import { serverById } from "@optizzz/game/servers";
import { playerAnalysisOf } from "~/lib/analysis/player-analysis";
import { playerHourly } from "~/server/queries";

const CORS = { "access-control-allow-origin": "*" };

export async function GET(_request: Request, { params }: { params: Promise<{ server: string; id: string }> }) {
  const { server: segment, id } = await params;
  const server = serverById(segment);
  if (!server || !/^\d+$/.test(id)) return Response.json({ error: "Joueur inconnu" }, { status: 404, headers: CORS });
  const playerId = Number(id);
  return Response.json(playerAnalysisOf(playerId, await playerHourly(server.id, playerId)), {
    // The cron writes once an hour.
    headers: { ...CORS, "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600" },
  });
}
