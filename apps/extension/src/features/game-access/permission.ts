// Access to the game's pages (host_permissions). Chrome grants it at install. Firefox lets the player take it back
// (about:addons, or « Autoriser uniquement sur clic ») and may leave it ungranted after an update: the content scripts
// then run only once the toolbar button is clicked, again after each reload.

export const GAME_ACCESS_PERMISSION = { origins: ["*://*.fourmizzz.fr/*"] } satisfies Browser.permissions.Permissions;

export const GAME_ACCESS_PAGE = "/game-access.html";

export function hasGameAccess(): Promise<boolean> {
  return browser.permissions.contains(GAME_ACCESS_PERMISSION);
}

/** From an extension page or the background script: only an extension page may ask. */
export function openGameAccessPage(): Promise<unknown> {
  return browser.tabs.create({ url: browser.runtime.getURL(GAME_ACCESS_PAGE) });
}

/** In the background: after an install or an update without the access, the page that asks for it. */
export function setUpGameAccess(): void {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason !== "install" && reason !== "update") return;
    void hasGameAccess()
      .then((granted) => (granted ? null : openGameAccessPage()))
      .catch((error: unknown) => {
        console.error("[Optizzz] could not check the access to the game's pages", error);
      });
  });
}
