// The Demandes in the game (docs/features/site-demandes.md). On commerce.php, « Demandes de l'alliance »: the validated
// Demandes of the others with what remains to send, and « Envoyer un convoi », which fills the game's form for one
// (recipient, what remains, within what the player holds). Opened from optizzz.fr, commerce.php#optizzz-demande=<id>
// fills it the same way. The player checks it and clicks « Lancer le convoi » themself: nothing here submits a form
// of the game. On construction.php and laboratoire.php, the levels and works shown go to the background, which closes
// the player's own Demandes reached. The background holds the Clé d'alliance and answers already decrypted.
import { formatAmount } from "@optizzz/game/format/number-format";
import { readBuildingLevels, readResearchLevels } from "@optizzz/game/pages/levels";
import { readStock } from "@optizzz/game/pages/resources";
import { readWorkQueue } from "@optizzz/game/pages/work-queue";
import { demandeIdOfHash, STATUS_LABEL, type Resources, type ShownLevels } from "@optizzz/game/site-links/demandes";
import type { Feature } from "../feature";
import type { ConvoyFillAnswer, DemandesAnswer, DemandeView } from "./demandes";
import { askEnvois } from "./messages";

const ALLIANCE_DEMANDES_STYLE = `
.optizzz-alliance-demandes { margin: var(--optizzz-space-4) 0; }
.optizzz-alliance-demandes .optizzz-callout { margin-top: var(--optizzz-space-3); }`;

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string) => {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

/** « 5 000 nourriture et 40 000 matériaux », « 40 000 matériaux », « rien ». */
function resourcesText({ food, materials }: Resources): string {
  const parts = [
    ...(food > 0 ? [`${formatAmount(food)} nourriture`] : []),
    ...(materials > 0 ? [`${formatAmount(materials)} matériaux`] : []),
  ];
  return parts.length === 0 ? "rien" : parts.join(" et ");
}

/** « 40 000 matériaux (80 000 en route) ». */
function remainingText(demande: DemandeView): string {
  const onWay = demande.onWay.food + demande.onWay.materials;
  return `${resourcesText(demande.remaining)}${onWay > 0 ? ` (${formatAmount(onWay)} en route)` : ""}`;
}

/**
 * The panel « Demandes de l'alliance », or null without an account or a space. `send` is « Envoyer un convoi » on a
 * Demande still waiting for convoys.
 */
export function allianceDemandesPanel(
  doc: Document,
  answer: DemandesAnswer,
  send: (id: string) => void,
): HTMLElement | null {
  if (answer.problem === "unlinked" || answer.problem === "no-space") return null;
  const panel = el(doc, "section", "optizzz-alliance-demandes optizzz-panel optizzz-panel--inset");
  panel.append(el(doc, "h3", "optizzz-panel-title", "Demandes de l'alliance"));
  if (answer.problem !== null) {
    panel.append(
      el(doc, "p", "optizzz-note", "Ouvrez votre espace sur optizzz.fr pour lire les Demandes de l'alliance ici."),
    );
    return panel;
  }
  if (answer.toValidate > 0) {
    const line = el(doc, "p");
    const link = el(
      doc,
      "a",
      undefined,
      `${String(answer.toValidate)} Demande${answer.toValidate > 1 ? "s" : ""} à valider sur optizzz.fr`,
    );
    link.href = answer.spaceUrl;
    link.target = "_blank";
    link.rel = "noopener";
    line.append(link);
    panel.append(line);
  }
  if (answer.open.length === 0) {
    panel.append(el(doc, "p", "optizzz-note", "Aucune Demande validée n'attend de convoi."));
  } else {
    const table = el(doc, "table", "optizzz-table optizzz-table--dense");
    const head = el(doc, "tr");
    for (const text of ["Demandeur", "Priorité", "Demande", "Reste à envoyer", "État", ""]) {
      const th = el(doc, "th", undefined, text);
      th.scope = "col";
      head.append(th);
    }
    const thead = el(doc, "thead");
    thead.append(head);
    const body = el(doc, "tbody");
    for (const demande of answer.open) {
      const row = el(doc, "tr");
      const who = el(doc, "td");
      const link = el(doc, "a", undefined, demande.requester);
      link.href = `Membre.php?Pseudo=${encodeURIComponent(demande.requester)}`;
      who.append(link);
      const status = el(doc, "td", demande.status === "covered" ? "optizzz-muted" : undefined);
      status.textContent = STATUS_LABEL[demande.status];
      const action = el(doc, "td");
      if (demande.status === "validated") {
        const button = el(doc, "button", undefined, "Envoyer un convoi");
        button.type = "button";
        button.addEventListener("click", () => {
          send(demande.id);
        });
        action.append(button);
      }
      row.append(
        who,
        el(doc, "td", undefined, demande.priorite),
        el(doc, "td", undefined, demande.label),
        el(doc, "td", undefined, remainingText(demande)),
        status,
        action,
      );
      body.append(row);
    }
    table.append(thead, body);
    const scroll = el(doc, "div", "optizzz-scroll");
    scroll.append(table);
    panel.append(scroll);
  }
  if (answer.mine.length > 0)
    panel.append(
      el(
        doc,
        "p",
        undefined,
        `Vos Demandes : ${answer.mine.map((d) => `${d.label} (${STATUS_LABEL[d.status]})`).join(", ")}.`,
      ),
    );
  panel.append(
    el(
      doc,
      "p",
      "optizzz-note",
      "Classées par Priorité, la plus basse d'abord : combien de jours de sa propre production le demandeur a déjà reçus sur 30 jours (le détail est sur optizzz.fr). Le reste à envoyer déduit les convois déjà partis pour la Demande, d'après la dernière relève d'optizzz.fr. « Envoyer un convoi » remplit le formulaire ci-dessus : c'est vous qui le lancez.",
    ),
  );
  return panel;
}

/**
 * Fills commerce.php's form: recipient, nourriture, matériaux, and the hidden fields the game's script reads them
 * into, with the events the game and the convoy calculator listen to. Never submits it. False without the form.
 */
export function fillConvoyForm(doc: Document, fill: Resources & { recipient: string }): boolean {
  const input = (id: string) => doc.getElementById(id) as HTMLInputElement | null;
  const recipient = input("pseudo_convoi");
  const food = input("input_nbNourriture");
  const materials = input("input_nbMateriaux");
  if (!recipient || !food || !materials) return false;
  const set = (field: HTMLInputElement, value: string) => {
    field.value = value;
    for (const type of ["input", "keyup", "change"])
      field.dispatchEvent(new (type === "keyup" ? KeyboardEvent : Event)(type, { bubbles: true }));
  };
  set(recipient, fill.recipient);
  set(food, String(fill.food));
  set(materials, String(fill.materials));
  const hidden = (id: string, value: number) => {
    const field = input(id);
    if (field) field.value = String(value);
  };
  hidden("nbNourriture", fill.food);
  hidden("nbMateriaux", fill.materials);
  return true;
}

/** What « Envoyer un convoi » tells the player, a sentence each. */
export function convoyFilledNote(answer: Extract<ConvoyFillAnswer, { ok: true }>): string[] {
  return [
    `Formulaire rempli pour la Demande de ${answer.recipient} (${answer.label}) : ${resourcesText(answer)}. Vérifiez-le, puis cliquez vous-même « Lancer le convoi ».`,
    ...(answer.short ? ["Vous avez moins que ce qui reste à envoyer : le formulaire en prend ce que vous avez."] : []),
    ...(answer.attaches
      ? []
      : ["Cochez « Convois » dans Fonctionnalités › Compte Optizzz pour que ce convoi compte pour la Demande."]),
  ];
}

/** The levels and works construction.php or laboratoire.php shows, or null on another page. */
export function shownLevelsOf(doc: Document, path: string, now: Date): ShownLevels | null {
  const levels =
    path === "/construction.php"
      ? readBuildingLevels(doc)
      : path === "/laboratoire.php"
        ? readResearchLevels(doc)
        : null;
  if (!levels) return null;
  const works = readWorkQueue(doc, now).items.map((item) => ({ name: item.name, level: item.targetLevel }));
  return { levels, works };
}

/** « Envoyer un convoi »: asks the background, fills the form, and says what it did above the form. */
async function sendConvoy(id: string, panel: HTMLElement | null): Promise<void> {
  const stock = readStock(document);
  const answer = await askEnvois<ConvoyFillAnswer>({
    type: "optizzz-envois",
    action: "demande-convoy",
    origin: location.origin,
    id,
    stock: stock && { food: stock.food, materials: stock.materials },
  });
  if (!answer) return;
  const notice = document.createElement("div");
  notice.setAttribute("role", "status");
  if (answer.ok && fillConvoyForm(document, answer)) {
    notice.className = "optizzz-callout optizzz-callout--success";
    for (const sentence of convoyFilledNote(answer)) notice.append(el(document, "p", undefined, sentence));
  } else {
    notice.className = "optizzz-callout optizzz-callout--warning";
    notice.textContent = answer.ok ? "Le formulaire de convoi est introuvable sur cette page." : answer.message;
  }
  document.querySelector(".optizzz-demande-notice")?.remove();
  notice.classList.add("optizzz-demande-notice");
  const form = document.getElementById("pseudo_convoi")?.closest("form");
  if (form) form.before(notice);
  else panel?.append(notice);
  notice.scrollIntoView({ block: "nearest" });
}

/** commerce.php: the alliance's Demandes, and the form filled for the one named in the address, if any. */
export const allianceDemandes: Feature = {
  id: "alliance-demandes",
  toggle: "optizzz-account",
  matches: (url) => url.pathname.toLowerCase() === "/commerce.php",
  async run() {
    if (!document.getElementById("pseudo_convoi")) return;
    const asked = demandeIdOfHash(location.hash);
    // Opened from optizzz.fr: the fragment is read once, then gone (a reload does not fill the form again).
    if (asked) history.replaceState(null, "", location.pathname + location.search);
    const answer = await askEnvois<DemandesAnswer>({
      type: "optizzz-envois",
      action: "demandes",
      origin: location.origin,
    });
    if (!answer) return;
    let panel: HTMLElement | null = null;
    panel = allianceDemandesPanel(document, answer, (id) => {
      void sendConvoy(id, panel);
    });
    if (panel) {
      const style = document.createElement("style");
      style.textContent = ALLIANCE_DEMANDES_STYLE;
      document.head.append(style);
      const centre = document.getElementById("centre");
      const convoys = centre?.querySelector(".optizzz-alliance-convoys");
      const bottom = centre?.querySelector(":scope > .Bas");
      if (convoys) convoys.before(panel);
      else if (bottom) bottom.before(panel);
      else (centre ?? document.body).append(panel);
    }
    if (asked) await sendConvoy(asked, panel);
  },
};

/** construction.php and laboratoire.php: what they show reached closes the player's own Demandes. */
export const demandeLevels: Feature = {
  id: "demande-levels",
  toggle: "optizzz-account",
  matches: (url) => ["/construction.php", "/laboratoire.php"].includes(url.pathname.toLowerCase()),
  run() {
    if (!document.getElementById("pseudo")) return;
    const shown = shownLevelsOf(document, location.pathname.toLowerCase(), new Date());
    if (!shown || Object.keys(shown.levels).length === 0) return;
    void askEnvois({ type: "optizzz-envois", action: "levels-seen", origin: location.origin, shown }).catch(() => null);
  },
};
