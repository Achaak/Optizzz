// The « Compte Optizzz » block at the top of « Fonctionnalités », in the toolbar popup and the game's dialog: connect,
// disconnect, and the offer « Rattacher Pseudo (S5) à votre Compte Optizzz », made once. Everything goes through the
// background script, which alone holds the token (messages.ts).
import { isEnabled, type Toggles } from "../toggles";
import type { AccountAction, AccountStatus } from "./messages";

export const accountEnabled = (toggles: Toggles) => isEnabled(toggles, "optizzz-account");

export interface AccountSectionInput {
  /** The game's origin of the dialog; null in the popup, where the background takes the last game tab's. */
  origin: string | null;
  ask: (action: AccountAction) => Promise<AccountStatus | null>;
  /** After « Connecter mon Compte Optizzz » opened its page: the popup closes. */
  afterConnect?: () => void;
}

export const ACCOUNT_STYLE = `
.account { margin: 0 0 var(--optizzz-space-5); }
.account > * + * { margin-top: var(--optizzz-space-3); }
.account p { margin-bottom: 0; }
.account-title { margin: 0; font-weight: bold; }
.account-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-3) var(--optizzz-space-5); }
.account-offer > * + * { margin-top: var(--optizzz-space-3); }`;

export function buildAccountSection(doc: Document, input: AccountSectionInput): HTMLElement {
  const block = doc.createElement("section");
  block.className = "account optizzz-well";
  block.setAttribute("aria-labelledby", "optizzz-account-title");
  const title = doc.createElement("h3");
  title.className = "account-title";
  title.id = "optizzz-account-title";
  title.textContent = "Compte Optizzz";
  const body = doc.createElement("div");
  body.setAttribute("aria-live", "polite");
  block.append(title, body);

  const paragraph = (text: string, className = "") => {
    const p = doc.createElement("p");
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };
  const button = (text: string, className: string, action: () => void) => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = text;
    element.addEventListener("click", (event) => {
      // Only a person's click: a page's script cannot make the extension send anything.
      if (!event.isTrusted) return;
      action();
    });
    return element;
  };

  let busy = false;
  const run = (action: AccountAction) => {
    if (busy) return;
    busy = true;
    for (const element of body.querySelectorAll("button")) element.disabled = true;
    input
      .ask(action)
      .then((status) => {
        if (status) render(status);
      })
      .catch((error: unknown) => {
        console.error("[Optizzz] Optizzz account: the action failed", error);
        render(null);
      })
      .finally(() => {
        busy = false;
      });
  };

  function render(status: AccountStatus | null) {
    body.replaceChildren();
    if (!status) {
      body.append(paragraph("L'état du Compte Optizzz n'a pas pu être lu. Rouvrez les paramètres.", "optizzz-note"));
      return;
    }
    if (status.notice) {
      const notice = paragraph(
        status.notice.text,
        `optizzz-callout optizzz-callout--${status.notice.kind === "success" ? "success" : "danger"}`,
      );
      notice.setAttribute("role", status.notice.kind === "success" ? "status" : "alert");
      body.append(notice);
    }

    if (!status.linked || !status.permitted) {
      body.append(
        paragraph(
          status.linked
            ? "L'accès à optizzz.fr a été retiré à l'extension : connectez-la de nouveau pour rattacher vos Joueurs."
            : "Facultatif : liez l'extension à votre Compte Optizzz pour rejoindre l'Espace de votre alliance sur optizzz.fr. Sans compte lié, l'extension n'envoie rien.",
          "optizzz-note",
        ),
      );
      const actions = doc.createElement("div");
      actions.className = "account-actions";
      actions.append(
        button("Connecter mon Compte Optizzz", "optizzz-button-primary", () => {
          input
            .ask({ type: "optizzz-account", action: "connect" })
            .then(() => input.afterConnect?.())
            .catch((error: unknown) => {
              console.error("[Optizzz] could not open the Optizzz account page", error);
            });
        }),
      );
      body.append(actions);
      return;
    }

    const players = status.players.map((player) => `${player.pseudo} (${player.server.toUpperCase()})`);
    body.append(
      paragraph(
        players.length > 0
          ? `Extension liée à votre Compte Optizzz. Joueurs rattachés : ${players.join(", ")}.`
          : "Extension liée à votre Compte Optizzz. Aucun Joueur rattaché.",
      ),
    );

    const { offer } = status;
    if (offer) {
      const box = doc.createElement("div");
      box.className = "account-offer optizzz-callout";
      box.append(
        paragraph(`Rattacher ${offer.pseudo} (${offer.serverName}) à votre Compte Optizzz ?`),
        paragraph(
          "Le pseudo et son serveur partent vers optizzz.fr. Un Joueur n'appartient qu'à un seul compte.",
          "optizzz-note",
        ),
      );
      const actions = doc.createElement("div");
      actions.className = "account-actions";
      actions.append(
        button("Rattacher", "optizzz-button-primary", () =>
          run({ type: "optizzz-account", action: "attach", origin: offer.origin }),
        ),
        button("Non merci", "optizzz-button-link", () =>
          run({ type: "optizzz-account", action: "decline", origin: offer.origin }),
        ),
      );
      box.append(actions);
      body.append(box);
    }

    const actions = doc.createElement("div");
    actions.className = "account-actions";
    actions.append(
      button("Déconnecter", "optizzz-button-link", () => run({ type: "optizzz-account", action: "disconnect" })),
    );
    body.append(actions);
  }

  body.append(paragraph("Lecture du Compte Optizzz…", "optizzz-note"));
  run({ type: "optizzz-account", action: "status", origin: input.origin });
  return block;
}
