import { describe, expect, it } from "vitest";
import { buildChartOption, type MapMember } from "./chart-option";
import type { KnownLevels } from "./neighbor-table";

describe("chain roles on the map", () => {
  const member = (id: number, x: number): MapMember => ({
    id,
    pseudo: `P${String(id)}`,
    x,
    y: 10,
    alliance: "TAG",
    field: 1000,
    huntingField: 1000,
    grade: null,
    buildingScore: 0,
    technologyScore: 0,
    trophyScore: 0,
    onHoliday: false,
    isBanned: false,
    masterPlayerId: null,
  });
  const me = member(1, 10);
  const members = [me, member(2, 30)];
  const levels: KnownLevels = {
    myId: 1,
    labLevel: 0,
    manualLevel: null,
    byPlayer: new Map(),
    enteredAt: new Map(),
    shared: new Map(),
  };
  const nodes = (option: ReturnType<typeof buildChartOption>) =>
    (option.series as { data: { symbolSize: number; itemStyle: { color: string; borderWidth?: number } }[] }[])[0]
      ?.data ?? [];

  it("draws each member with its role's colour and size, the selected one ringed and a little bigger", () => {
    const bubbles = new Map([
      [1, { role: { kind: "granary" } as const, color: "#111111", px: 17 }],
      [2, { role: { kind: "hunter" } as const, color: "#222222", px: 8 }],
    ]);
    const [selected, other] = nodes(buildChartOption(members, me, 1, levels, { width: 500, height: 500 }, bubbles));
    expect(other).toMatchObject({ symbolSize: 8, itemStyle: { color: "#222222", borderWidth: 0 } });
    expect(selected?.itemStyle.color).toBe("#111111");
    expect(selected?.symbolSize).toBeGreaterThan(17);
    expect(selected?.itemStyle.borderWidth).toBeGreaterThan(0);
  });
});
