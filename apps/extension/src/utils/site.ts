// The site this build of the extension talks to (site-origin.ts): optizzz.fr, or WXT_SITE_URL while developing.
import { SITE_URL } from "@optizzz/game/site-links/site";
import { resolveSiteOrigin, siteOriginPattern } from "./site-origin";

export const SITE_ORIGIN = resolveSiteOrigin(
  import.meta.env.WXT_SITE_URL as string | undefined,
  import.meta.env.MODE,
  SITE_URL,
);

/** As in the manifest's optional_host_permissions. */
export const SITE_ORIGIN_PATTERN = siteOriginPattern(SITE_ORIGIN);
