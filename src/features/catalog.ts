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
    id: "end-times",
    label: "Heures de fin",
    description: "L'heure de fin des chasses, pontes et chantiers, à côté des décomptes et dans la colonne de gauche.",
    options: [
      { id: "inline", label: "À côté des décomptes du jeu" },
      { id: "recap", label: "Encart « Prochaines fins »" },
    ],
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
    id: "alerts",
    label: "Alertes",
    description:
      "Sur l'icône de l'extension : le temps avant une famine ou un entrepôt plein, pour tous vos serveurs. Les notifications se choisissent dans l'onglet « Notifications ».",
    options: [
      { id: "badge", label: "Badge de l'icône" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    id: "laying-planner",
    label: "Planificateur de ponte",
    description:
      "Sur la Reine : des raccourcis (tout payer, durée de ponte, bilan à zéro) avec aperçu, et la fin, le paiement et l'entretien de la ponte choisie.",
    options: [],
  },
  {
    id: "convoy",
    label: "Calculateur de convoi",
    description: "Sur les Convois : trajet et heure d'arrivée, ouvrières prises, destinataires suggérés.",
    options: [],
  },
  {
    id: "targets",
    label: "Cibles à portée",
    description:
      "Sur Ennemies : les joueurs attaquables triés par distance, avec le trajet, leur état, les pactes et les guerres.",
    options: [],
  },
  {
    id: "flood",
    label: "Plan de flood",
    description:
      "Sur le formulaire d'attaque : les attaques qui prennent le plus de TDC, avec votre armée, et la colonne « Flood max » des Cibles à portée.",
    options: [],
  },
  {
    id: "hunt-reports",
    label: "Rapports de chasse",
    description:
      "Dans la messagerie : un tableau des combats de chaque chasse, avec les pertes prévues par le simulateur.",
    options: [],
  },
  {
    id: "combat-simulator",
    label: "Simulateur de combat",
    description:
      "Bouton dans la barre du haut, sur toutes les pages : le simulateur s'ouvre par-dessus le jeu. Il reste ouvrable depuis l'onglet Outils.",
    options: [],
  },
  {
    id: "alliance-map",
    label: "Carte de l'alliance",
    description: "Entrée « Carte » dans le menu d'alliance : où sont les membres et qui est proche de qui.",
    options: [],
  },
  {
    id: "tdc-chain",
    label: "Chaîne de TDC",
    description:
      "Entrée « Chaîne » dans le menu d'alliance : qui peut prendre à qui, rôles, et l'ordre des floods pour faire monter le TDC.",
    options: [],
  },
  {
    id: "history",
    label: "Historique de progression",
    description:
      "Courbes du TDC et des scores dans le temps, d'après les exports publics de chaque nuit, pour comparer avec votre alliance.",
    options: [
      { id: "alliance", label: "Entrée « Historique » dans le menu d'alliance" },
      { id: "profile", label: "Encart « Progression » sur les profils" },
    ],
  },
  {
    id: "alliance-sharing",
    label: "Partage d'alliance",
    description:
      "Entrée « Mon état » dans le menu Fourmilière pour copier votre état à coller sur Discord, et « Partage » dans le menu d'alliance pour lire celui des membres.",
    options: [],
  },
  {
    id: "hunt-launcher",
    label: "Lanceur de chasse",
    description: "Sur Ressources : combien chasser, avec quoi, et lancer en un clic.",
    options: [],
  },
  {
    id: "safe-reload",
    label: "Rechargement sans risque",
    description:
      "Recharger une page ou revenir en arrière ne renvoie plus un formulaire (ponte, chasse, ouvrières) ni un lien d'action (construction, annulation).",
    options: [],
  },
] as const satisfies readonly CatalogEntry[];

export type FeatureId = (typeof featureCatalog)[number]["id"];
