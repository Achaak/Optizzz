// A line under Couveuse, Solarium and Technique de ponte: which of them makes laying 10 % faster for the least, the
// Laboratoire levels Technique de ponte needs included. See docs/features/conseils-recherche.md.
import { type BoostRow, type LayingBoost, type Requirement } from "@/game/laying-boost";
import { sameName } from "@/game/levels";
import { readTimedRows } from "@/game/pages/resources";
import { formatDecimal, formatNumber as formatSpaced } from "@/utils/number-format";
import { placeInRow } from "@/utils/row-extras";

export const LAYING_BOOST_STYLE = `
.optizzz-laying-boost { margin-top: var(--optizzz-space-2); display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--optizzz-space-3); }
.optizzz-laying-boost strong { color: var(--optizzz-success-text); }
.optizzz-laying-boost-detail { color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }`;

/** What a row's next level is missing: « Requis : Laboratoire niveau 10 » (the phone layout may repeat it). */
function readRequirements(description: Element): Requirement[] {
  const found = new Map<string, number>();
  for (const missing of description.querySelectorAll(".verificationNonOK")) {
    const match = /^(.+?)\s+niveau\s+(\d+)/i.exec(missing.textContent.replace(/\s+/g, " ").trim());
    if (match?.[1] && match[2]) found.set(match[1], Math.max(found.get(match[1]) ?? 0, Number(match[2])));
  }
  return [...found].map(([name, level]) => ({ name, level }));
}

/** The rows of the given pages, with what each is missing, and where to put the line. */
export function readBoostRows(docs: readonly Document[]): (BoostRow & { description: Element })[] {
  return docs.flatMap((doc) =>
    readTimedRows(doc).map(({ name, level, cost, description }) => ({
      name,
      level,
      cost,
      description,
      requirements: readRequirements(description),
    })),
  );
}

/** Numbers never break at the end of a line. */
const formatNumber = (value: number) => formatSpaced(value).replace(/ /g, "\u00a0");
const label = (boost: LayingBoost) => `${boost.name} ${String(boost.level)}`;
const amount = (boost: LayingBoost) =>
  `${formatNumber(boost.total)}${boost.complete ? "" : " au moins"}${
    boost.cost.workers > 0 ? ` et ${formatNumber(boost.cost.workers)} ouvrières` : ""
  }`;
/** « Laboratoire 10 compris », or nothing. */
const including = (boost: LayingBoost) =>
  boost.requirements.length
    ? `${list(boost.requirements.map((requirement) => `${requirement.name} ${String(requirement.level)}`))} compris`
    : "";
/** « Couveuse 12 et Solarium 10 », « Solarium 10 ». */
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} et ${items.at(-1) ?? ""}` : (items[0] ?? "");

/** Two costs this close are the same: the game's other costs (time, harvest) decide. */
const SAME = 1.05;

/** What the line says in the row of `name`; null when fewer than two of them can be compared. */
export function layingBoostText(name: string, ranked: readonly LayingBoost[]) {
  const own = ranked.find((boost) => sameName(boost.name, name));
  const [best] = ranked;
  if (!own || !best || ranked.length < 2 || best.total <= 0) return null;
  const others = ranked.filter((boost) => boost !== own);
  if (own.total <= best.total * SAME) {
    const tied = others.filter((boost) => boost.total <= own.total * SAME);
    const rest = others.filter((boost) => !tied.includes(boost));
    return {
      lead: tied.length ? `${list([label(own), ...tied.map(label)])} se valent :` : `${label(own)} d'abord :`,
      strong: `${tied.length ? "les moins chers" : "le moins cher"} pour pondre 10 % plus vite`,
      detail: `(${amount(own)} ressources${including(own) && `, ${including(own)}`}${
        rest.length ? `, contre ${list(rest.map((boost) => `${amount(boost)} pour ${label(boost)}`))}` : ""
      })`,
    };
  }
  const ratio = own.total / best.total;
  return {
    lead: `${label(best)} d'abord${including(best) && ` (${including(best)})`} :`,
    strong: `même gain de ponte, ${ratio >= 2 ? `${formatDecimal(ratio)} × moins cher` : `${String(Math.round((1 - 1 / ratio) * 100))} % moins cher`}`,
    detail: `(${amount(best)} ressources au lieu de ${amount(own)})`,
  };
}

/** Adds the line to the row of `boost`; returns it, or null. */
export function mountLayingBoost(
  description: Element,
  name: string,
  ranked: readonly LayingBoost[],
): HTMLElement | null {
  const text = layingBoostText(name, ranked);
  if (!text) return null;
  const doc = description.ownerDocument;
  const line = doc.createElement("div");
  line.title =
    "Optizzz : chaque niveau de Couveuse, de Solarium ou de Technique de ponte rend la ponte 10 % plus rapide (temps × 0,9) : ils se valent, seul le coût les départage. Ressources : nourriture et matériaux additionnés. Les niveaux de Laboratoire requis sont comptés en entier, bien qu'ils servent aussi aux autres recherches. Durées des chantiers non comptées.";
  const tag = doc.createElement("span");
  tag.className = "optizzz-advice-tag optizzz-tag";
  tag.textContent = "Conseil";
  const strong = doc.createElement("strong");
  strong.textContent = text.strong;
  const detail = doc.createElement("span");
  detail.className = "optizzz-laying-boost-detail";
  detail.textContent = text.detail;
  line.append(tag, " ", text.lead, " ", strong, " ", detail);
  placeInRow(description, "optizzz-laying-boost", line);
  return line;
}
