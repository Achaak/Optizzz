import { unitLabel, UNITS, type Levels } from "@/game/army/units";
import { formatNumber } from "@/utils/number-format";
import { formatDuration } from "@/utils/time-format";
import {
  armyBalance,
  isOffPrediction,
  predictLosses,
  readConversation,
  summarize,
  toReportLine,
  unknownEntries,
  type HuntFight,
  type ArmyBalance,
  type PredictedLosses,
} from "./report";
import { htmlElement } from "@/utils/html";

export const HUNT_REPORT_STYLE = `
.optizzz-hunt-report { margin: var(--optizzz-space-3) 0 10px; }
.optizzz-hunt-report-tools { margin-top: 0; }
.optizzz-hunt-report td:nth-child(n + 4),
.optizzz-hunt-report thead th:nth-child(n + 4),
.optizzz-hunt-report tfoot td:nth-child(n + 2) { text-align: right; white-space: nowrap; }
.optizzz-hunt-report-off td { background: var(--optizzz-danger-bg); }
.optizzz-hunt-report-balance p { margin: var(--optizzz-space-1) 0; }`;

type Copy = (text: string) => Promise<void>;

/** « 1 921 JSN » never cut between the number and its unit. */
const unbreakable = (text: string) => text.replace(/ /g, "\u00a0");

const writeArmy = (sent: Record<string, number>) =>
  Object.entries(sent)
    .map(([key, count]) => unbreakable(`${formatNumber(count)} ${unitLabel(key)}`))
    .join(", ");

/** The full names, for the cell's tooltip: the keys are short. */
const armyNames = (sent: Record<string, number>) =>
  Object.entries(sent)
    .map(([key, count]) => `${formatNumber(count)} ${UNITS.find((unit) => unit.key === key)?.name ?? key}`)
    .join(", ");

const writePrey = (prey: Record<string, number>) =>
  Object.entries(prey)
    .map(([name, count]) => unbreakable(`${formatNumber(count)} ${name}`))
    .join(", ");

/** « 198 +1 blessée », the wounded muted: what the engine predicts; the reason when it cannot. */
function writePrediction(cell: HTMLElement, predicted: PredictedLosses | null, unknown: string[]): void {
  if (unknown.length > 0) cell.textContent = `inconnu : ${unknown.join(", ")}`;
  else if (!predicted) cell.textContent = "—";
  else {
    cell.textContent = formatNumber(predicted.dead);
    if (predicted.wounded <= 0) return;
    const wounded = cell.ownerDocument.createElement("span");
    wounded.className = "optizzz-muted";
    wounded.textContent = ` +${String(predicted.wounded)} blessée${predicted.wounded > 1 ? "s" : ""}`;
    cell.append(wounded);
  }
}

const writeUnits = (counts: Record<string, number>, sign = "") =>
  Object.entries(counts)
    .map(([key, count]) => unbreakable(`${sign}${formatNumber(count)} ${unitLabel(key)}`))
    .join(", ");

const signed = (value: number) => `${value < 0 ? "−" : "+"}${formatNumber(Math.abs(value))}`;

/** What the fights cost and taught the army, in attack « hors bonus » and, when the speed is known, laying time. */
function writeBalance(balance: ArmyBalance, layingSpeed: number | null): [string, string][] {
  const laying =
    layingSpeed === null ? "" : `${formatDuration(balance.deadLayingSeconds * layingSpeed * 1000)} de ponte et `;
  const losses =
    balance.deadAttack > 0
      ? `${writeUnits(balance.dead)}, soit ${laying}${signed(-balance.deadAttack)} dégâts hors bonus.`
      : "aucune.";
  const experience =
    balance.promotedAttack > 0
      ? `${writeUnits(balance.promoted, "+")}, soit ${signed(balance.promotedAttack)} dégâts hors bonus.`
      : "aucune promotion.";
  return [
    ["Pertes", losses],
    ["Expérience", experience],
    ["Bilan", `${signed(balance.promotedAttack - balance.deadAttack)} dégâts hors bonus.`],
  ];
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
  /** Fights in the whole conversation, read in its title; null when unknown. */
  expeditions: number | null = null,
  /** The queen's laying speed (data/laying.ts); null when unknown: the losses are then not given in laying time. */
  layingSpeed: number | null = null,
) {
  const doc = conversation.ownerDocument;
  const cell = conversation.querySelector(":scope > td");
  const gameTable = cell?.querySelector<HTMLElement>(":scope > table") ?? null;

  const block = doc.createElement("div");
  block.className = "optizzz-hunt-report";
  const table = htmlElement(
    doc,
    "table",
    `<table class="optizzz-table optizzz-table--framed"><thead><tr><th>Date</th><th>Armée envoyée</th><th>Proies</th>
    <th>Pertes</th><th>Prévu</th><th>Promues</th><th>cm²</th><th>Nourriture</th></tr></thead><tbody></tbody><tfoot></tfoot></table>`,
  );
  // Said under the table, not in a header: « prévu avec Bouclier 6 » alone was not understood.
  const predictionNote = doc.createElement("p");
  predictionNote.className = "optizzz-hunt-report-prediction optizzz-note";
  const writePredictionNote = (anyOff: boolean) =>
    levels
      ? `Prévu : les pertes que calcule le simulateur d'Optizzz, avec votre Bouclier ${String(levels.shield)} d'aujourd'hui` +
        `${anyOff ? " (⚠ : loin des pertes réelles)" : ""}. Les blessées ont perdu plus de la moitié de leur vie : ` +
        "le rapport ne les compte pas, mais elles ne reviennent pas."
      : "Prévu : passez au Laboratoire pour qu'Optizzz connaisse votre Bouclier et prévoie les pertes.";
  const balanceNote = doc.createElement("div");
  balanceNote.className = "optizzz-hunt-report-balance";

  let fights: HuntFight[] = [];
  const tools = doc.createElement("div");
  tools.className = "optizzz-hunt-report-tools optizzz-toolbar";
  const COPY_LABEL = "Copier les combats";
  let copyReset: ReturnType<typeof setTimeout> | undefined;
  const copyButton = button(doc, "optizzz-hunt-report-copy", COPY_LABEL, () => {
    const done = (label: string) => {
      copyButton.textContent = label;
      clearTimeout(copyReset);
      copyReset = setTimeout(() => (copyButton.textContent = COPY_LABEL), 3000);
    };
    copy(fights.map(toReportLine).join("\n"))
      .then(() => {
        done("Copié !");
      })
      .catch(() => {
        done("Copie impossible");
      });
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
  // The game's own controls (« Corbeille ») sit in the table folded away: they stay at hand in the toolbar.
  for (const control of gameTable?.querySelectorAll<HTMLElement>(
    "a, button, input[type=button], input[type=submit], img",
  ) ?? []) {
    const label = `${control.textContent} ${control.getAttribute("value") ?? ""} ${control.getAttribute("alt") ?? ""} ${control.title}`;
    if (/corbeille/i.test(label)) tools.append(control.closest("a, button") ?? control);
  }

  block.append(tools, table, balanceNote, predictionNote);
  cell?.prepend(block);
  if (gameTable) gameTable.hidden = true;

  const update = () => {
    fights = readConversation(conversation);
    const rows = fights.map((fight) => {
      const unknown = unknownEntries(fight);
      return { fight, unknown, predicted: levels && unknown.length === 0 ? predictLosses(fight, levels) : null };
    });
    table.querySelector("tbody")?.replaceChildren(
      ...rows.map(({ fight, predicted, unknown }) => {
        const row = doc.createElement("tr");
        const off = predicted !== null && isOffPrediction(fight, predicted);
        if (off) row.className = "optizzz-hunt-report-off";
        for (const text of [
          fight.date,
          writeArmy(fight.sent),
          writePrey(fight.prey),
          // Written, not only coloured: the row's red alone is lost with a colour blindness.
          `${off ? "⚠ " : ""}${formatNumber(fight.antsKilled)}`,
          "",
          formatNumber(fight.promoted),
          formatNumber(fight.fieldWon),
          formatNumber(fight.food),
        ]) {
          const td = doc.createElement("td");
          td.textContent = text;
          row.append(td);
        }
        const predictionCell = row.cells[4];
        if (predictionCell) writePrediction(predictionCell, predicted, unknown);
        const armyCell = row.cells[1];
        if (armyCell) armyCell.title = armyNames(fight.sent);
        return row;
      }),
    );

    const summary = summarize(rows);
    const promoted = fights.reduce((sum, fight) => sum + fight.promoted, 0);
    const off = summary.offPrediction > 0;
    // Predicted total only when every fight has a prediction: a partial sum would read as a gap.
    const predictedDead = rows.every((row) => row.predicted)
      ? formatNumber(rows.reduce((sum, row) => sum + (row.predicted?.dead ?? 0), 0))
      : "";
    const footer = doc.createElement("tr");
    for (const text of [
      `Total : ${String(summary.fights)} combat${summary.fights > 1 ? "s" : ""}${
        expeditions !== null && expeditions > summary.fights ? ` affichés sur ${formatNumber(expeditions)}` : ""
      }${off ? ` · ⚠ ${String(summary.offPrediction)} loin du prévu` : ""}`,
      formatNumber(summary.antsKilled),
      predictedDead,
      formatNumber(promoted),
      formatNumber(summary.fieldWon),
      formatNumber(summary.food),
    ]) {
      const td = doc.createElement("td");
      td.textContent = text;
      footer.append(td);
    }
    const label = footer.cells[0];
    if (label) label.colSpan = 3;
    // A single fight: its row already says it all.
    table.querySelector("tfoot")?.replaceChildren(...(summary.fights > 1 ? [footer] : []));
    predictionNote.textContent = writePredictionNote(off);
    balanceNote.replaceChildren(
      ...writeBalance(armyBalance(fights), layingSpeed).map(([label, text]) => {
        const paragraph = doc.createElement("p");
        const strong = doc.createElement("strong");
        strong.textContent = `${label} :`;
        paragraph.append(strong, ` ${text}`);
        return paragraph;
      }),
    );
    olderButton.hidden = !olderLink();
  };
  update();
  return { update, messageCount: () => conversation.querySelectorAll('tr[id^="message_"]').length };
}
