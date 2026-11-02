// The Optizzz site and the addresses of its tools, for the site and for the extension (« Ouvrir sur optizzz.fr »).
// See docs/features/site-outils.md.
import { linkFragment } from "./link-state";

export const SITE_URL = "https://optizzz.fr";

/** The site's tools, in the order of `/tools`; each lives at `/tools/<id>`. */
export const SITE_TOOLS = ["travel", "costs", "combat", "hunt", "flood"] as const;

export type SiteToolId = (typeof SITE_TOOLS)[number];

export const isSiteToolId = (value: unknown): value is SiteToolId => SITE_TOOLS.some((tool) => tool === value);

export const siteToolPath = (tool: SiteToolId) => `/tools/${tool}`;

/** A server's pages on the site (`server`: « s5 »), see docs/features/site-public.md. */
export const siteServerPath = (server: string) => `/${server}`;
export const sitePlayerPath = (server: string, playerId: number) => `/${server}/players/${String(playerId)}`;
export const siteAlliancePath = (server: string, tag: string) => `/${server}/alliances/${encodeURIComponent(tag)}`;

/** The tool's address on the site, with `encoded` (from its `LinkFormat`) in the fragment: never sent to the site. */
export function siteToolUrl(tool: SiteToolId, encoded?: string): string {
  if (encoded !== undefined && !/^\d+\.[A-Za-z0-9_-]*$/.test(encoded))
    throw new Error(`Not an encoded tool state: ${encoded}`);
  return `${SITE_URL}${siteToolPath(tool)}${encoded === undefined ? "" : linkFragment(encoded)}`;
}
