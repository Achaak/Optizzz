import { formatNumber } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import { distance } from "@/game/travel";
import { planConvoy, readConvoysOnWay, recipients, type MapPlayer } from "./convoy";

export const CONVOY_STYLE = `
.optizzz-convoy { margin: 8px 0; }
.optizzz-convoy p { margin: 2px 0; }
.optizzz-convoy-note { font-style: italic; font-size: 0.9em; }
.optizzz-convoy-arrival { font-weight: normal; font-style: italic; }`;

export interface ConvoyContext {
  /** The sender's pseudo. */
  me: string;
  /** Last night's export. */
  players: MapPlayer[];
  attackSpeed: number;
  aphids: number;
  idleWorkers: number;
}

const DATALIST_ID = "optizzz-convoy-recipients";
const toInteger = (text: string | null | undefined) => Number((text ?? "").replace(/\D/g, ""));

/**
 * Under the convoy form: the trip to the recipient typed and the workers it takes; suggestions on the recipient
 * field; the arrival time after each convoy on its way. Call `render` after each change of the form.
 */
export function mountConvoyPlanner(doc: Document, context: ConvoyContext, clock: () => Date) {
  const pseudoInput = doc.getElementById("pseudo_convoi") as HTMLInputElement | null;
  const value = (id: string) => (doc.getElementById(id) as HTMLInputElement | null)?.value ?? "";

  for (const convoy of readConvoysOnWay(doc, clock())) {
    const arrival = doc.createElement("span");
    arrival.className = "optizzz-convoy-arrival";
    arrival.textContent = ` · arrivée ${formatEndTime(convoy.arrivesAt, clock())}`;
    convoy.element.append(arrival);
  }

  const byPseudo = new Map(context.players.map((player) => [player.pseudo.toLowerCase(), player]));
  const sender = byPseudo.get(context.me.toLowerCase());
  if (pseudoInput) {
    const list = doc.createElement("datalist");
    list.id = DATALIST_ID;
    for (const player of recipients(context.players, context.me)) {
      const option = doc.createElement("option");
      option.value = player.pseudo;
      const where = sender
        ? `${distance(sender, player).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} cases`
        : "";
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
    if (typed && (!recipient || !sender)) {
      lines.push({ text: `${typed} n'est pas dans l'export d'hier : pas de temps de trajet.` });
    } else if (recipient && sender) {
      // The game parses « 2k » into its hidden fields.
      const resources = toInteger(value("nbNourriture")) + toInteger(value("nbMateriaux"));
      const gameWorkers = toInteger(value("nbOuvriere"));
      const plan = planConvoy(
        {
          from: sender,
          to: recipient,
          attackSpeed: context.attackSpeed,
          aphids: context.aphids,
          resources,
          idleWorkers: context.idleWorkers,
          ...(gameWorkers > 0 ? { workers: gameWorkers } : {}),
        },
        now,
      );
      const gap = plan.distance.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
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
