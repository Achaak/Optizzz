// The site's tools, as `/tools` lists them. A tool not done yet is listed without a link: once its page exists,
// `ready: true` is the only line to change here. See docs/features/site-outils.md.
import { siteToolPath, type SiteToolId } from "@optizzz/game/site-links/site";
import type { Metadata } from "next";

interface ToolEntry {
  id: SiteToolId;
  title: string;
  /** In the tools' bar: « Combat ». */
  shortTitle: string;
  /** One sentence, on `/tools` and as the page's description. */
  description: string;
  /** Its page exists. */
  ready: boolean;
}

export const TOOLS: readonly ToolEntry[] = [
  {
    id: "travel",
    shortTitle: "Trajet",
    title: "Temps de trajet",
    description: "Le trajet d'une attaque ou d'un convoi entre deux joueurs ou deux positions, et l'heure d'arrivée.",
    ready: true,
  },
  {
    id: "costs",
    shortTitle: "Coûts",
    title: "Coûts et temps de développement",
    description:
      "Ce que coûte un bâtiment ou une recherche d'un niveau à un autre, et sa durée avec Architecture ou la Salle d'analyse.",
    ready: true,
  },
  {
    id: "combat",
    shortTitle: "Combat",
    title: "Simulateur de combat",
    description: "Le résultat d'une attaque, lieu par lieu : victoire ou défaite, pertes des deux côtés, gains.",
    ready: true,
  },
  {
    id: "hunt",
    shortTitle: "Chasse",
    title: "Simulateur de chasse",
    description: "Combien chasser et avec quelle armée, selon les pertes que vous acceptez.",
    ready: true,
  },
  {
    id: "flood",
    shortTitle: "Flood",
    title: "Simulateur de flood",
    description: "La suite d'attaques qui prend le plus de TDC à une cible, avec votre armée.",
    ready: true,
  },
];

/** A tool page's title and description, from its line of the list. */
export function toolMetadata(id: SiteToolId): Metadata {
  const tool = TOOLS.find((entry) => entry.id === id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return { title: tool.title, description: tool.description, alternates: { canonical: siteToolPath(id) } };
}
