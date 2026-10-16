// The advice in the Armes and Bouclier Thoracique rows of laboratoire.php: a block in the description, folded to its
// verdict. See docs/features/conseils-recherche.md.
import { UNITS, type Army } from "@/game/army/units";
import { formatDecimal, formatNumber as formatSpaced } from "@/utils/number-format";
import { placeInRow } from "@/utils/row-extras";
import { formatDuration, formatPastTime } from "@/utils/time-format";
import { researchAdvice, verdictOf, type Advice, type AdviceStat } from "./advice";

export const ADVICE_STYLE = `
tr.ligneAmelioration:has(.optizzz-advice[open]) > td { vertical-align: top !important; }
.optizzz-advice { margin-top: var(--optizzz-space-3); border: 1px solid var(--optizzz-border-soft); border-left: 3px solid var(--optizzz-border); border-radius: var(--optizzz-radius-small); background: var(--optizzz-surface-tint); font-family: var(--optizzz-font); font-size: var(--optizzz-font-size); line-height: var(--optizzz-line-height); color: var(--optizzz-text); }
.optizzz-advice[data-verdict="research"] { border-left-color: var(--optizzz-success); }
.optizzz-advice[data-verdict="laying"] { border-left-color: var(--optizzz-link); }
.optizzz-advice > summary { padding: var(--optizzz-space-2) var(--optizzz-space-4); font-weight: normal; }
.optizzz-advice-more { margin-left: auto; color: var(--optizzz-link); font-size: var(--optizzz-font-size-small); }
.optizzz-advice[open] .optizzz-advice-more { display: none; }
.optizzz-advice-body { padding: var(--optizzz-space-1) var(--optizzz-space-4) var(--optizzz-space-4); }
.optizzz-advice-body p { margin: var(--optizzz-space-2) 0; }
.optizzz-advice-switch { display: flex; align-items: center; gap: var(--optizzz-space-3); margin: var(--optizzz-space-1) 0 var(--optizzz-space-3); font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
.optizzz-advice-bars { display: grid; gap: var(--optizzz-space-2); margin: var(--optizzz-space-2) 0 var(--optizzz-space-3); }
.optizzz-advice-bar-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 var(--optizzz-space-4); }
.optizzz-advice-bar-research > span { background: var(--optizzz-success); }
.optizzz-advice-value { font-weight: bold; font-variant-numeric: tabular-nums; }
.optizzz-advice-units table { width: auto; margin-top: var(--optizzz-space-2); }
.optizzz-advice-units :is(th, td) { text-align: right; }
.optizzz-advice-units :is(th, td):first-child { text-align: left; }
.optizzz-advice-units tr.optizzz-advice-best td { font-weight: bold; }`;

/** Numbers that never wrap in the middle: « 19 284 » stays on one line. */
const formatNumber = (value: number) => formatSpaced(value).replace(/ /g, "\u00a0");

export type AdvisedResearch = "weapons" | "shield";

/** What the player chose, remembered per server. */
export interface AdvicePrefs {
  open: Partial<Record<AdvisedResearch, boolean>>;
  /** What Armes is compared on: the attack for an attacker, the defense for a defender. */
  weaponsStat: "attack" | "defense";
}

export const DEFAULT_ADVICE_PREFS: AdvicePrefs = { open: {}, weaponsStat: "attack" };

/**
 * Where the army comes from: Armee.php read now, with the troops out (Compte+ lists them); or, when it cannot be
 * read, the garrison last stored, or the last one seen with units when it was empty.
 */
export type ArmySource =
  { kind: "live"; attacks: number; hunts: number; unknown: number } | { kind: "stored"; previous: boolean };

/** Everything read elsewhere than on this page; a message instead when something is missing. */
export type AdviceData =
  | {
      kind: "ready";
      army: Army;
      armyReadAt: Date;
      armySource: ArmySource;
      speed: number;
      layable: readonly string[];
      layingReadAt: Date;
    }
  | { kind: "missing"; message: string };

export interface AdviceRow {
  research: AdvisedResearch;
  /** The level the row's cost leads from (the queued level when one is under way). */
  level: number;
  workers: number;
}

const STATS: Record<AdviceStat, { short: string; long: string }> = {
  hp: { short: "de vie", long: "points de vie" },
  attack: { short: "d'attaque", long: "dégâts en attaque" },
  defense: { short: "de défense", long: "dégâts en défense" },
};

const unitName = (key: string, count: number) => {
  const unit = UNITS.find((candidate) => candidate.key === key);
  return count === 1 ? (unit?.name ?? key) : (unit?.plural ?? key);
};
const percent = (ratio: number) => `${formatNumber(Math.round(ratio * 100))} %`;
const signed = (value: number) => `+${formatNumber(Math.round(value))}`;

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** « +116 % de vie », or « 4,2 × plus de vie » past triple: « +20 982 % » reads badly. */
function more(ratio: number, stat: AdviceStat): string {
  if (ratio < 3) return `${signed((ratio - 1) * 100)} % ${STATS[stat].short}`;
  const times = ratio < 10 ? formatDecimal(ratio) : formatNumber(Math.round(ratio));
  return `${times} × plus ${STATS[stat].short}`;
}

/** The folded line: which is better, by how much. */
export function verdictText(advice: Advice, stat: AdviceStat): string {
  const verdict = verdictOf(advice.edge);
  const { best, edge } = advice;
  if (!best || edge === null) return "Recherche préférable : ce temps ne suffit à pondre aucune unité";
  if (verdict === "even") return "Recherche et ponte se valent (à 5 % près)";
  if (verdict === "research") return `Recherche préférable · ${more(1 + edge, stat)} que la ponte`;
  // The research brings less: say how much more the laying brings, not « −40 % ».
  return `Ponte préférable · ${unitName(best.key, 2)} : ${more(1 / (1 + edge), stat)}`;
}

/**
 * Adds the advice block at the end of the row's `description`, and returns it.
 * `savePrefs` gets each choice of the player: which block is unfolded, what Armes is compared on.
 */
export function mountResearchAdvice(
  description: Element,
  row: AdviceRow,
  data: AdviceData,
  prefs: AdvicePrefs,
  savePrefs: (change: Partial<AdvicePrefs>) => void,
  now: Date,
): HTMLDetailsElement {
  const doc = description.ownerDocument;

  const details = el(doc, "details", "optizzz-advice optizzz-disclosure");
  details.open = prefs.open[row.research] ?? false;
  details.addEventListener("toggle", () => {
    savePrefs({ open: { [row.research]: details.open } });
  });
  placeInRow(description, "optizzz-advice", details);

  const render = () => {
    const stat: AdviceStat = row.research === "shield" ? "hp" : prefs.weaponsStat;
    details.replaceChildren();
    const summary = el(doc, "summary");
    summary.append(el(doc, "span", "optizzz-advice-tag optizzz-tag", "Conseil"));
    details.append(summary);
    if (data.kind === "missing") {
      delete details.dataset.verdict;
      summary.append(el(doc, "span", undefined, data.message));
      details.append(el(doc, "div", "optizzz-advice-body"));
      details.lastElementChild?.append(
        el(
          doc,
          "p",
          "optizzz-advice-note optizzz-note",
          "Le conseil compare la recherche à la ponte d'unités pendant le temps de repondre ses ouvrières.",
        ),
      );
      return;
    }
    const advice = researchAdvice({
      stat,
      level: row.level,
      workers: row.workers,
      army: data.army,
      speed: data.speed,
      layable: data.layable,
    });
    details.dataset.verdict = verdictOf(advice.edge);
    summary.append(
      el(doc, "strong", undefined, verdictText(advice, stat)),
      el(doc, "span", "optizzz-advice-more", "Détails"),
    );
    details.append(
      renderBody(doc, row, advice, stat, data, now, (next) => {
        prefs = { ...prefs, weaponsStat: next };
        savePrefs({ weaponsStat: next });
        render();
      }),
    );
  };
  render();
  return details;
}

function renderBody(
  doc: Document,
  row: AdviceRow,
  advice: Advice,
  stat: AdviceStat,
  data: Extract<AdviceData, { kind: "ready" }>,
  now: Date,
  chooseStat: (stat: "attack" | "defense") => void,
): HTMLElement {
  const body = el(doc, "div", "optizzz-advice-body");

  if (row.research === "weapons") {
    const group = el(doc, "div", "optizzz-advice-switch");
    group.setAttribute("role", "group");
    group.append("Comparer sur :");
    const choices = el(doc, "span", "optizzz-segmented");
    group.append(choices);
    for (const [value, label] of [
      ["attack", "l'attaque"],
      ["defense", "la défense"],
    ] as const) {
      const button = el(doc, "button", undefined, label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(stat === value));
      button.addEventListener("click", () => chooseStat(value));
      choices.append(button);
    }
    body.append(group);
  }

  const { best } = advice;
  const top = Math.max(advice.researchGain, best?.gain ?? 0, 1);
  const bars = el(doc, "div", "optizzz-advice-bars");
  const bar = (label: string, value: number, research: boolean) => {
    const track = el(doc, "div", `optizzz-advice-bar optizzz-bar${research ? " optizzz-advice-bar-research" : ""}`);
    const fill = el(doc, "span");
    fill.style.width = `${String((value / top) * 100)}%`;
    track.append(fill);
    // Label and value above, bar below: fits a phone as well as the wide description.
    const head = el(doc, "div", "optizzz-advice-bar-head");
    head.append(
      el(doc, "span", undefined, label),
      el(doc, "span", "optizzz-advice-value", `${signed(value)} ${STATS[stat].long}`),
    );
    const item = el(doc, "div", "optizzz-advice-bar-item");
    item.append(head, track);
    bars.append(item);
  };
  bar(`Recherche niveau ${String(row.level + 1)}`, advice.researchGain, true);
  if (best) bar(`ou ${formatNumber(best.count)} ${unitName(best.key, best.count)}`, best.gain, false);
  body.append(bars);

  const workers = `${formatNumber(row.workers)} ouvrière${row.workers > 1 ? "s" : ""}`;
  body.append(
    el(
      doc,
      "p",
      undefined,
      best
        ? `La recherche coûte ${workers} : les repondre prend ${formatDuration(advice.layingMs)}, le temps de pondre ${formatNumber(best.count)} ${unitName(best.key, best.count)} à la place.`
        : `La recherche coûte ${workers} : les repondre prend ${formatDuration(advice.layingMs)}, trop peu pour pondre une unité.`,
    ),
  );
  if (best) {
    const wins = advice.armyBase >= advice.breakEven;
    body.append(
      el(
        doc,
        "p",
        undefined,
        `La recherche l'emporte dès ${formatNumber(Math.ceil(advice.breakEven))} ${STATS[stat].long} de base dans l'armée ; ${wins ? "la vôtre en a" : "la vôtre n'en a que"} ${formatNumber(advice.armyBase)}.`,
      ),
    );
  }

  if (advice.options.length > 1) body.append(unitsTable(doc, advice, stat));

  const army = armyNote(data.armySource, data.armyReadAt, now);
  body.append(
    el(
      doc,
      "p",
      "optizzz-advice-note optizzz-note",
      `Gains en ${STATS[stat].long} de base, avec le bonus actuel pour les unités pondues, sans XP ni bonus de Dôme ou de Loge. Repondre les ouvrières coûte aussi ${formatNumber(row.workers * 5)} nourriture ; Laboratoire et Reine travaillent en parallèle. D'après : ${army}, vitesse de ponte lue ${formatPastTime(data.layingReadAt, now)}.`,
    ),
  );
  return body;
}

const count = (n: number, word: string) => `${formatNumber(n)} ${word}${n > 1 ? "s" : ""}`;

function armyNote(source: ArmySource, readAt: Date, now: Date): string {
  if (source.kind === "stored") {
    const what = source.previous ? "dernière armée vue en garnison" : "armée en garnison";
    return `${what} ${formatPastTime(readAt, now)}, troupes en chasse ou en attaque non comptées`;
  }
  const away = [
    source.attacks ? count(source.attacks, "attaque") : "",
    source.hunts ? count(source.hunts, "chasse") : "",
  ].filter(Boolean);
  const counted = away.length ? `garnison, ${away.join(" et ")} en cours` : "garnison";
  const unknown = source.unknown
    ? ` (${count(source.unknown, "sortie")} non comptée${source.unknown > 1 ? "s" : ""} : le jeu n'en montre les troupes qu'avec Compte+)`
    : "";
  return `armée lue ${formatPastTime(readAt, now)}, ${counted}${unknown}`;
}

function unitsTable(doc: Document, advice: Advice, stat: AdviceStat): HTMLElement {
  const units = el(doc, "details", "optizzz-advice-units optizzz-disclosure optizzz-scroll");
  units.append(el(doc, "summary", undefined, "Comparer les unités débloquées"));
  const table = el(doc, "table", "optizzz-table optizzz-table--dense");
  const head = el(doc, "tr");
  for (const title of ["Unité", "Pondues dans le temps", `Gain (${STATS[stat].long})`, "Recherche comparée"])
    head.append(el(doc, "th", undefined, title));
  const thead = el(doc, "thead");
  thead.append(head);
  const body = el(doc, "tbody");
  table.append(thead, body);
  for (const option of advice.options) {
    const line = el(doc, "tr", option === advice.best ? "optizzz-advice-best" : undefined);
    const edge = advice.researchGain / option.gain - 1;
    line.append(
      el(doc, "td", undefined, unitName(option.key, 1)),
      el(doc, "td", undefined, formatNumber(option.count)),
      el(doc, "td", undefined, signed(option.gain)),
      el(doc, "td", undefined, `${edge >= 0 ? "+" : "−"}${percent(Math.abs(edge))}`),
    );
    body.append(line);
  }
  units.append(table);
  return units;
}
