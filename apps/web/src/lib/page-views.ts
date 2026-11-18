// The page views counter (docs/features/site-audience.md): one number per Paris day and per page of the site. A page is
// named by its route (« /[server]/players/[id] »), never by the player, alliance or space it shows, and nothing about
// the visitor is kept: neither address, nor cookie, nor browser.
import { parisParts } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";

/** The site's public pages, as the App Router names them. The back office is never counted. */
const PAGES = [
  "/",
  "/about",
  "/account",
  "/connect-extension",
  "/guides",
  "/guides/combat",
  "/guides/food",
  "/guides/hunt",
  "/guides/tdc-chain",
  "/guides/travel",
  "/legal",
  "/login",
  "/login/confirm",
  "/privacy",
  "/spaces",
  "/spaces/[id]",
  "/spaces/[id]/declarer",
  "/tools",
  "/tools/combat",
  "/tools/costs",
  "/tools/flood",
  "/tools/hunt",
  "/tools/travel",
  "/[server]",
  "/[server]/alliances",
  "/[server]/alliances/[tag]",
  "/[server]/compare",
  "/[server]/journal",
  "/[server]/map",
  "/[server]/players",
  "/[server]/players/[id]",
] as const;

/** What the extension's reads of a server's map are counted as. */
export const MAP_API_PAGE = "/api/[server]/map";

/** Longer than any page of the site: whatever is sent beyond this is not one of them. */
export const MAX_PATH = 200;

export interface CountedPage {
  /** The route: « /tools/combat », « /[server]/players/[id] ». */
  page: string;
  /** « s5 » on a server's pages, else empty. */
  server: string;
}

/** The page a path is counted as, or null for a path that is not one of the site's public pages. */
export function countedPage(path: string): CountedPage | null {
  if (!path.startsWith("/") || path.length > MAX_PATH) return null;
  const segments = path.split("/").filter(Boolean);
  const server = segments[0] ? serverById(segments[0]) : undefined;
  for (const page of PAGES) {
    const route = page.split("/").filter(Boolean);
    if (route.length !== segments.length) continue;
    const fits = route.every((part, i) =>
      part === "[server]" ? server !== undefined : part.startsWith("[") || part === segments[i],
    );
    if (fits) return { page, server: route[0] === "[server]" && server ? server.id : "" };
  }
  return null;
}

/** The Paris calendar day of `date`, at midnight UTC: the key of a day's count. */
export function parisDay(date: Date): Date {
  const { year, month, day } = parisParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

/** A crawler, a headless browser or a client that gives no name: not a visitor. */
export function isRobot(userAgent: string | null): boolean {
  return (
    !userAgent || /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python|node-fetch/i.test(userAgent)
  );
}
