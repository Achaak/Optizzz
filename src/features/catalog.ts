/** A switchable part of a feature, shown indented under it. */
export interface FeatureOption {
  /** Stable: part of the storage key. */
  id: string;
  label: string;
}

/** A feature the player can switch off in « Fonctionnalités ». */
export interface CatalogEntry {
  /** Stable: the storage key. Never rename it. */
  id: string;
  label: string;
  description: string;
  options: FeatureOption[];
}

/** Every visible feature, in display order. Settings and game-levels are always on and not listed. */
export const featureCatalog = [
  {
    id: "work-queue",
    label: "Chantiers en cours",
    description: "Tableau des constructions et recherches en cours sur Construction et Laboratoire.",
    options: [],
  },
  {
    id: "resource-forecast",
    label: "Prévisions de ressources",
    description: "Quand vous pourrez payer, quand vous tomberez en famine, quand un entrepôt sera plein.",
    options: [
      { id: "costs", label: "Délais sur Construction et Laboratoire" },
      { id: "outlook", label: "Famine et entrepôt plein dans l'en-tête" },
      { id: "simulator", label: "Simulation de la répartition des ouvrières sur Ressources" },
    ],
  },
  {
    id: "alliance-map",
    label: "Carte de l'alliance",
    description: "Entrée « Carte » dans le menu d'alliance : où sont les membres et qui est proche de qui.",
    options: [],
  },
  {
    id: "hunt-launcher",
    label: "Lanceur de chasse",
    description: "Sur Ressources : combien chasser, avec quoi, et lancer en un clic.",
    options: [],
  },
] as const satisfies readonly CatalogEntry[];

export type FeatureId = (typeof featureCatalog)[number]["id"];
