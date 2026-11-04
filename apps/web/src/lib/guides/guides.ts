// The site's guides, in reading order: written ones first, those to come shown as « bientôt ».
// See docs/features/site-guides.md.

export interface GuideEntry {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  ready: boolean;
  /** Last written, a Paris day (YYYY-MM-DD). */
  updated?: string;
  readingMinutes?: number;
}

export const GUIDES: readonly GuideEntry[] = [
  {
    id: "tdc-chain",
    title: "La chaîne de TDC",
    shortTitle: "Chaîne de TDC",
    description:
      "Faire monter le Terrain de Chasse des chasseurs jusqu'aux greniers de l'alliance, attaque après attaque, sans en perdre en route.",
    ready: true,
    updated: "2026-11-04",
    readingMinutes: 8,
  },
  {
    id: "flood",
    title: "Le flood",
    shortTitle: "Flood",
    description: "Prendre le plus de TDC possible à une cible, en une suite d'attaques.",
    ready: false,
  },
  {
    id: "timing",
    title: "Le timing à la seconde",
    shortTitle: "Timing",
    description: "Pourquoi arriver à la 59e seconde, et comment cliquer au bon moment.",
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
