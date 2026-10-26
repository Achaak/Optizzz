// colonies.php: the player's colonies and the troops occupying them, and their own master. Selectors are documented in
// docs/research/fourmizzz-pages.md (« colonies.php et profil »).
import { readTroops } from "../army/units";
import { parseGameInteger } from "../format/game-number";
import { parseGameDuration } from "./work-queue";

export interface Colony {
  pseudo: string;
  /** My troops occupying it, by unit key: still my army, away from home. */
  troops: Record<string, number>;
  /** How long it has been mine (« Cette colonie vous appartient depuis 3j 4h »), ms; null when not written. */
  heldFor: number | null;
  /** What it brought me since (« Elle vous a rapporté 0 nourriture et 0 matériaux »); null when not written. */
  brought: { food: number; materials: number } | null;
}

export interface ColoniesPage {
  /** Who colonizes me; null when free. */
  master: string | null;
  colonies: Colony[];
}

/** Troops written one unit per line (« 10 Jeunes Soldates Naines<br> »), up to the blank line; « Aucune troupe ». */
function troopsAfter(label: Node): Record<string, number> {
  const lines: string[] = [];
  let line = "";
  for (let node = label.nextSibling; node; node = node.nextSibling) {
    if (node instanceof Element && node.tagName === "BR") {
      // The line break right after the label, then the blank line that ends the list.
      if (!line.trim()) {
        if (lines.length > 0) break;
        continue;
      }
      lines.push(line);
      line = "";
    } else if (node instanceof Element && node.tagName !== "SPAN") break;
    else line += node.textContent ?? "";
  }
  if (line.trim()) lines.push(line);
  return readTroops(lines.join(","));
}

/** colonies.php read: one `div.caseColonie` per colony, the master's box when colonized. */
export function readColonies(doc: Document): ColoniesPage {
  const masterBox = [...doc.querySelectorAll("#centre div.simulateur")].find((box) =>
    box.querySelector("h2")?.textContent.includes("Vous êtes colonisés"),
  );
  const colonies = [...doc.querySelectorAll("#centre div.caseColonie")].flatMap((box) => {
    const pseudo = box.querySelector("h4 a[href*='Membre.php']")?.textContent.trim();
    if (!pseudo) return [];
    const label = [...(box.querySelector("p")?.childNodes ?? [])].find((node) =>
      node.textContent?.includes("Troupes présentes"),
    );
    const held = [...box.querySelectorAll("p")].find((p) => p.textContent.includes("appartient depuis"));
    const text = held?.textContent ?? "";
    const since = /appartient depuis\s*([^\n]*?)\s*Elle/.exec(text.replace(/\s+/g, " "))?.[1] ?? "";
    const amounts = [...(held?.querySelectorAll(".sur_une_ligne") ?? [])].map((span) =>
      parseGameInteger(span.textContent),
    );
    const [food, materials] = amounts;
    return [
      {
        pseudo,
        troops: label ? troopsAfter(label) : {},
        heldFor: held ? parseGameDuration(since) : null,
        brought: food !== undefined && materials !== undefined ? { food, materials } : null,
      },
    ];
  });
  const master = masterBox?.querySelector("a[href*='Membre.php']")?.textContent.trim() ?? null;
  return { master, colonies };
}
