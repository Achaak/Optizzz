import { describe, expect, it } from "vitest";
import { CHART_COLORS } from "@/theme";
import { bubbleOf, memberBubbles, rolesTopDown, styleOf } from "./role-styles";
import type { Role } from "./roles";

const granary: Role = { kind: "granary" };
const hunter: Role = { kind: "hunter" };
const passer = (rank: number): Role => ({ kind: "passer", rank });

describe("role styles", () => {
  it("gives every role a default, each passer rung its own colour", () => {
    const colors = [granary, passer(1), passer(2), passer(3), hunter].map((role) => styleOf(role, {}).color);
    expect(new Set(colors).size).toBe(colors.length);
    expect(styleOf(granary, {}).size).toBe("large");
    expect(styleOf(hunter, {}).size).toBe("small");
  });

  it("uses the style chosen for the role", () => {
    const styles = { "passer:2": { color: 5, size: "large" as const } };
    expect(styleOf(passer(2), styles)).toEqual({ color: 5, size: "large" });
    expect(styleOf(passer(1), styles)).toEqual(styleOf(passer(1), {}));
  });

  it("falls back to the default for a stored style it cannot draw", () => {
    const styles = { hunter: { color: 99, size: "huge" } } as unknown as Parameters<typeof styleOf>[1];
    expect(styleOf(hunter, styles)).toEqual(styleOf(hunter, {}));
  });

  it("draws a style with the palette's colour and a size in pixels, growing with the size", () => {
    const small = bubbleOf({ color: 1, size: "small" });
    const large = bubbleOf({ color: 1, size: "large" });
    expect(small.color).toBe(CHART_COLORS.series[1]);
    expect(large.px).toBeGreaterThan(bubbleOf({ color: 1, size: "medium" }).px);
    expect(bubbleOf({ color: 1, size: "medium" }).px).toBeGreaterThan(small.px);
  });
});

describe("roles in use", () => {
  it("lists each role once, from the granaries down to the members out of the chain", () => {
    const roles = [hunter, passer(1), { kind: "out" } as const, granary, passer(3), hunter, passer(1)];
    expect(rolesTopDown(roles)).toEqual([granary, passer(3), passer(1), hunter, { kind: "out" }]);
  });
});

describe("member bubbles for the map", () => {
  const member = (id: number, huntingField: number, onHoliday = false) => ({
    id,
    huntingField,
    onHoliday,
    isBanned: false,
  });

  it("draws each member with the bubble of its chain role, the ones on holiday out of the chain", () => {
    const styles = { granary: { color: 6, size: "small" as const } };
    const bubbles = memberBubbles(
      [member(1, 1000), member(2, 400), member(3, 2000, true)],
      { 1: granary, 2: hunter, 3: granary },
      styles,
    );
    expect(bubbles.get(1)).toEqual({
      role: granary,
      color: CHART_COLORS.series[6],
      px: bubbleOf(styleOf(granary, styles)).px,
    });
    expect(bubbles.get(2)?.role).toEqual(hunter);
    expect(bubbles.get(3)?.role).toEqual({ kind: "out" });
  });

  it("uses the proposed roles until the chain's are set", () => {
    const bubbles = memberBubbles([member(1, 1000), member(2, 600)], null, {});
    expect(bubbles.get(1)?.role).toEqual(granary);
    expect(bubbles.get(2)?.role).toEqual(hunter);
  });
});
