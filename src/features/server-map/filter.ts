// Bounds on a chip: only its players within them are drawn in colour. See docs/features/carte-serveur.md.
import type { Player } from "@/data/exports";
import { formatNumber } from "@/utils/number-format";

/** Scores of the players export the chips filter on. */
export type FilterKey = "field" | "buildingScore" | "technologyScore";

/** Inclusive; null: no bound on that side. */
export interface Bounds {
  min: number | null;
  max: number | null;
}

export type ChipFilter = Partial<Record<FilterKey, Bounds>>;

/** As the game names them in its rankings. */
export const FILTER_LABELS: Record<FilterKey, string> = {
  field: "TDC",
  buildingScore: "Fourmilière",
  technologyScore: "Technologie",
};

const KEYS = Object.keys(FILTER_LABELS) as FilterKey[];

const criteria = (filter: ChipFilter | undefined) =>
  KEYS.flatMap((key) => {
    const bounds = filter?.[key];
    return bounds && (bounds.min !== null || bounds.max !== null) ? [{ key, ...bounds }] : [];
  });

export const isFiltering = (filter: ChipFilter | undefined) => criteria(filter).length > 0;

export function passesFilter(player: Player, filter: ChipFilter | undefined): boolean {
  return criteria(filter).every(
    ({ key, min, max }) => (min === null || player[key] >= min) && (max === null || player[key] <= max),
  );
}

/** The filter with one bound changed; a criterion left without any bound is dropped. */
export function setBound(
  filter: ChipFilter | undefined,
  key: FilterKey,
  side: keyof Bounds,
  value: number | null,
): ChipFilter {
  const bounds = { min: null, max: null, ...filter?.[key], [side]: value };
  const next: ChipFilter = { ...filter, [key]: bounds };
  return Object.fromEntries(criteria(next).map(({ key: kept, min, max }) => [kept, { min, max }]));
}

/** The TDC a player of field `mine` may attack: from 50 % (included) to 300 % (excluded), as `inRange`. */
export function attackableBounds(mine: number): Bounds {
  return { min: Math.ceil(mine / 2), max: mine * 3 - 1 };
}

/** « TDC ≥ 10 000 · Fourmilière 10 à 20 · Technologie ≤ 30 », empty without a filter. */
export function filterSummary(filter: ChipFilter | undefined): string {
  return criteria(filter)
    .map(({ key, min, max }) => {
      const label = FILTER_LABELS[key];
      if (min !== null && max !== null) return `${label} ${formatNumber(min)} à ${formatNumber(max)}`;
      return min !== null ? `${label} ≥ ${formatNumber(min)}` : `${label} ≤ ${formatNumber(max ?? 0)}`;
    })
    .join(" · ");
}
