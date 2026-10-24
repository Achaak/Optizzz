import { LINK_SCRIPT, SITE_ORIGIN_PATTERN } from "./permission";

/**
 * Registers the link script on « Connecter l'extension » while optizzz.fr and `scripting` are granted, and removes it
 * otherwise. Not in the manifest: a content script declared there for optizzz.fr would be a required host permission.
 */
export async function syncLinkScript(): Promise<void> {
  const granted = await browser.permissions.contains({ origins: [SITE_ORIGIN_PATTERN], permissions: ["scripting"] });
  // Without the `scripting` permission, the API is not even there (whatever the types say).
  const scripting = (browser as { scripting?: typeof browser.scripting }).scripting;
  if (!scripting) return;
  const registered = await scripting.getRegisteredContentScripts({ ids: [LINK_SCRIPT.id] });
  if (granted && registered.length === 0) {
    await scripting.registerContentScripts([
      {
        id: LINK_SCRIPT.id,
        js: [...LINK_SCRIPT.js],
        matches: [...LINK_SCRIPT.matches],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
  } else if (!granted && registered.length > 0) {
    await scripting.unregisterContentScripts({ ids: [LINK_SCRIPT.id] });
  }
}
