// A server's map, as the cron prepared it (gzipped columns of @optizzz/map/map-data). Public data, read-only: any page
// may read it, the extension's Server map included, without a permission (docs/features/site-carte.md).
import { serverById } from "@optizzz/game/servers";
import { db } from "~/server/db";

const CORS = { "access-control-allow-origin": "*" };

export async function GET(_request: Request, { params }: { params: Promise<{ server: string }> }) {
  const server = serverById((await params).server);
  const file = server ? await db.mapFile.findUnique({ where: { server: server.id } }) : null;
  if (!file) return new Response(null, { status: 404, headers: CORS });
  return new Response(file.gzip, {
    headers: {
      ...CORS,
      "content-type": "application/json",
      "content-encoding": "gzip",
      // The cron writes a new file each hour: the CDN keeps this one ten minutes.
      "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
