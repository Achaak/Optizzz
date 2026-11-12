// The site's guides, in reading order and by group; those to come are shown as « bientôt ».
// See docs/features/site-guides.md.

import type { SiteToolId } from "@optizzz/game/site-links/site";

/** « Les bases » are played alone; « En alliance », between members. */
export type GuideGroup = "basics" | "alliance";

export const GUIDE_GROUPS: readonly { id: GuideGroup; title: string; description: string }[] = [
  { id: "basics", title: "Les bases", description: "Ce qui fait tourner une fourmilière, seul." },
  { id: "alliance", title: "En alliance", description: "Faire circuler le TDC entre membres." },
];

export interface GuideEntry {
  id: string;
  group: GuideGroup;
  title: string;
  shortTitle: string;
  description: string;
  /** A few landmarks of the guide, on its card. */
  topics: readonly string[];
  /** The tool the guide leads to. */
  tool?: SiteToolId;
  ready: boolean;
  /** Last written, a Paris day (YYYY-MM-DD). */
  updated?: string;
  readingMinutes?: number;
}

export const GUIDES: readonly GuideEntry[] = [
  {
    id: "getting-started",
    group: "basics",
    title: "Bien débuter",
    shortTitle: "Bien débuter",
    description:
      "Ouvrières, Terrain de Chasse et ponte : ce qui fait grandir une fourmilière ses premières semaines, et dans quel ordre s'en occuper.",
    topics: ["1 ouvrière par cm²", "Premières chasses", "Ponte"],
    ready: false,
  },
  {
    id: "hunt",
    group: "basics",
    title: "La chasse",
    shortTitle: "Chasse",
    description:
      "Ce qui fixe la difficulté d'une chasse, sa durée et ses pertes, et pourquoi une grosse chasse rapporte souvent plus que plusieurs petites.",
    topics: ["Difficulté", "Vitesse de chasse", "Promotions"],
    tool: "hunt",
    ready: true,
    updated: "2026-11-12",
    readingMinutes: 10,
  },
  {
    id: "food",
    group: "basics",
    title: "Nourriture et entretien",
    shortTitle: "Nourriture",
    description:
      "La récolte par paquets toutes les 30 minutes, la champignonnière, ce que mange l'armée selon l'endroit où elle se trouve, et la taxe d'une colonie.",
    topics: ["48 par ouvrière et par jour", "5, 10 ou 15 %"],
    ready: false,
  },
  {
    id: "combat",
    group: "basics",
    title: "Le combat",
    shortTitle: "Combat",
    description:
      "Les quatorze unités, les bonus d'Armes et de Bouclier, les trois lieux d'une fourmilière et la surpuissance au premier coup.",
    topics: ["TDC, Fourmilière, Loge", "Portée 50–300 %"],
    tool: "combat",
    ready: true,
    updated: "2026-11-12",
    readingMinutes: 10,
  },
  {
    id: "travel",
    group: "basics",
    title: "Les temps de trajet",
    shortTitle: "Trajets",
    description:
      "Comment la distance et la Vitesse d'attaque font la durée d'une attaque ou d'un convoi, et où la lire dans le jeu.",
    topics: ["−10 % par niveau", "Plafond ≈ 7 j 9 h"],
    tool: "travel",
    ready: true,
    updated: "2026-11-12",
    readingMinutes: 6,
  },
  {
    id: "tdc-chain",
    group: "alliance",
    title: "La chaîne de TDC",
    shortTitle: "Chaîne de TDC",
    description:
      "Faire monter le Terrain de Chasse des chasseurs jusqu'aux greniers de l'alliance, attaque après attaque, sans en perdre en route.",
    topics: ["Greniers et passeurs", "Ordre de passage"],
    tool: "flood",
    ready: true,
    updated: "2026-11-04",
    readingMinutes: 8,
  },
  {
    id: "flood",
    group: "alliance",
    title: "Le flood",
    shortTitle: "Flood",
    description:
      "Combien de fourmis envoyer, en combien d'attaques, et pourquoi la deuxième attaque prend moins que la première.",
    topics: ["20 % par attaque", "Vitesse d'attaque + 1"],
    tool: "flood",
    ready: false,
  },
  {
    id: "timing",
    group: "alliance",
    title: "Le timing à la seconde",
    shortTitle: "Timing",
    description: "Faire arriver une attaque à la seconde voulue, et pourquoi viser la 59ᵉ seconde de la minute.",
    topics: ["Ordre d'arrivée", "Arrondi du trajet"],
    ready: false,
  },
];

export const guidePath = (id: string) => `/guides/${id}`;

export function guide(id: string): GuideEntry {
  const entry = GUIDES.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown guide: ${id}`);
  return entry;
}

/** « 4 novembre 2026 ». */
export const longDay = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
