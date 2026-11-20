// An alliance's probable floods over 7 days, by other alliance (docs/features/analyse-alliances.md). Public data, read
// by the extension's box on the game's alliance pages.
import { floodsByAlliance } from "@optizzz/game/analysis/alliance-floods";
import type { FloodSureness } from "@optizzz/game/analysis/floods";
import { serverById } from "@optizzz/game/servers";
import { allianceFloodRows } from "~/server/queries";

const CORS = { "access-control-allow-origin": "*" };

export async function GET(_request: Request, { params }: { params: Promise<{ server: string; tag: string }> }) {
  const { server: segment, tag: encoded } = await params;
  const server = serverById(segment);
  if (!server) return Response.json({ error: "Serveur inconnu" }, { status: 404, headers: CORS });
  const tag = decodeURIComponent(encoded);
  const rows = await allianceFloodRows(server.id, tag);
  return Response.json(
    floodsByAlliance(
      rows.map((row) => ({ ...row, sureness: row.sureness as FloodSureness })),
      tag,
    ),
    { headers: { ...CORS, "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
