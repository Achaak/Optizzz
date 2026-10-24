// What the site and the extension agree on to link an extension to an Optizzz account (docs/features/site-comptes-
// espaces.md, « Joueurs et extension »). The token itself never crosses the page: the extension's script asks for it
// in its own isolated world, and the page only learns how it went, by an attribute of <html>.

/** The page « Connecter l'extension ». */
export const CONNECT_EXTENSION_PATH = "/connect-extension";

/** The attribute of <html> the extension's script sets on that page, for the page to say how the link went. */
export const LINK_STATE_ATTRIBUTE = "data-optizzz-link";

/**
 * - `linking`: the extension is asking for its token;
 * - `linked`: done;
 * - `not-requested`: the extension is there but was not asked to link (« Connecter mon Compte Optizzz » not clicked);
 * - `failed`: the site refused or could not be reached.
 */
export type LinkState = "linking" | "linked" | "not-requested" | "failed";

/** The extension's API on the site. */
export const EXTENSION_API = {
  /** POST, from the page « Connecter l'extension » with the site's session: `{ token }`. */
  link: "/api/extension/link",
  /** GET with the token: the account's Players. */
  account: "/api/extension/account",
  /** POST with the token, `{ server, pseudo }`: attach a Player. */
  players: "/api/extension/players",
  /** DELETE with the token: « Déconnecter ». */
  token: "/api/extension/token",
} as const;
