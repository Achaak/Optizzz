// The « Compte Optizzz » block at the top of « Fonctionnalités », in the toolbar popup and the game's dialog: connect,
// disconnect, and the offer « Rattacher Pseudo (S5) à votre Compte Optizzz », made once. Everything goes through the
// background script, which alone holds the token (messages.ts).
import { formatPastTime } from "@optizzz/game/format/time-format";
import { isEnabled, type Toggles } from "../toggles";
import type { JoueurEnvois } from "./envois";
import type { AccountAction, AccountStatus } from "./messages";

/**
 * The six categories of the Envois (docs/features/site-envois.md), each with a plain sentence of what leaves. Only
 * the Convois send today; the others are shown, unticked and greyed « (bientôt) », until their ticket (21, 22).
 */
const CATEGORIES = [
  {
    id: "production",
    label: "Production",
    ready: false,
    sentence: "Votre TDC, vos ouvrières, la taxe et vos colonies.",
  },
  { id: "convoys", label: "Convois", ready: true, sentence: "Vos convois envoyés, reçus et en route." },
  { id: "floods", label: "Floods", ready: false, sentence: "Vos attaques en route, avec leur cible et leur arrivée." },
  { id: "hunts", label: "Chasses", ready: false, sentence: "Vos chasses en cours, leur retour et leur gain." },
  { id: "army", label: "Armée", ready: false, sentence: "Rien, le nombre de vos unités, ou le détail par unité." },
  {
    id: "levels",
    label: "Niveaux et chantiers",
    ready: false,
    sentence: "Vos niveaux de constructions et de recherches, et vos chantiers.",
  },
] as const;

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
.account-offer > * + * { margin-top: var(--optizzz-space-3); }
.account-envois { margin: 0; }
.account-envois > * + * { margin-top: var(--optizzz-space-3); }
.account-categories { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--optizzz-space-3); }
.account-categories label { display: flex; gap: var(--optizzz-space-3); align-items: center; cursor: pointer; }
.account-categories input { margin: 0; }
.account-categories input:disabled + span { opacity: 0.6; }
.account-categories .optizzz-note { margin: var(--optizzz-space-1) 0 0; }`;

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

    for (const joueur of status.envois) body.append(envoisBlock(joueur));

    const actions = doc.createElement("div");
    actions.className = "account-actions";
    actions.append(
      button("Déconnecter", "optizzz-button-link", () => run({ type: "optizzz-account", action: "disconnect" })),
    );
    body.append(actions);
  }

  /** « Envois de Pseudo (S5) »: the six categories, all off by default, each with what it sends. */
  function envoisBlock(joueur: JoueurEnvois): HTMLElement {
    const block = doc.createElement("fieldset");
    block.className = "account-envois";
    const legend = doc.createElement("legend");
    legend.textContent = `Envois de ${joueur.pseudo} (${joueur.server.toUpperCase()})`;
    block.append(
      legend,
      paragraph(
        "Ce que vous cochez part chiffré vers votre Espace d'alliance sur optizzz.fr, que seuls ses membres peuvent lire. Rien n'est coché d'avance.",
        "optizzz-note",
      ),
    );
    const list = doc.createElement("ul");
    list.className = "account-categories";
    for (const category of CATEGORIES) {
      const item = doc.createElement("li");
      const label = doc.createElement("label");
      const box = doc.createElement("input");
      box.type = "checkbox";
      box.dataset.category = category.id;
      box.checked = category.id === "convoys" && joueur.choices.convoys;
      box.disabled = !category.ready;
      box.addEventListener("change", (event) => {
        if (!event.isTrusted) {
          box.checked = !box.checked;
          return;
        }
        run({
          type: "optizzz-account",
          action: "choose",
          server: joueur.server,
          pseudo: joueur.pseudo,
          choices: { ...joueur.choices, convoys: box.checked },
        });
      });
      const name = doc.createElement("span");
      name.textContent = category.ready ? category.label : `${category.label} (bientôt)`;
      label.append(box, name);
      item.append(label, paragraph(category.sentence, "optizzz-note"));
      list.append(item);
    }
    block.append(list);

    const state = joueur.problem
      ? paragraph(joueur.problem, "optizzz-callout optizzz-callout--warning")
      : joueur.choices.convoys && joueur.spaceName
        ? paragraph(
            `Espace « ${joueur.spaceName} »${joueur.lastSentAt ? ` · dernier envoi ${formatPastTime(new Date(joueur.lastSentAt), new Date())}` : ""}.`,
            "optizzz-note",
          )
        : null;
    if (state) {
      state.setAttribute("role", "status");
      block.append(state);
    }
    return block;
  }

  body.append(paragraph("Lecture du Compte Optizzz…", "optizzz-note"));
  run({ type: "optizzz-account", action: "status", origin: input.origin });
  return block;
}
