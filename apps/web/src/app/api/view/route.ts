// The page views counter (docs/features/site-audience.md): each page of the site sends its path here once shown, without
// a cookie. Only the route is counted, and nothing about the visitor is kept.
import { after } from "next/server";
import { countedPage, MAX_PATH } from "~/lib/page-views";
import { countView } from "~/server/page-views";

export async function POST(request: Request) {
  // Only the site's own pages count: another site cannot add to the figures.
  if (request.headers.get("sec-fetch-site") !== "same-origin") return new Response(null, { status: 403 });
  const page = countedPage((await request.text()).slice(0, MAX_PATH + 1));
  const userAgent = request.headers.get("user-agent");
  if (page) after(() => countView(page, userAgent));
  return new Response(null, { status: 204 });
}
