// The optional permissions « Connecter mon Compte Optizzz » asks for (ADR 0007): optizzz.fr, and `scripting` to put
// the link script on its page « Connecter l'extension ». Optional, so that an update disables nobody's extension. On
// Firefox, also the consent to send data to optizzz.fr (data_collection_permissions, optional in the manifest).
import { CONNECT_EXTENSION_PATH } from "@optizzz/game/site-links/extension-link";
import { SITE_URL } from "@optizzz/game/site-links/site";

/** As in the manifest's optional_host_permissions. */
export const SITE_ORIGIN_PATTERN = `${SITE_URL}/*`;

/**
 * Firefox's categories for what a linked extension sends (docs/features/site-comptes-espaces.md):
 * `authenticationInfo` for the account's registration (the token, and the game's pseudo, which is also the game's
 * login name), `websiteContent` for the pseudo read in the game's header.
 */
export const SITE_DATA_COLLECTION = ["authenticationInfo", "websiteContent"] as const;

/** Firefox's `permissions` objects take `data_collection`, unknown to Chrome and to WXT's types. */
type SitePermission = Browser.permissions.Permissions & { data_collection?: readonly string[] };

export function sitePermission(isFirefox: boolean): SitePermission {
  return {
    origins: [SITE_ORIGIN_PATTERN],
    permissions: ["scripting"],
    ...(isFirefox && { data_collection: SITE_DATA_COLLECTION }),
  };
}

export const SITE_PERMISSION = sitePermission(import.meta.env.FIREFOX);

/** The link script, registered once optizzz.fr is granted, only on « Connecter l'extension ». */
export const LINK_SCRIPT = {
  id: "optizzz-link",
  js: ["/optizzz-link.js"],
  matches: [`${SITE_URL}${CONNECT_EXTENSION_PATH}`, `${SITE_URL}${CONNECT_EXTENSION_PATH}?*`],
} as const;

/** The extension's page that explains and asks (only an extension page may ask, and Firefox's popup would close). */
export const CONNECT_PAGE = "/connect-account.html";
