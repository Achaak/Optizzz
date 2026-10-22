import type { ConvoyHistory } from "@/data/convoy-history";
import { formatAmount, showExactAmount } from "@optizzz/game/format/number-format";
import { formatDateTime, formatPastTime } from "@optizzz/game/format/time-format";
import type { Copy } from "@/utils/on-way-list";
import { convoySummaryText, summarizeConvoys, type ConvoyLoad, type PlayerConvoys } from "./history";

export const CONVOY_HISTORY_STYLE = `
.optizzz-convoy-history { margin: var(--optizzz-space-4) 0; }
.optizzz-convoy-history-parts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20em, 1fr));
  gap: var(--optizzz-space-4);
  align-items: start;
}
.optizzz-convoy-history .optizzz-table { min-width: 18em; }
.optizzz-convoy-history .optizzz-table .optizzz-num { text-align: right; }`;

const DAY = 24 * 3600_000;

/** The periods offered, 7 days first chosen. */
const PERIODS = [
  { label: "24 h", ms: DAY },
  { label: "7 jours", ms: 7 * DAY },
  { label: "30 jours", ms: 30 * DAY },
] as const;

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string) => {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

/** One part (delivered or received): a table of players, a total when there are several; a sentence when none. */
function part(doc: Document, title: string, none: string, players: PlayerConvoys[], sum: ConvoyLoad): HTMLElement {
  const section = el(doc, "section");
  const heading = el(doc, "h4", "optizzz-subtitle", title);
  if (players.length === 0) {
    section.append(heading, el(doc, "p", "optizzz-note", none));
    return section;
  }
  const table = el(doc, "table", "optizzz-table optizzz-table--dense");
  const head = el(doc, "tr");
  for (const [text, numeric] of [
    ["Joueur", false],
    ["Nourriture", true],
    ["Matériaux", true],
  ] as const) {
    const th = el(doc, "th", numeric ? "optizzz-num" : undefined, text);
    th.scope = "col";
    head.append(th);
  }
  const row = (name: Node | string, load: ConvoyLoad) => {
    const tr = el(doc, "tr");
    const first = el(doc, "td");
    first.append(name);
    const amount = (value: number) => {
      const td = el(doc, "td", "optizzz-num", formatAmount(value));
      showExactAmount(td, value);
      return td;
    };
    tr.append(first, amount(load.food), amount(load.materials));
    return tr;
  };
  const body = el(doc, "tbody");
  for (const player of players) {
    const link = el(doc, "a", undefined, player.player);
    link.href = `Membre.php?Pseudo=${encodeURIComponent(player.player)}`;
    body.append(row(link, player));
  }
  table.append(el(doc, "thead"), body);
  table.tHead?.append(head);
  if (players.length > 1) {
    const foot = el(doc, "tfoot");
    foot.append(row(el(doc, "strong", undefined, "Total"), sum));
    table.append(foot);
  }
  const scroll = el(doc, "div", "optizzz-scroll");
  scroll.append(table);
  section.append(heading, scroll);
  return section;
}

/**
 * On commerce.php, before the bottom of the page: the convoys delivered and received per player over a period read
 * in the inbox, and a button that copies them as text. Says it is reading until `update` gives what is kept (null:
 * the inbox could not be read and nothing is kept).
 */
export function mountConvoyHistory(doc: Document, clock: () => Date, copy: Copy) {
  const panel = el(doc, "div", "optizzz-convoy-history optizzz-panel optizzz-panel--inset");
  const content = el(doc, "div");
  panel.append(el(doc, "h3", "optizzz-panel-title", "Convois livrés et reçus"), content);
  content.append(el(doc, "p", "optizzz-note", "Lecture de la messagerie…"));
  const centre = doc.getElementById("centre");
  const bottom = centre?.querySelector(":scope > .Bas");
  if (bottom) bottom.before(panel);
  else (centre ?? doc.body).append(panel);

  let period: (typeof PERIODS)[number] = PERIODS[1];
  let history: ConvoyHistory | null = null;
  const COPY_LABEL = "Copier";
  let copyReset: ReturnType<typeof setTimeout> | undefined;

  const render = () => {
    if (!history) {
      content.replaceChildren(
        el(
          doc,
          "p",
          "optizzz-callout optizzz-callout--warning",
          "La messagerie n'a pas pu être lue : réessayez plus tard.",
        ),
      );
      return;
    }
    const kept = history;
    const to = clock();
    const from = new Date(to.getTime() - period.ms);
    const summary = summarizeConvoys(kept.messages, from, to);

    const tools = el(doc, "div", "optizzz-toolbar");
    const choices = el(doc, "span", "optizzz-segmented");
    choices.setAttribute("role", "group");
    choices.setAttribute("aria-label", "Période");
    for (const choice of PERIODS) {
      const button = el(doc, "button", undefined, choice.label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(choice === period));
      button.addEventListener("click", () => {
        period = choice;
        render();
      });
      choices.append(button);
    }
    const copyButton = el(doc, "button", undefined, COPY_LABEL);
    copyButton.type = "button";
    copyButton.title = "Copier le récapitulatif de la période en texte, une ligne par joueur";
    copyButton.addEventListener("click", () => {
      const done = (label: string) => {
        copyButton.textContent = label;
        clearTimeout(copyReset);
        copyReset = setTimeout(() => (copyButton.textContent = COPY_LABEL), 3000);
      };
      copy(convoySummaryText(summary, from, to, kept.coveredFrom))
        .then(() => {
          done("Copié !");
        })
        .catch(() => {
          done("Copie impossible");
        });
    });
    tools.append(choices, copyButton);

    const missing =
      kept.coveredFrom.getTime() > from.getTime()
        ? [
            el(
              doc,
              "p",
              "optizzz-callout optizzz-callout--warning",
              `⚠ Des convois d'avant le ${formatDateTime(kept.coveredFrom)} peuvent manquer : le jeu efface ses ` +
                "messages au bout d'une semaine, et Optizzz ne les avait pas encore lus.",
            ),
          ]
        : [];

    // Side by side when there is room: the page is wide and a table of three columns is not.
    const parts = el(doc, "div", "optizzz-convoy-history-parts");
    parts.append(
      part(doc, "Livrés", "Aucun convoi livré sur la période.", summary.sent, summary.sentTotal),
      part(doc, "Reçus", "Aucun convoi reçu sur la période.", summary.received, summary.receivedTotal),
    );
    content.replaceChildren(
      tools,
      ...missing,
      parts,
      el(
        doc,
        "p",
        "optizzz-note",
        `D'après les messages « Convoi livré » et « Convoi reçu » de la messagerie, lue ${formatPastTime(kept.readAt, to)}. ` +
          "Le jeu regroupe parfois plusieurs livraisons au même joueur : elles comptent à l'heure de la dernière.",
      ),
    );
  };

  return {
    update(kept: ConvoyHistory | null) {
      history = kept;
      render();
    },
  };
}
