// In the game, from the Envois (docs/features/site-envois.md, « Vues »): on Armee.php, under « Attaque(s) en cours »,
// the members' floods on their way to the alliance, as their extensions sent them to the Alliance Space: first those
// on their way to the player, then those on the other members, by target. The background holds the Clé d'alliance and
// answers already decrypted: nothing here reads the site, and nothing is asked of the game.
import { floodLine, floodsOnMembers, floodsToward } from "@optizzz/game/site-links/envoi-floods";
import type { Feature } from "../feature";
import type { FloodsAnswer } from "./envois";
import { askEnvois } from "./messages";

const ALLIANCE_FLOODS_STYLE = `
.optizzz-alliance-floods { margin: var(--optizzz-space-4) 0; text-align: left; }
.optizzz-alliance-floods ul { margin: var(--optizzz-space-1) 0 var(--optizzz-space-3); padding-left: var(--optizzz-space-5); }
.optizzz-alliance-floods .optizzz-subtitle { margin: var(--optizzz-space-3) 0 var(--optizzz-space-1); }
.optizzz-alliance-floods-target { margin: var(--optizzz-space-2) 0 0; font-weight: bold; }`;

const NOTE = "Seuls les floods des membres qui les envoient à Optizzz apparaissent ici";

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string) => {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

function list(doc: Document, lines: readonly string[]): HTMLUListElement {
  const ul = el(doc, "ul");
  for (const line of lines) ul.append(el(doc, "li", undefined, line));
  return ul;
}

/**
 * The panel « Floods en route vers l'alliance », or null when there is nothing to say: not linked, or not in an
 * Alliance Space.
 */
export function allianceFloodsPanel(doc: Document, answer: FloodsAnswer, now: Date): HTMLElement | null {
  if (answer.problem === "unlinked" || answer.problem === "no-space") return null;
  const panel = el(doc, "section", "optizzz-alliance-floods optizzz-panel optizzz-panel--inset");
  panel.append(el(doc, "h3", "optizzz-panel-title", "Floods en route vers l'alliance"));
  if (answer.problem === "no-key" || !answer.me) {
    panel.append(
      el(doc, "p", "optizzz-note", "Ouvrez votre espace sur optizzz.fr pour lire les floods de l'alliance ici."),
    );
    return panel;
  }
  const toMe = floodsToward(answer.me, now, answer.floods);
  panel.append(el(doc, "h4", "optizzz-subtitle", "Vers vous"));
  panel.append(
    toMe.length > 0
      ? list(
          doc,
          toMe.map((f) => floodLine(f, now)),
        )
      : el(doc, "p", "optizzz-note", "Aucun flood d'un membre en route vers vous."),
  );
  const others = floodsOnMembers(answer.me, answer.members, now, answer.floods);
  panel.append(el(doc, "h4", "optizzz-subtitle", "Vers les autres membres"));
  if (others.length === 0) panel.append(el(doc, "p", "optizzz-note", "Aucun flood en route vers un autre membre."));
  for (const group of others) {
    panel.append(
      el(doc, "p", "optizzz-alliance-floods-target", group.target),
      list(
        doc,
        group.floods.map((f) => floodLine(f, now)),
      ),
    );
  }
  panel.append(el(doc, "p", "optizzz-note", `${NOTE}, d'après la dernière relève d'optizzz.fr.`));
  return panel;
}

/** Where the panel goes: after the game's « Attaque(s) en cours » block, or at the end of the page's content. */
function placePanel(doc: Document, panel: HTMLElement): void {
  const centre = doc.getElementById("centre");
  const title = [...(centre?.querySelectorAll("h3") ?? [])].find((h3) =>
    h3.textContent.includes("Attaque(s) en cours"),
  );
  // The block runs to the end of its container (Armee.php: `#centre > center`), the attacks being written loose.
  const container = title?.parentElement ?? centre ?? doc.body;
  container.append(panel);
}

/** The alliance's floods on their way, for Armee.php, the Plan de flood and the targets; null when none can be read. */
export async function askAllianceFloods(origin: string): Promise<FloodsAnswer | null> {
  return askEnvois<FloodsAnswer>({ type: "optizzz-envois", action: "floods", origin }).catch(() => null);
}

/** Armee.php: the alliance's floods on their way, under the game's « Attaque(s) en cours ». */
export const allianceFloods: Feature = {
  id: "alliance-floods",
  toggle: "optizzz-account",
  matches: (url) => url.pathname.toLowerCase() === "/armee.php",
  async run() {
    if (!document.getElementById("pseudo")) return;
    const answer = await askAllianceFloods(location.origin);
    if (!answer) return;
    const panel = allianceFloodsPanel(document, answer, new Date());
    if (!panel) return;
    const style = document.createElement("style");
    style.textContent = ALLIANCE_FLOODS_STYLE;
    document.head.append(style);
    placePanel(document, panel);
  },
};
