import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { formatDuration, formatEndTime } from "@optizzz/game/format/time-format";
import { distance } from "@optizzz/game/travel";
import { convoyMessage, planConvoy, readConvoysOnWay, recipients, type MapPlayer } from "./convoy";
import { ON_WAY_STYLE, renderOnWayList, span, type Copy } from "@/utils/on-way-list";
import { parseGameInteger } from "@optizzz/game/format/game-number";

export const CONVOY_STYLE = `
.optizzz-convoy { margin: var(--optizzz-space-4) 0; }
.optizzz-convoy p { margin: var(--optizzz-space-1) 0; }
.optizzz-convoys img { height: 1.1em; vertical-align: -0.2em; margin-right: var(--optizzz-space-1); }
.optizzz-convoy-food { color: var(--optizzz-food); font-weight: bold; white-space: nowrap; }
.optizzz-convoy-materials { color: var(--optizzz-materials); font-weight: bold; white-space: nowrap; }
.optizzz-convoy-unit { margin-left: var(--optizzz-space-1); font-weight: normal; font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
${ON_WAY_STYLE}`;

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

const LIST_CLASS = "optizzz-convoys";

/** One resource of the load: the game's icon, its number, its name for who does not see the icon's colour. */
function load(doc: Document, className: string, icon: Element | null, amount: number, name: string) {
  const image = icon?.cloneNode() ?? null;
  if (image instanceof HTMLImageElement) image.alt = "";
  return span(doc, className, ...(image ? [image] : []), formatAmount(amount), span(doc, "optizzz-convoy-unit", name));
}

/**
 * The convoys on their way, read on the page alone (written before anything is loaded): the game's lines give way to
 * a list with a live countdown, the arrival time, and a button that copies each convoy as a line of text.
 * Returns a function that stops the countdown.
 */
export function renderConvoysOnWay(doc: Document, clock: () => Date, copy: Copy): () => void {
  const convoys = readConvoysOnWay(doc, clock());
  const first = convoys[0];
  if (!first || doc.querySelector(`.${LIST_CLASS}`)) return () => undefined;

  const { list, stop } = renderOnWayList(
    doc,
    LIST_CLASS,
    convoys.map((convoy) => {
      const icons = convoy.element.querySelectorAll("img");
      return {
        to: convoy.element.querySelector("a")?.cloneNode(true) ?? doc.createTextNode(convoy.player),
        incoming: convoy.incoming,
        details: [
          load(doc, "optizzz-convoy-food", icons[0] ?? null, convoy.food, "nourriture"),
          load(doc, "optizzz-convoy-materials", icons[1] ?? null, convoy.materials, "matériaux"),
        ],
        arrivesAt: convoy.arrivesAt,
        // On a convoy I receive, the game's « Retour » is its arrival, already shown.
        notes: convoy.back && !convoy.incoming ? [convoy.back] : [],
        message: (now: Date) => convoyMessage(convoy, now),
        copyTitle: "Copier ce convoi en une ligne de texte",
        cancel: convoy.cancel,
      };
    }),
    clock,
    copy,
  );

  // The game's lines stay in the page, hidden: the page is still read as the game wrote it.
  const lines = new Set(convoys.map((convoy) => convoy.element));
  for (let node: ChildNode | null = first.element; node; node = node.nextSibling) {
    if (node instanceof HTMLElement) {
      if (!lines.has(node) && node.tagName !== "SMALL" && node.tagName !== "BR") break;
      node.hidden = true;
    } else if (node.nodeType === Node.TEXT_NODE) {
      // The « - » before the game's « Retour le … ».
      node.textContent = "";
    }
  }
  first.element.before(list);
  return stop;
}

const DATALIST_ID = "optizzz-convoy-recipients";

/**
 * Under the convoy form: the trip to the recipient typed and the workers it takes; suggestions on the recipient
 * field; the convoys on their way as a list. Call `render` after each change of the form.
 */
export function mountConvoyPlanner(doc: Document, context: ConvoyContext, clock: () => Date, copy: Copy) {
  const pseudoInput = doc.getElementById("pseudo_convoi") as HTMLInputElement | null;
  const value = (id: string) => (doc.getElementById(id) as HTMLInputElement | null)?.value ?? "";

  const stopCountdown = renderConvoysOnWay(doc, clock, copy);

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
              ? `${formatAmount(plan.workers)} ouvrières, dont ${formatAmount(plan.workingTaken)} au travail : ≈ ${formatAmount(plan.harvestLost)} de récolte perdue pendant le trajet`
              : `${formatAmount(plan.workers)} ouvrières, toutes sans travail`,
        });
        lines.push({ text: "Le surplus est perdu si ses entrepôts débordent.", note: true });
      }
    }
    block.replaceChildren(
      ...lines.map((line) => {
        const paragraph = doc.createElement("p");
        if (line.note) paragraph.className = "optizzz-convoy-note optizzz-note";
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
  return { render, stopCountdown };
}
