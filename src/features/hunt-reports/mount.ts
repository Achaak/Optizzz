import type { Levels } from "@/game/army/units";
import { formatNumber } from "@/utils/number-format";
import {
  isOffPrediction,
  predictLosses,
  readConversation,
  summarize,
  toReportLine,
  type HuntFight,
  type PredictedLosses,
} from "./report";

export const HUNT_REPORT_STYLE = `
.optizzz-hunt-report { margin: 6px 0 10px; }
.optizzz-hunt-report-tools { display: flex; gap: 8px; margin-bottom: 6px; }
.optizzz-hunt-report table { width: 100%; border-collapse: collapse; }
.optizzz-hunt-report th, .optizzz-hunt-report td { border: 1px solid #000; padding: 2px 6px; text-align: left; }
.optizzz-hunt-report td:nth-child(n + 5) { text-align: right; white-space: nowrap; }
.optizzz-hunt-report tfoot td { font-weight: bold; }
.optizzz-hunt-report-off td { background: rgba(200, 0, 0, 0.15); }
.optizzz-hunt-report-yield { margin: 4px 0 0; font-style: italic; }`;

type Copy = (text: string) => Promise<void>;

const writeArmy = (sent: Record<string, number>) =>
  Object.entries(sent)
    .map(([key, count]) => `${formatNumber(count)} ${key}`)
    .join(", ");

const writePrey = (prey: Record<string, number>) =>
  Object.entries(prey)
    .map(([name, count]) => `${formatNumber(count)} ${name}`)
    .join(", ");

function writeLosses(fight: HuntFight, predicted: PredictedLosses | null): string {
  if (!predicted) return String(fight.antsKilled);
  const wounded =
    predicted.wounded > 0 ? `, +${String(predicted.wounded)} blessée${predicted.wounded > 1 ? "s" : ""}` : "";
  return `${String(fight.antsKilled)} (prévu ${String(predicted.dead)}${wounded})`;
}

const button = (doc: Document, className: string, text: string, onClick: () => void) => {
  const element = doc.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
};

/**
 * Table of the fights above an opened « Chasses » conversation; the game's text is folded away (only hidden, so
 * its own links keep working). `levels` null: shield unknown, no prediction. Call `update` when fights are added.
 */
export function mountHuntReport(
  conversation: Element,
  levels: Pick<Levels, "shield" | "cochineal"> | null,
  copy: Copy,
) {
  const doc = conversation.ownerDocument;
  const cell = conversation.querySelector(":scope > td");
  const gameTable = cell?.querySelector<HTMLElement>(":scope > table") ?? null;

  const block = doc.createElement("div");
  block.className = "optizzz-hunt-report";
  const table = doc.createElement("table");
  const lossesHeader = levels
    ? `Pertes (prévu avec Bouclier ${String(levels.shield)})`
    : "Pertes (Bouclier inconnu : passez au Laboratoire)";
  table.innerHTML = `<thead><tr><th>Heure</th><th>Armée envoyée</th><th>Proies</th><th></th>
    <th>Promues</th><th>cm²</th><th>Nourriture</th></tr></thead><tbody></tbody><tfoot></tfoot>`;
  const lossesCell = table.querySelector("th:nth-child(4)");
  if (lossesCell) lossesCell.textContent = lossesHeader;
  const yieldLine = doc.createElement("p");
  yieldLine.className = "optizzz-hunt-report-yield";

  let fights: HuntFight[] = [];
  const tools = doc.createElement("div");
  tools.className = "optizzz-hunt-report-tools";
  const copyButton = button(doc, "optizzz-hunt-report-copy", "Copier les combats", () => {
    copy(fights.map(toReportLine).join("\n"))
      .then(() => (copyButton.textContent = "Copié !"))
      .catch(() => (copyButton.textContent = "Copie impossible"));
  });
  const textButton = button(doc, "optizzz-hunt-report-text", "Voir le texte du jeu", () => {
    if (!gameTable) return;
    gameTable.hidden = !gameTable.hidden;
    textButton.textContent = gameTable.hidden ? "Voir le texte du jeu" : "Masquer le texte du jeu";
  });
  tools.append(copyButton, textButton);

  // The game's « Voir les messages précédents » sits in its hidden table.
  const olderLink = () =>
    [...(gameTable?.querySelectorAll("a") ?? [])].find((link) => link.textContent.includes("messages précédents"));
  const olderButton = button(doc, "optizzz-hunt-report-older", "Voir les combats précédents", () =>
    olderLink()?.click(),
  );
  tools.append(olderButton);

  block.append(tools, table, yieldLine);
  cell?.prepend(block);
  if (gameTable) gameTable.hidden = true;

  const update = () => {
    fights = readConversation(conversation);
    const rows = fights.map((fight) => ({ fight, predicted: levels ? predictLosses(fight, levels) : null }));
    table.querySelector("tbody")?.replaceChildren(
      ...rows.map(({ fight, predicted }) => {
        const row = doc.createElement("tr");
        if (predicted && isOffPrediction(fight, predicted)) row.className = "optizzz-hunt-report-off";
        for (const text of [
          fight.date,
          writeArmy(fight.sent),
          writePrey(fight.prey),
          writeLosses(fight, predicted),
          formatNumber(fight.promoted),
          formatNumber(fight.fieldWon),
          formatNumber(fight.food),
        ]) {
          const td = doc.createElement("td");
          td.textContent = text;
          row.append(td);
        }
        return row;
      }),
    );

    const summary = summarize(rows);
    const promoted = fights.reduce((sum, fight) => sum + fight.promoted, 0);
    const footer = doc.createElement("tr");
    const off = summary.offPrediction > 0 ? ` (${String(summary.offPrediction)} loin du prévu)` : "";
    for (const text of [
      `Total : ${String(summary.fights)} combat${summary.fights > 1 ? "s" : ""}`,
      "",
      "",
      `${formatNumber(summary.antsKilled)}${off}`,
      formatNumber(promoted),
      formatNumber(summary.fieldWon),
      formatNumber(summary.food),
    ]) {
      const td = doc.createElement("td");
      td.textContent = text;
      footer.append(td);
    }
    table.querySelector("tfoot")?.replaceChildren(footer);
    yieldLine.textContent =
      summary.fieldPerAntLost === null
        ? "Aucune perte"
        : `${summary.fieldPerAntLost.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} cm² par fourmi perdue`;
    olderButton.hidden = !olderLink();
  };
  update();
  return { update, messageCount: () => conversation.querySelectorAll('tr[id^="message_"]').length };
}
