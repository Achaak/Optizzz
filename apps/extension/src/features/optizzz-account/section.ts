// The « Compte Optizzz » block at the top of « Fonctionnalités », in the toolbar popup and the game's dialog: connect,
// disconnect, and the offer « Rattacher Pseudo (S5) à votre Compte Optizzz », made once. Everything goes through the
// background script, which alone holds the token (messages.ts).
import { formatPastTime } from "@optizzz/game/format/time-format";
import { categoriesOf } from "@optizzz/game/site-links/envois";
import { isEnabled, type Toggles } from "../toggles";
import type { DiscordStatus } from "./discord";
import type { JoueurEnvois } from "./envois";
import type { AccountAction, AccountStatus } from "./messages";

/**
 * The six categories of the Envois (docs/features/site-envois.md), each with a plain sentence of what leaves. All off
 * by default; the army is « Rien », « Nombre » or « Par unité », as in « Mon état ».
 */
const CATEGORIES = [
  {
    id: "production",
    label: "Production",
    sentence:
      "Votre TDC, vos ouvrières, ce qu'elles récoltent, la taxe versée à votre colonisateur et ce que vous rapportent vos colonies.",
  },
  { id: "convoys", label: "Convois", sentence: "Vos convois envoyés, reçus et en route." },
  {
    id: "floods",
    label: "Floods",
    sentence:
      "Vos attaques en route, leur cible et leur arrivée ; avec le Plan de flood, la prise attendue et l'armée envoyée (l'armée, pour les Admins seuls).",
  },
  { id: "hunts", label: "Chasses", sentence: "Vos chasses en cours, leur retour et leur gain." },
  {
    id: "army",
    label: "Armée",
    sentence: "Le nombre de vos fourmis, ou aussi le détail par unité (le détail, pour les Admins seuls).",
  },
  {
    id: "levels",
    label: "Niveaux et chantiers",
    sentence: "Vos niveaux de constructions et de recherches, et vos chantiers.",
  },
] as const;

const ARMY_CHOICES = [
  { value: "none", label: "Rien" },
  { value: "count", label: "Nombre" },
  { value: "units", label: "Par unité" },
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
.account-categories .account-army { cursor: default; }
.account-categories .optizzz-note { margin: var(--optizzz-space-1) 0 0; }
.account-discord > * + * { margin-top: var(--optizzz-space-3); }`;

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
    const choose = (choices: JoueurEnvois["choices"]) =>
      run({ type: "optizzz-account", action: "choose", server: joueur.server, pseudo: joueur.pseudo, choices });
    for (const category of CATEGORIES) {
      const item = doc.createElement("li");
      const label = doc.createElement("label");
      const name = doc.createElement("span");
      name.textContent = category.label;
      if (category.id === "army") {
        // « Rien », « Nombre » or « Par unité »: a list, as in « Mon état ».
        const select = doc.createElement("select");
        select.dataset.category = category.id;
        for (const choice of ARMY_CHOICES) {
          const option = doc.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = joueur.choices.army === choice.value;
          select.append(option);
        }
        select.addEventListener("change", (event) => {
          const army = ARMY_CHOICES.find((choice) => choice.value === select.value)?.value;
          if (!event.isTrusted || !army) {
            select.value = joueur.choices.army;
            return;
          }
          choose({ ...joueur.choices, army });
        });
        label.className = "account-army";
        label.append(name, select);
      } else {
        const id = category.id;
        const box = doc.createElement("input");
        box.type = "checkbox";
        box.dataset.category = id;
        box.checked = joueur.choices[id];
        box.addEventListener("change", (event) => {
          if (!event.isTrusted) {
            box.checked = !box.checked;
            return;
          }
          choose({ ...joueur.choices, [id]: box.checked });
        });
        label.append(box, name);
      }
      item.append(label, paragraph(category.sentence, "optizzz-note"));
      list.append(item);
    }
    block.append(list);

    const state = joueur.problem
      ? paragraph(joueur.problem, "optizzz-callout optizzz-callout--warning")
      : categoriesOf(joueur.choices).length > 0 && joueur.spaceName
        ? paragraph(
            `Espace « ${joueur.spaceName} »${joueur.lastSentAt ? ` · dernier envoi ${formatPastTime(new Date(joueur.lastSentAt), new Date())}` : ""}.`,
            "optizzz-note",
          )
        : null;
    if (state) {
      state.setAttribute("role", "status");
      block.append(state);
    }
    if (joueur.discord) block.append(discordBlock(joueur.discord));
    return block;
  }

  /**
   * « Discord » (docs/features/site-discord.md): what the alliance announces on its channel, whether this Joueur's news
   * go there (only for a category they send), and « Autoriser Discord » until the browser lets the extension write there.
   */
  function discordBlock(discord: DiscordStatus): HTMLElement {
    const box = doc.createElement("div");
    box.className = "account-discord";
    const labels = discord.events.map((e) => e.label).join(", ");
    const mine = discord.events.filter((e) => e.consented).map((e) => e.label);
    box.append(paragraph(`Discord : votre alliance annonce les ${labels} de ses membres sur son salon.`));
    if (mine.length === 0) {
      box.append(paragraph("Les vôtres n'y partent que pour une catégorie que vous cochez ci-dessus.", "optizzz-note"));
    } else if (!discord.permitted) {
      box.append(
        paragraph(
          `Pour que vos ${mine.join(", ")} y soient annoncés juste après chaque envoi, autorisez l'extension à écrire sur Discord. Sans cela, rien n'y part.`,
          "optizzz-note",
        ),
      );
      const actions = doc.createElement("div");
      actions.className = "account-actions";
      actions.append(
        button("Autoriser Discord", "optizzz-button-primary", () => {
          input
            .ask({ type: "optizzz-account", action: "allow-discord" })
            .then(() => input.afterConnect?.())
            .catch((error: unknown) => {
              console.error("[Optizzz] could not open the Discord page", error);
            });
        }),
      );
      box.append(actions);
    } else {
      box.append(
        paragraph(
          `Vos ${mine.join(", ")} y sont annoncés juste après chaque envoi, depuis ce navigateur.`,
          "optizzz-note",
        ),
      );
    }
    if (discord.problem) {
      const problem = paragraph(discord.problem, "optizzz-callout optizzz-callout--warning");
      problem.setAttribute("role", "status");
      box.append(problem);
    }
    return box;
  }

  body.append(paragraph("Lecture du Compte Optizzz…", "optizzz-note"));
  run({ type: "optizzz-account", action: "status", origin: input.origin });
  return block;
}
