// The link script's work on optizzz.fr « Connecter l'extension », apart from its entrypoint so a test can run it. It
// runs in the extension's isolated world: the page's scripts see neither its variables nor its fetch's answer. The
// token goes from the site's answer straight to the background script; the page only gets how it went, by an
// attribute of <html>.
import {
  ATTACH_SLOT_ATTRIBUTE,
  EXTENSION_API,
  LINK_STATE_ATTRIBUTE,
  type LinkState,
} from "@optizzz/game/site-links/extension-link";
import { browserName } from "./browser-name";
import type { LinkMessage, LinkOffer } from "./messages";

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
    if (!okOf(await send({ type: "optizzz-link", action: "token", token }))) return show("failed");
  } catch {
    return show("failed");
  }
  show("linked");
  await offerToAttach(doc, send).catch((error: unknown) => {
    console.error("[Optizzz] could not offer to attach the Player", error);
  });
  return "linked";
}

const isLinkOffer = (reply: unknown): reply is LinkOffer =>
  typeof reply === "object" && reply !== null && "offer" in reply && "notice" in reply;

const BOX_STYLE = `
.box { margin-top: 0.75rem; padding: 0.875rem; border-radius: 0.625rem; background: var(--raised, #ece6da);
  color: var(--foreground, #1d1812); font: inherit; font-size: 0.875rem; line-height: 1.5; }
p { margin: 0; }
p + p, .actions { margin-top: 0.5rem; }
.note { color: var(--muted-foreground, #5d5244); }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
button { font: inherit; font-weight: 500; cursor: pointer; border-radius: 999px; padding: 0.375rem 0.875rem; }
.primary { border: 0; background: var(--primary, #8a5a1f); color: var(--primary-foreground, #fff); }
.link { border: 0; background: none; color: inherit; text-decoration: underline; padding-inline: 0.25rem; }
.error { font-weight: 500; }
`;

/** How long to wait for the page to draw its slot after « linked ». */
const SLOT_WAIT_MS = 2000;

/** The page's empty slot, now or once drawn; null when it never comes. */
function slotOf(doc: Document): Promise<Element | null> {
  const find = () => doc.querySelector(`[${ATTACH_SLOT_ATTRIBUTE}]`);
  const now = find();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const slot = find();
      if (!slot) return;
      observer.disconnect();
      clearTimeout(timer);
      resolve(slot);
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, SLOT_WAIT_MS);
    observer.observe(doc.documentElement, { childList: true, subtree: true });
  });
}

/**
 * « Rattacher Pseudo (S5) à votre Compte Optizzz », right after the link, in the page's empty slot: drawn in a closed
 * shadow root, so the page's scripts can neither read it nor click it (an untrusted click is ignored). Nothing leaves
 * without the player's click, as in the settings.
 */
async function offerToAttach(doc: Document, send: LinkPageDependencies["send"]): Promise<void> {
  const first: unknown = await send({ type: "optizzz-link", action: "offer" });
  if (!isLinkOffer(first) || !first.offer) return;
  // The page draws its slot once it reads « linked », a render after this script wrote it.
  const slot = await slotOf(doc);
  if (!slot) return;
  const root = slot.attachShadow({ mode: "closed" });
  const style = doc.createElement("style");
  style.textContent = BOX_STYLE;
  const box = doc.createElement("div");
  box.className = "box";
  box.setAttribute("role", "status");
  root.append(style, box);

  const paragraph = (text: string, className?: string) => {
    const p = doc.createElement("p");
    p.textContent = text;
    if (className) p.className = className;
    return p;
  };
  const draw = ({ offer, notice }: LinkOffer) => {
    box.replaceChildren();
    if (notice) box.append(paragraph(notice.text, notice.kind === "error" ? "error" : undefined));
    if (!offer) {
      if (!notice) box.remove();
      return;
    }
    box.append(
      paragraph(`Rattacher ${offer.pseudo} (${offer.serverName}) à votre Compte Optizzz ?`),
      paragraph(
        "Il le faut pour rejoindre un Espace d'alliance. Le pseudo et son serveur partent vers optizzz.fr ; un Joueur n'appartient qu'à un seul compte.",
        "note",
      ),
    );
    const actions = doc.createElement("div");
    actions.className = "actions";
    const button = (label: string, className: string, action: "attach" | "decline") => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = className;
      b.textContent = label;
      b.addEventListener("click", (event) => {
        if (!event.isTrusted) return;
        for (const other of actions.querySelectorAll("button")) other.disabled = true;
        send({ type: "optizzz-link", action })
          .then((reply) => {
            draw(isLinkOffer(reply) ? reply : { offer: null, notice: null });
          })
          .catch((error: unknown) => {
            console.error("[Optizzz] attaching the Player failed", error);
            draw({
              offer: null,
              notice: { kind: "error", text: "Le rattachement n'a pas abouti. Réessayez depuis l'extension." },
            });
          });
      });
      return b;
    };
    actions.append(button("Rattacher", "primary", "attach"), button("Non merci", "link", "decline"));
    box.append(actions);
  };
  draw(first);
}

export const linkPageBrowser = () => browserName(navigator.userAgent, import.meta.env.FIREFOX);
