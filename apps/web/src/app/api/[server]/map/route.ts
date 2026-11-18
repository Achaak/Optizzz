// A server's map, as the cron prepared it (gzipped columns of @optizzz/map/map-data). Public data, read-only: any page
// may read it, the extension's Server map included, without a permission (docs/features/site-carte.md).
import { serverById } from "@optizzz/game/servers";
import { after } from "next/server";
import { MAP_API_PAGE } from "~/lib/page-views";
import { db } from "~/server/db";
import { countView } from "~/server/page-views";

const CORS = { "access-control-allow-origin": "*" };

export async function GET(request: Request, { params }: { params: Promise<{ server: string }> }) {
  const server = serverById((await params).server);
  const file = server ? await db.mapFile.findUnique({ where: { server: server.id } }) : null;
  if (!file) return new Response(null, { status: 404, headers: CORS });
  // The extension's reads, counted like a page view (docs/features/site-audience.md): the site's own map page is
  // counted as a page already. The browser keeps the file ten minutes, so a reader counts at most once in that time.
  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    const userAgent = request.headers.get("user-agent");
    after(() => countView({ page: MAP_API_PAGE, server: file.server }, userAgent));
  }
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
