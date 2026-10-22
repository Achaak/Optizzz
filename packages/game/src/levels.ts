// Buildings (construction.php) and research (laboratoire.php), as listed on s5 (docs/research/fourmizzz-pages.md).
// The order is part of the shared state format (docs/features/partage-alliance.md): append, never reorder.

export const BUILDINGS = [
  { key: "mushroom", name: "Champignonnière" },
  { key: "foodWarehouse", name: "Entrepôt de Nourriture" },
  { key: "materialWarehouse", name: "Entrepôt de Matériaux" },
  { key: "nursery", name: "Couveuse" },
  { key: "solarium", name: "Solarium" },
  { key: "laboratory", name: "Laboratoire" },
  { key: "analysisRoom", name: "Salle d’analyse" },
  { key: "combatRoom", name: "Salle de combat" },
  { key: "barracks", name: "Caserne" },
  { key: "dome", name: "Dôme" },
  { key: "lodge", name: "Loge Impériale" },
  { key: "aphids", name: "Étable à pucerons" },
  { key: "cochineal", name: "Étable à cochenilles" },
] as const;

export const RESEARCH = [
  { key: "laying", name: "Technique de ponte" },
  { key: "shield", name: "Bouclier Thoracique" },
  { key: "weapons", name: "Armes" },
  { key: "architecture", name: "Architecture" },
  { key: "animals", name: "Communication avec les animaux" },
  { key: "huntSpeed", name: "Vitesse de chasse" },
  { key: "attackSpeed", name: "Vitesse d’attaque" },
  { key: "genetics", name: "Génétique" },
  { key: "acid", name: "Acide" },
  { key: "poison", name: "Poison" },
] as const;

export type BuildingKey = (typeof BUILDINGS)[number]["key"];
export type ResearchKey = (typeof RESEARCH)[number]["key"];

/** « Étable à pucerons » and « Etable a pucerons » are the same: the game is not consistent with accents. */
export const normalizeLevelName = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/['’]/g, "’").trim().toLowerCase();

export const sameName = (a: string, b: string) => normalizeLevelName(a) === normalizeLevelName(b);
