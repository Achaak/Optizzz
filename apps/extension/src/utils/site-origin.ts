// The Optizzz site the extension talks to (account, Alliance Spaces, the server map's positions): optizzz.fr, or a
// local site while developing, from WXT_SITE_URL (apps/extension/.env.development.local, docs/features/site-comptes-espaces.md).
// Pure, without import.meta.env, so that wxt.config.ts reads the same rules for the manifest (SITE_ORIGIN: site.ts).

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The site's origin: `fallback` unless `configured` is set. Another site is for development only: a build of mode
 * `production` (the stores' builds) refuses it, and plain http is taken only for this machine.
 */
export function resolveSiteOrigin(configured: string | undefined, mode: string, fallback: string): string {
  if (configured === undefined || configured === "") return fallback;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(`WXT_SITE_URL is not an address: ${configured}`);
  }
  if (url.origin === fallback) return fallback;
  if (mode === "production")
    throw new Error(
      `WXT_SITE_URL=${configured} in a production build: the stores' extension talks to ${fallback} only`,
    );
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "")
    throw new Error(`WXT_SITE_URL must be an origin, without a path: ${configured}`);
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
    throw new Error(`WXT_SITE_URL must be https, or http on this machine: ${configured}`);
  return url.origin;
}

/** The match pattern of the site's pages, as in the manifest's optional_host_permissions: any port of its host. */
export function siteOriginPattern(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}
