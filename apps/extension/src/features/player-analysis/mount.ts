// The analysis rows of the « Informations » box on Membre.php. See docs/features/analyse-joueurs.md.
import type { Inactivity } from "@optizzz/game/analysis/inactivity";
import type { RelativeRank } from "@optizzz/game/analysis/peers";
import {
  floodSummary,
  floodText,
  floodWhen,
  quietHoursText,
  SURENESS_TITLES,
  type PlayerAnalysis,
} from "@optizzz/game/analysis/player-analysis";
import type { AllianceReach, MutualReach } from "@optizzz/game/analysis/reach";
import { formatAmount } from "@optizzz/game/format/number-format";
import { findProfileStateRow } from "@optizzz/game/pages/scores";

/** Marks the rows; not an `optizzz-` class, for the same reason as the production row. */
export const ANALYSIS_ROW_ATTRIBUTE = "data-optizzz-analysis";

/** What the rows show; null leaves a row out. */
export interface ProfileAnalysis {
  reach: MutualReach | null;
  alliance: AllianceReach | null;
  inactivity: Inactivity | null;
}

interface Row {
  key: string;
  label: string;
  text: string;
  title: string;
}

const RANGE_RULE = "Portée : de 50 % (inclus) à 300 % (exclu) du TDC de l'attaquant.";

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

function reachRow(reach: MutualReach): Row {
  return {
    key: "reach",
    label: "Portée :",
    text: `${reach.iCanAttack ? "à votre portée" : "hors de votre portée"} · ${
      reach.canAttackMe ? "vous êtes à sa portée" : "vous êtes hors de sa portée"
    }`,
    title: RANGE_RULE,
  };
}

function allianceRow(alliance: AllianceReach): Row {
  const attackers =
    alliance.canAttackIt === 0
      ? "aucun membre ne peut l'attaquer"
      : `${formatAmount(alliance.canAttackIt)} ${plural(alliance.canAttackIt, "membre peut", "membres peuvent")} l'attaquer`;
  const targets = `${formatAmount(alliance.itCanAttack)} ${plural(alliance.itCanAttack, "est", "sont")} à sa portée`;
  const near = alliance.nearestAttacker;
  const squares = near ? Math.round(near.distance) : 0;
  const nearest = near
    ? ` · le plus proche : ${near.pseudo}, ${formatAmount(squares)} ${plural(squares, "case", "cases")}`
    : "";
  return {
    key: "alliance",
    label: "Votre alliance :",
    text: `${attackers}, ${targets}${nearest}`,
    title: `${RANGE_RULE} TDC des membres au dernier export ; le vôtre en direct. Distance en cases : seule votre Vitesse d'attaque est connue.`,
  };
}

function inactivityRow(inactivity: Inactivity): Row {
  return {
    key: "inactivity",
    label: "Activité :",
    text: `Inactif probable depuis ${formatAmount(inactivity.days)} j${
      inactivity.onlyLosses ? " (rien n'a bougé sauf des pertes)" : ""
    }`,
    title:
      "Ni son TDC, ni sa Fourmilière, ni sa Technologie n'ont monté depuis au moins 3 nuits (exports de minuit). Son TDC a pu baisser : des floods sans réponse.",
  };
}

/** Adds the rows after « Etat » and the production rows, or updates them; nothing without an « Etat » row. */
export function mountAnalysisRows(doc: Document, analysis: ProfileAnalysis): void {
  const stateRow = findProfileStateRow(doc);
  if (!stateRow) return;
  for (const row of doc.querySelectorAll(`tr[${ANALYSIS_ROW_ATTRIBUTE}]`)) row.remove();
  let after: Element = stateRow;
  while (after.nextElementSibling?.matches("tr[data-optizzz-production], tr[data-optizzz-colonies]")) {
    after = after.nextElementSibling;
  }
  const rows = [
    analysis.reach && reachRow(analysis.reach),
    analysis.alliance && allianceRow(analysis.alliance),
    analysis.inactivity && inactivityRow(analysis.inactivity),
  ].filter((row): row is Row => row !== null);
  for (const { key, label, text, title } of rows) {
    const row = doc.createElement("tr");
    row.setAttribute(ANALYSIS_ROW_ATTRIBUTE, key);
    const labelCell = doc.createElement("td");
    // As the game's own labels.
    labelCell.style.textAlign = "right";
    labelCell.textContent = label;
    const cell = doc.createElement("td");
    cell.textContent = text;
    row.append(labelCell, cell);
    row.title = title;
    after.after(row);
    after = row;
  }
}

/** What the « Analyse » box shows: the site's hourly analysis (null when it does not answer) and the rank. */
export interface AnalysisBox {
  analysis: PlayerAnalysis | null;
  rank: RelativeRank | null;
  /** The player's page on optizzz.fr. */
  siteHref: string;
  now: Date;
}

export const ANALYSIS_BOX_STYLE = `
.optizzz-analysis { margin: var(--optizzz-space-4) 0; }
.optizzz-analysis ul { margin: var(--optizzz-space-2) 0; padding-left: var(--optizzz-space-5); }
.optizzz-analysis li { cursor: help; }
`;

/** Floods shown in the box: those of the last 7 days, the latest first. */
const BOX_FLOODS = 3;
const WEEK_MS = 7 * 24 * 3_600_000;

/**
 * The « Analyse » box under the « Progression » one on Membre.php (under « Informations » without it), or replaced:
 * the quiet hours, the week's probable floods, the rank among the players of its size.
 */
export function mountAnalysisBox(doc: Document, { analysis, rank, siteHref, now }: AnalysisBox): void {
  const anchor = doc.querySelector("optizzz-profile-history") ?? doc.querySelector(".boite_membre");
  if (!anchor) return;
  doc.querySelector(".optizzz-analysis")?.remove();
  const box = doc.createElement("div");
  box.className = "optizzz-analysis optizzz-panel";
  const title = doc.createElement("p");
  title.className = "optizzz-panel-title";
  title.textContent = "Analyse";
  box.append(title);
  const paragraph = (text: string, className?: string) => {
    const p = doc.createElement("p");
    p.textContent = text;
    if (className) p.className = className;
    box.append(p);
    return p;
  };
  const link = (text: string) => {
    const a = doc.createElement("a");
    a.href = siteHref;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    return a;
  };

  if (!analysis) paragraph("Analyse horaire indisponible (optizzz.fr ne répond pas).", "optizzz-note");
  else {
    const quiet = analysis.quietHours;
    if (analysis.days < 7)
      paragraph(
        `Seulement ${formatAmount(analysis.days)} ${analysis.days > 1 ? "jours relevés" : "jour relevé"} : pas encore de plage calme.`,
      );
    else if (quiet) {
      const p = paragraph("");
      const strong = doc.createElement("strong");
      strong.textContent = `Plage calme habituelle : ${quietHoursText(quiet)}`;
      p.append(strong, " (aucune hausse de son TDC 3 jours sur 4)");
    } else paragraph("Pas de plage calme nette sur 4 semaines.");

    const week = analysis.floods.filter((line) => now.getTime() - new Date(line.at).getTime() <= WEEK_MS);
    const heading = doc.createElement("p");
    heading.className = "optizzz-subtitle";
    heading.textContent = "Floods probables sur 7 j";
    box.append(heading);
    if (week.length === 0) paragraph("Aucun flood probable relevé.", "optizzz-note");
    else {
      paragraph(floodSummary(week, "7 j"));
      // The TDC chain's floods are counted, not shown: a hunter of the chain would see nothing else.
      const outside = week.filter((line) => !line.inside);
      const list = doc.createElement("ul");
      for (const line of (outside.length > 0 ? outside : week).slice(0, BOX_FLOODS)) {
        const item = doc.createElement("li");
        const when = doc.createElement("strong");
        when.textContent = floodWhen(line, now);
        const sign = line.direction === "lost" ? "▼ −" : "▲ +";
        item.append(when, ` · ${sign}${formatAmount(line.amount)} · ${floodText(line)}`);
        item.title = SURENESS_TITLES[line.sureness];
        list.append(item);
      }
      box.append(list);
    }
    const more = doc.createElement("p");
    more.append(link(`Tout voir sur optizzz.fr (${formatAmount(analysis.floods.length)} sur 30 jours)`));
    box.append(more);
  }

  if (rank)
    paragraph(
      `Progresse plus vite que ${formatAmount(Math.round((rank.faster / rank.peers) * 100))} % des ${formatAmount(rank.peers)} joueurs de sa taille sur 7 j.`,
    );
  const footer = paragraph("Calculé d'après l'export public de Fourmizzz, relevé chaque heure. · ", "optizzz-note");
  footer.append(link("Voir la fiche sur optizzz.fr"));
  anchor.after(box);
}
