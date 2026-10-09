import { formatDecimal, formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import { distance } from "@/game/travel";
import { planConvoy, readConvoysOnWay, recipients, type MapPlayer } from "./convoy";
import { parseGameInteger } from "@/utils/game-number";

export const CONVOY_STYLE = `
.optizzz-convoy { margin: 8px 0; }
.optizzz-convoy p { margin: 2px 0; }
.optizzz-convoy-note { font-style: italic; font-size: 0.9em; }
.optizzz-convoy-arrival { font-weight: normal; font-style: italic; }`;

export interface ConvoyContext {
  /** The sender's pseudo. */
  me: string;
  /** The public export; null when it could not be loaded. */
  players: MapPlayer[] | null;
  /** The sender's Vitesse d'attaque; null when unknown. */
  attackSpeed: number | null;
  aphids: number;
  idleWorkers: number;
  /** Share of the harvest a colonizer takes. */
  taxRate: number;
  /** Why the trip cannot be timed, when the levels are unknown. */
  levelsHint?: string;
}

/** Beyond the alliance, only the nearest players are suggested: the whole server is too long a list. */
const NEAREST_SUGGESTED = 100;

/** The arrival time after each convoy on its way: read on the page alone, written before anything is loaded. */
export function annotateConvoysOnWay(doc: Document, now: Date) {
  for (const convoy of readConvoysOnWay(doc, now)) {
    if (convoy.element.querySelector(".optizzz-convoy-arrival")) continue;
    const arrival = doc.createElement("span");
    arrival.className = "optizzz-convoy-arrival";
    arrival.textContent = ` · arrivée ${formatEndTime(convoy.arrivesAt, now)}`;
    convoy.element.append(arrival);
  }
}

const DATALIST_ID = "optizzz-convoy-recipients";

/**
 * Under the convoy form: the trip to the recipient typed and the workers it takes; suggestions on the recipient
 * field; the arrival time after each convoy on its way. Call `render` after each change of the form.
 */
export function mountConvoyPlanner(doc: Document, context: ConvoyContext, clock: () => Date) {
  const pseudoInput = doc.getElementById("pseudo_convoi") as HTMLInputElement | null;
  const value = (id: string) => (doc.getElementById(id) as HTMLInputElement | null)?.value ?? "";

  annotateConvoysOnWay(doc, clock());

  const players = context.players ?? [];
  const byPseudo = new Map(players.map((player) => [player.pseudo.toLowerCase(), player]));
  const sender = byPseudo.get(context.me.toLowerCase());
  if (pseudoInput && players.length > 0) {
    const list = doc.createElement("datalist");
    list.id = DATALIST_ID;
    const ordered = recipients(players, context.me);
    const allies = sender?.alliance ? ordered.filter((player) => player.alliance === sender.alliance) : [];
    const others = ordered.filter((player) => !allies.includes(player)).slice(0, NEAREST_SUGGESTED);
    for (const player of [...allies, ...others]) {
      const option = doc.createElement("option");
      option.value = player.pseudo;
      const where = sender ? `${formatDecimal(distance(sender, player))} cases` : "";
      option.label = [player.alliance, where].filter(Boolean).join(" · ");
      list.append(option);
    }
    pseudoInput.setAttribute("list", DATALIST_ID);
    pseudoInput.after(list);
  }

  const block = doc.createElement("div");
  block.className = "optizzz-convoy";
  const form = pseudoInput?.form;
  if (form) form.after(block);

  const render = () => {
    const now = clock();
    const typed = pseudoInput?.value.trim() ?? "";
    const recipient = byPseudo.get(typed.toLowerCase());
    const lines: { text: string; note?: boolean }[] = [];
    if (!typed) {
      // Nothing typed yet.
    } else if (!context.players) {
      lines.push({ text: "L'export public de Fourmizzz ne répond pas : pas de temps de trajet." });
    } else if (!sender) {
      lines.push({
        text: "Vous n'êtes pas encore dans l'export public (mis à jour chaque heure) : pas de temps de trajet.",
      });
    } else if (!recipient) {
      lines.push({
        text: `${typed} n'est pas dans l'export public (mis à jour chaque heure) : pas de temps de trajet.`,
      });
    } else if (recipient === sender) {
      lines.push({ text: "C'est vous : choisissez un autre destinataire." });
    } else if (context.attackSpeed === null) {
      lines.push({ text: context.levelsHint ?? "Vitesse d'attaque inconnue : pas de temps de trajet." });
    } else {
      // The game parses « 2k » into its hidden fields.
      const resources = parseGameInteger(value("nbNourriture")) + parseGameInteger(value("nbMateriaux"));
      const gameWorkers = parseGameInteger(value("nbOuvriere"));
      const plan = planConvoy(
        {
          from: sender,
          to: recipient,
          attackSpeed: context.attackSpeed,
          aphids: context.aphids,
          resources,
          idleWorkers: context.idleWorkers,
          taxRate: context.taxRate,
          ...(gameWorkers > 0 ? { workers: gameWorkers } : {}),
        },
        now,
      );
      const gap = formatDecimal(plan.distance);
      lines.push({
        text: `${recipient.pseudo} à ${gap} cases · trajet ≈ ${formatDuration(plan.duration)} · arrivée ≈ ${formatEndTime(plan.arrivesAt, now)}`,
      });
      if (resources > 0) {
        lines.push({
          text:
            plan.workingTaken > 0
              ? `${formatNumber(plan.workers)} ouvrières, dont ${formatNumber(plan.workingTaken)} au travail : ≈ ${formatNumber(plan.harvestLost)} de récolte perdue pendant le trajet`
              : `${formatNumber(plan.workers)} ouvrières, toutes sans travail`,
        });
        lines.push({ text: "Le surplus est perdu si ses entrepôts débordent.", note: true });
      }
    }
    block.replaceChildren(
      ...lines.map((line) => {
        const paragraph = doc.createElement("p");
        if (line.note) paragraph.className = "optizzz-convoy-note";
        paragraph.textContent = line.text;
        return paragraph;
      }),
    );
  };
  // After the game's own handlers have filled its hidden fields.
  const later = () => setTimeout(render, 0);
  for (const id of ["pseudo_convoi", "input_nbNourriture", "input_nbMateriaux", "input_nbOuvriere"]) {
    for (const event of ["keyup", "input", "change"]) doc.getElementById(id)?.addEventListener(event, later);
  }
  // The game fills the fields to the maximum when their titles are clicked.
  form?.addEventListener("click", later);
  render();
  return { render };
}
