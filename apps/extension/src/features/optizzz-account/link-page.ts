// The link script's work on optizzz.fr « Connecter l'extension », apart from its entrypoint so a test can run it. It
// runs in the extension's isolated world: the page's scripts see neither its variables nor its fetch's answer. The
// token goes from the site's answer straight to the background script; the page only gets how it went, by an
// attribute of <html>.
import { EXTENSION_API, LINK_STATE_ATTRIBUTE, type LinkState } from "@optizzz/game/site-links/extension-link";
import { browserName } from "./browser-name";
import type { LinkMessage } from "./messages";

interface LinkPageDependencies {
  doc: Document;
  /** The page's origin: the request stays same-origin, with the site's session. */
  origin: string;
  send: (message: LinkMessage) => Promise<unknown>;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  browser: string;
}

const okOf = (reply: unknown) => typeof reply === "object" && reply !== null && (reply as { ok?: unknown }).ok === true;

export async function runLinkPage({ doc, origin, send, fetch, browser }: LinkPageDependencies): Promise<LinkState> {
  const show = (state: LinkState) => {
    doc.documentElement.setAttribute(LINK_STATE_ATTRIBUTE, state);
    return state;
  };
  // Only after « Connecter mon Compte Optizzz » in the extension: visiting the page is not enough.
  if (!okOf(await send({ type: "optizzz-link", action: "start" }))) return show("not-requested");
  show("linking");
  try {
    const response = await fetch(`${origin}${EXTENSION_API.link}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ browser }),
    });
    const body: unknown = response.ok ? await response.json() : null;
    const token = typeof body === "object" && body !== null ? (body as { token?: unknown }).token : undefined;
    if (typeof token !== "string") return show("failed");
    return show(okOf(await send({ type: "optizzz-link", action: "token", token })) ? "linked" : "failed");
  } catch {
    return show("failed");
  }
}

export const linkPageBrowser = () => browserName(navigator.userAgent, import.meta.env.FIREFOX);
