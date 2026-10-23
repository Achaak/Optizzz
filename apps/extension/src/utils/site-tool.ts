// « Ouvrir sur optizzz.fr » and « Copier le lien » of the combat simulator, the hunt launcher and the flood plan: the
// tool of the site with the player's entries, in the fragment of its address (never sent to the site). Only on a click,
// and only while « Liens vers optizzz.fr » is on. The tab is opened by the background script: tabs.create needs no
// permission. See docs/features/site-outils.md.
import { isSiteToolId, siteToolUrl, type SiteToolId } from "@optizzz/game/site-links/site";
import { isEnabled, type Toggles } from "@/features/toggles";

/** The buttons are shown only while « Liens vers optizzz.fr » is on. */
export const siteLinksEnabled = (toggles: Toggles) => isEnabled(toggles, "site-links");

/** For « Copier le lien »: `encoded` comes from the tool's `LinkFormat` (@optizzz/game/site-links). */
export const siteToolLink = (tool: SiteToolId, encoded: string) => siteToolUrl(tool, encoded);

interface OpenSiteToolMessage {
  type: "open-site-tool";
  tool: SiteToolId;
  /** The encoded state, `1.<base64url>`. */
  state: string;
}

/** « Ouvrir sur optizzz.fr », from a content script or an extension page. */
export function openSiteTool(tool: SiteToolId, encoded: string): Promise<unknown> {
  const message: OpenSiteToolMessage = { type: "open-site-tool", tool, state: encoded };
  return browser.runtime.sendMessage(message);
}

/** The background script opens nothing but a tool of the site, whatever a message holds. */
export function isOpenSiteToolMessage(message: unknown): message is OpenSiteToolMessage {
  if (typeof message !== "object" || message === null) return false;
  const { type, tool, state } = message as Partial<Record<keyof OpenSiteToolMessage, unknown>>;
  return type === "open-site-tool" && isSiteToolId(tool) && typeof state === "string" && /^\d+\.[\w-]*$/.test(state);
}

export const siteToolMessageUrl = (message: OpenSiteToolMessage) => siteToolUrl(message.tool, message.state);
