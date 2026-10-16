// Colour and size of each chain role's bubble on the alliance map, chosen in the chain. See docs/features/chaine-tdc.md.
import { CHART_COLORS } from "@/theme";
import { chainRoles, roleKey, type Role } from "./roles";

export type BubbleSize = "small" | "medium" | "large";

/**
 * Shape of a role's bubble, fixed by the kind of role: the kind still reads without telling the colours apart
 * (colour blindness). The passer rungs share a shape, their default colours are the ones told apart all together.
 */
export type BubbleShape = "square" | "diamond" | "circle" | "triangle";

const SHAPES: Record<Role["kind"], BubbleShape> = {
  granary: "square",
  passer: "diamond",
  hunter: "circle",
  out: "triangle",
};

/** ECharts' symbol for each shape. */
export const SHAPE_SYMBOLS: Record<BubbleShape, string> = {
  square: "rect",
  diamond: "diamond",
  circle: "circle",
  triangle: "triangle",
};

export interface RoleStyle {
  /** Index in the chart palette (`CHART_COLORS.series`): always readable on the parchment. */
  color: number;
  size: BubbleSize;
}

/** Styles chosen by the player, by {@link roleKey}; a role missing has its default. */
export type RoleStyles = Readonly<Record<string, RoleStyle>>;

export const BUBBLE_SIZES: Record<BubbleSize, { label: string; px: number }> = {
  small: { label: "Petite", px: 8 },
  medium: { label: "Moyenne", px: 12 },
  large: { label: "Grande", px: 17 },
};

export const PALETTE: readonly string[] = CHART_COLORS.series;

/**
 * Default colours of the passer rungs, from the first up (blue, gold, orange, sky, violet); they cycle past the
 * fifth. The first three stay apart with a red-green colour blindness.
 */
const PASSER_COLORS = [1, 2, 5, 4, 6];

function defaultStyle(role: Role): RoleStyle {
  switch (role.kind) {
    case "granary":
      return { color: 0, size: "large" };
    case "passer":
      return { color: PASSER_COLORS[(role.rank - 1) % PASSER_COLORS.length] ?? 1, size: "medium" };
    case "hunter":
      return { color: 7, size: "small" };
    case "out":
      return { color: 3, size: "small" };
  }
}

/** The style chosen for the role, or its default when none was chosen or the stored one cannot be drawn. */
export function styleOf(role: Role, styles: RoleStyles): RoleStyle {
  const chosen = styles[roleKey(role)];
  const valid =
    chosen !== undefined &&
    Number.isInteger(chosen.color) &&
    chosen.color >= 0 &&
    chosen.color < PALETTE.length &&
    chosen.size in BUBBLE_SIZES;
  return valid ? chosen : defaultStyle(role);
}

/** What the map draws: the palette colour, the size in pixels and the role's shape. */
export const bubbleOf = (role: Role, style: RoleStyle) => ({
  color: PALETTE[style.color] ?? CHART_COLORS.member,
  px: BUBBLE_SIZES[style.size].px,
  shape: SHAPES[role.kind],
});

const height = (role: Role) =>
  role.kind === "granary" ? Infinity : role.kind === "passer" ? role.rank : role.kind === "hunter" ? 0 : -1;

/** Each role once, from the granaries down to the hunters, then the members out of the chain. */
export function rolesTopDown(roles: Iterable<Role>): Role[] {
  const distinct = new Map([...roles].map((role) => [roleKey(role), role]));
  return [...distinct.values()].sort((a, b) => height(b) - height(a));
}

export interface MemberBubble {
  role: Role;
  color: string;
  px: number;
  shape: BubbleShape;
}

interface MapMember {
  id: number;
  huntingField: number;
  onHoliday: boolean;
  isBanned: boolean;
}

/**
 * Each member's role in the chain and its bubble, for the map: the same roles as the chain shows (players on holiday
 * or banned are never in it).
 */
export function memberBubbles(
  members: readonly MapMember[],
  storedRoles: Readonly<Record<string, Role>> | null,
  styles: RoleStyles,
): Map<number, MemberBubble> {
  const inChain = members.filter((m) => !m.onHoliday && !m.isBanned).map((m) => ({ id: m.id, field: m.huntingField }));
  const roles = chainRoles(inChain, storedRoles);
  return new Map(
    members.map((m) => {
      const role = roles.get(m.id) ?? { kind: "out" };
      return [m.id, { role, ...bubbleOf(role, styleOf(role, styles)) }];
    }),
  );
}
