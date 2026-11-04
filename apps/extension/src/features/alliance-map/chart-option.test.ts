import { describe, expect, it } from "vitest";
import { buildChartOption, tdcBubblePx, type MapMember } from "./chart-option";
import type { KnownLevels } from "./neighbor-table";
import type { MemberBubble } from "@/features/tdc-chain/role-styles";

const member = (id: number, x: number, huntingField = 1000, y = 10): MapMember => ({
  id,
  pseudo: `P${String(id)}`,
  x,
  y,
  alliance: "TAG",
  field: huntingField,
  huntingField,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
  masterPlayerId: null,
});

interface Node {
  symbol?: string;
  symbolSize: number;
  itemStyle: { color: string; borderWidth?: number };
  label: { show?: boolean; formatter?: string };
}
const nodes = (option: ReturnType<typeof buildChartOption>) => (option.series as { data: Node[] }[])[0]?.data ?? [];
const size = { width: 500, height: 500 };
const noLevels: KnownLevels = {
  myId: 1,
  labLevel: 0,
  manualLevel: null,
  byPlayer: new Map(),
  enteredAt: new Map(),
  shared: new Map(),
};

describe("chain roles on the map", () => {
  const me = member(1, 10);
  const members = [me, member(2, 30)];
  const levels = noLevels;

  it("draws each member with its role's colour, size and shape, the selected one ringed and a little bigger", () => {
    const bubbles = new Map<number, MemberBubble>([
      [1, { role: { kind: "granary", rank: 1 } as const, color: "#111111", px: 17, shape: "square" as const }],
      [2, { role: { kind: "hunter" } as const, color: "#222222", px: 8, shape: "circle" as const }],
    ]);
    const [selected, other] = nodes(buildChartOption(members, me, 1, levels, { width: 500, height: 500 }, bubbles));
    expect(other).toMatchObject({ symbol: "circle", symbolSize: 8, itemStyle: { color: "#222222", borderWidth: 0 } });
    expect(selected).toMatchObject({ symbol: "rect" });
    expect(selected?.itemStyle.color).toBe("#111111");
    expect(selected?.symbolSize).toBeGreaterThan(17);
    expect(selected?.itemStyle.borderWidth).toBeGreaterThan(0);
  });
});

const granary: MemberBubble = {
  role: { kind: "granary", rank: 1 } as const,
  color: "#111111",
  px: 17,
  shape: "square" as const,
};
const hunter: MemberBubble = { role: { kind: "hunter" } as const, color: "#222222", px: 8, shape: "circle" as const };

describe("bubble size by hunting field", () => {
  it("gives the bubble an area proportional to the hunting field, within bounds", () => {
    expect(tdcBubblePx(4000, 4000)).toBe(26);
    expect(tdcBubblePx(1000, 4000)).toBe(13);
    expect(tdcBubblePx(1, 4000)).toBe(6);
    expect(tdcBubblePx(0, 0)).toBe(6);
  });

  it("sizes every member by its hunting field, the selected one ringed but not enlarged", () => {
    const me = member(1, 10, 4000);
    const members = [me, member(2, 30, 1000)];
    const [selected, other] = nodes(
      buildChartOption(members, me, 1, noLevels, size, null, { sizeByTdc: true, labels: "pseudo" }),
    );
    expect(selected?.symbolSize).toBe(26);
    expect(selected?.itemStyle.borderWidth).toBeGreaterThan(0);
    expect(other?.symbolSize).toBe(13);
  });

  it("keeps the chain role's colour and shape, not its size", () => {
    const me = member(1, 10, 4000);
    const members = [me, member(2, 30, 1000)];
    const bubbles = new Map<number, MemberBubble>([
      [1, granary],
      [2, hunter],
    ]);
    const [, other] = nodes(
      buildChartOption(members, me, 1, noLevels, size, bubbles, { sizeByTdc: true, labels: "pseudo" }),
    );
    expect(other).toMatchObject({ symbol: "circle", symbolSize: 13, itemStyle: { color: "#222222" } });
  });
});

describe("labels", () => {
  const me = member(1, 10);
  const members = [me, member(2, 30)];
  const bubbles = new Map<number, MemberBubble>([
    [1, granary],
    [2, hunter],
  ]);
  const labels = (mode: "pseudoRole" | "pseudo" | "none", withBubbles = true, list = members) =>
    nodes(
      buildChartOption(list, me, 1, noLevels, size, withBubbles ? bubbles : null, { sizeByTdc: false, labels: mode }),
    ).map((n) => n.label);

  it("writes the pseudo by default", () => {
    expect(nodes(buildChartOption(members, me, 1, noLevels, size)).map((n) => n.label.formatter)).toEqual(["P1", "P2"]);
  });

  it("writes the pseudo and the chain role", () => {
    expect(labels("pseudoRole").map((l) => l.formatter)).toEqual(["P1 · Grenier 1", "P2 · Chasseur"]);
  });

  it("writes the pseudo alone when the roles are not shown", () => {
    expect(labels("pseudoRole", false).map((l) => l.formatter)).toEqual(["P1", "P2"]);
  });

  it("writes nothing", () => {
    expect(labels("none").every((l) => l.show === false)).toBe(true);
  });

  it("falls back to the pseudo when there is no free spot for the pseudo and role", () => {
    const crowd = [me, ...Array.from({ length: 12 }, (_, i) => member(i + 2, 10 + (i % 2), 1000, 10 + (i % 3)))];
    const crowdBubbles = new Map(crowd.map((m) => [m.id, hunter]));
    const written = nodes(
      buildChartOption(crowd, me, 1, noLevels, size, crowdBubbles, { sizeByTdc: false, labels: "pseudoRole" }),
    ).map((n) => n.label.formatter);
    expect(written).toContain("P1 · Chasseur");
    expect(written.some((text) => text && !text.includes("·"))).toBe(true);
  });
});

describe("tooltip", () => {
  it("gives the trips both ways, each at its sender's level", () => {
    const me = member(1, 10);
    const members = [me, member(2, 30)];
    const levels: KnownLevels = { ...noLevels, labLevel: 10, byPlayer: new Map([[2, 0]]) };
    const option = buildChartOption(members, me, 1, levels, size);
    const formatter = (option.tooltip as { formatter: (p: { dataType: string; dataIndex: number }) => string })
      .formatter;
    const text = formatter({ dataType: "node", dataIndex: 1 });
    expect(text).toContain("Trajet P1 → P2 : ");
    expect(text).toMatch(/Trajet P2 → P1 : [^≈]/);
    expect(text.indexOf("Trajet P1 → P2")).toBeLessThan(text.indexOf("Trajet P2 → P1"));
  });

  it("marks an estimated return trip", () => {
    const me = member(1, 10);
    const members = [me, member(2, 30)];
    const option = buildChartOption(members, me, 1, noLevels, size);
    const formatter = (option.tooltip as { formatter: (p: { dataType: string; dataIndex: number }) => string })
      .formatter;
    expect(formatter({ dataType: "node", dataIndex: 1 })).toContain("Trajet P2 → P1 : ≈ ");
  });
});
