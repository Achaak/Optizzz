import { SITE_ORIGIN_PATTERN, SITE_SCRIPTS } from "./permission";

/**
 * Registers the extension's scripts on optizzz.fr (« Connecter l'extension », the Alliance Spaces) while optizzz.fr and
 * `scripting` are granted, and removes them otherwise. Script by script: a browser linked before the Alliance Spaces
 * already has the link script, and gets the space script on its next start. Not in the manifest: a content script
 * declared there for optizzz.fr would be a required host permission.
 */
export async function syncLinkScript(): Promise<void> {
  const granted = await browser.permissions.contains({ origins: [SITE_ORIGIN_PATTERN], permissions: ["scripting"] });
  // Without the `scripting` permission, the API is not even there (whatever the types say).
  const scripting = (browser as { scripting?: typeof browser.scripting }).scripting;
  if (!scripting) return;
  const registered = new Set(
    (await scripting.getRegisteredContentScripts({ ids: SITE_SCRIPTS.map((s) => s.id) })).map((s) => s.id),
  );
  if (granted) {
    const missing = SITE_SCRIPTS.filter((s) => !registered.has(s.id));
    if (missing.length > 0)
      await scripting.registerContentScripts(
        missing.map((script) => ({
          id: script.id,
          js: [...script.js],
          matches: [...script.matches],
          runAt: "document_idle" as const,
          persistAcrossSessions: true,
        })),
      );
  } else if (registered.size > 0) {
    await scripting.unregisterContentScripts({ ids: [...registered] });
  }
}
