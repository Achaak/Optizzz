// In the game, from the Envois (docs/features/site-envois.md, « Vues »): on commerce.php, the alliance's convoys on
// their way to the player, as the members' extensions sent them to the Alliance Space; and, on every game page, the
// relève of the site. The background holds the Clé d'alliance and answers already decrypted: nothing here reads the
// site, and nothing is asked of the game.
import { formatAmount, showExactAmount } from "@optizzz/game/format/number-format";
import { formatEndTime } from "@optizzz/game/format/time-format";
import type { Feature } from "../feature";
import type { IncomingAnswer } from "./envois";
import { askEnvois } from "./messages";

const ALLIANCE_CONVOYS_STYLE = `
.optizzz-alliance-convoys { margin: var(--optizzz-space-4) 0; }
.optizzz-alliance-convoys .optizzz-num { text-align: right; }`;

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string) => {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

/**
 * The panel « Convois de l'alliance en route vers vous », or null when there is nothing to say: not linked, or not in
 * an Alliance Space.
 */
export function allianceConvoysPanel(doc: Document, answer: IncomingAnswer, now: Date): HTMLElement | null {
  if (answer.problem === "unlinked" || answer.problem === "no-space") return null;
  const panel = el(doc, "section", "optizzz-alliance-convoys optizzz-panel optizzz-panel--inset");
  panel.append(el(doc, "h3", "optizzz-panel-title", "Convois de l'alliance en route vers vous"));
  if (answer.problem === "no-key") {
    panel.append(
      el(doc, "p", "optizzz-note", "Ouvrez votre espace sur optizzz.fr pour lire les convois de l'alliance ici."),
    );
    return panel;
  }
  if (answer.convoys.length === 0) {
    panel.append(el(doc, "p", "optizzz-note", "Aucun convoi d'un membre en route vers vous."));
  } else {
    const table = el(doc, "table", "optizzz-table optizzz-table--dense");
    const head = el(doc, "tr");
    for (const [text, numeric] of [
      ["De", false],
      ["Nourriture", true],
      ["Matériaux", true],
      ["Arrivée", false],
    ] as const) {
      const th = el(doc, "th", numeric ? "optizzz-num" : undefined, text);
      th.scope = "col";
      head.append(th);
    }
    const thead = el(doc, "thead");
    thead.append(head);
    const body = el(doc, "tbody");
    for (const convoy of answer.convoys) {
      const row = el(doc, "tr");
      const from = el(doc, "td");
      const link = el(doc, "a", undefined, convoy.from);
      link.href = `Membre.php?Pseudo=${encodeURIComponent(convoy.from)}`;
      from.append(link);
      const amount = (value: number) => {
        const td = el(doc, "td", "optizzz-num", formatAmount(value));
        showExactAmount(td, value);
        return td;
      };
      row.append(from, amount(convoy.food), amount(convoy.materials));
      row.append(el(doc, "td", undefined, formatEndTime(new Date(convoy.at), now)));
      body.append(row);
    }
    table.append(thead, body);
    const scroll = el(doc, "div", "optizzz-scroll");
    scroll.append(table);
    panel.append(scroll);
  }
  panel.append(
    el(
      doc,
      "p",
      "optizzz-note",
      "Seuls les convois des membres qui les envoient à Optizzz apparaissent ici, d'après la dernière relève d'optizzz.fr.",
    ),
  );
  return panel;
}

/** commerce.php: the alliance's convoys on their way to the player, before the bottom of the page. */
export const allianceConvoys: Feature = {
  id: "alliance-convoys",
  toggle: "optizzz-account",
  matches: (url) => url.pathname.toLowerCase() === "/commerce.php",
  async run() {
    if (!document.getElementById("pseudo_convoi")) return;
    const answer = await askEnvois<IncomingAnswer>({
      type: "optizzz-envois",
      action: "incoming",
      origin: location.origin,
    });
    if (!answer) return;
    const panel = allianceConvoysPanel(document, answer, new Date());
    if (!panel) return;
    const style = document.createElement("style");
    style.textContent = ALLIANCE_CONVOYS_STYLE;
    document.head.append(style);
    const centre = document.getElementById("centre");
    const history = centre?.querySelector(".optizzz-convoy-history");
    const bottom = centre?.querySelector(":scope > .Bas");
    if (history) history.before(panel);
    else if (bottom) bottom.before(panel);
    else (centre ?? document.body).append(panel);
  },
};

/**
 * Every game page: a game page opened is when the extension reads optizzz.fr again (the relève), and sends what
 * could not leave earlier. The message carries nothing of the page.
 */
export const envoiRelay: Feature = {
  id: "envoi-relay",
  toggle: "optizzz-account",
  matches: () => true,
  run() {
    if (!document.getElementById("pseudo")) return;
    void askEnvois({ type: "optizzz-envois", action: "page-open" }).catch(() => null);
  },
};
