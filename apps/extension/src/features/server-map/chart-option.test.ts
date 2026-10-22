import { describe, expect, it } from "vitest";
import type { Player } from "@optizzz/game/exports";
import { buildServerMapOption, playerAt, SERIES, type ServerMapInput } from "./chart-option";
import type { Chip } from "./selection";

let nextId = 1;
const player = (pseudo: string, x: number, y: number, fields: Partial<Player> = {}): Player => ({
  id: nextId++,
  pseudo,
  alliance: null,
  masterPlayerId: null,
  x,
  y,
  field: 1000,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
  ...fields,
});

interface Series {
  data: { value: number[]; label?: { show?: boolean; formatter?: string } }[];
}

describe("server map option", () => {
  const me = player("Moi", 1, 1, { alliance: "MOI" });
  const a = player("A", 10, 10, { alliance: "EVO" });
  const b = player("B", 20, 10, { alliance: "EVO" });
  const solo = player("Solo", 40, 40, { masterPlayerId: a.id });
  const other = player("Autre", 30, 5);
  const evo: Chip = { kind: "alliance", tag: "EVO", color: "#e" };
  const input = (pseudos: boolean): ServerMapInput => ({
    players: [me, a, b, solo, other],
    highlighted: new Map<Player, Chip>([
      [me, { kind: "alliance", tag: "MOI", color: "#m" }],
      [a, evo],
      [b, evo],
      [solo, { kind: "player", id: solo.id, color: "#s" }],
    ]),
    me,
    reference: me,
    level: { level: 0, estimated: false },
    pseudos,
    focusedId: null,
    axes: { x: [0, 60], y: [0, 60] },
    size: { width: 600, height: 600 },
  });
  const series = (pseudos: boolean) => buildServerMapOption(input(pseudos)).series as Series[];

  it("draws every player in the background, the chosen ones over it and me apart", () => {
    const [background, chosen, mine] = series(true);
    expect(background?.data).toHaveLength(5);
    expect(chosen?.data.map((point) => point.label?.formatter)).toEqual(["A", "B", "⛓ Solo"]);
    expect(mine?.data[0]?.value).toEqual([1, 1]);
  });

  it("zoomed out, writes each alliance's tag instead of its members' pseudos, a lone player keeps theirs", () => {
    const [, chosen, , tags] = series(false);
    expect(chosen?.data.map((point) => point.label?.show)).toEqual([false, false, true]);
    expect(tags?.data).toEqual([{ value: [15, 10], label: { formatter: "EVO", color: "#e" } }]);
    expect(series(true)[SERIES.tags]?.data).toEqual([]);
  });

  it("forced, writes every chosen player's pseudo and no tag", () => {
    const [, chosen, , tags] = buildServerMapOption({ ...input(false), allNames: true }).series as Series[];
    expect(chosen?.data.map((point) => point.label?.show)).toEqual([true, true, true]);
    expect(tags?.data).toEqual([]);
  });

  it("can leave the other players of the server out", () => {
    const [background, chosen] = buildServerMapOption({ ...input(true), others: false }).series as Series[];
    expect(background?.data).toEqual([]);
    expect(chosen?.data).toHaveLength(3);
  });

  it("finds the player under a click in any series", () => {
    expect(playerAt(input(true), { seriesIndex: SERIES.background, dataIndex: 4 })).toBe(other);
    expect(playerAt(input(true), { seriesIndex: SERIES.chosen, dataIndex: 1 })).toBe(b);
    expect(playerAt(input(true), { seriesIndex: SERIES.me, dataIndex: 0 })).toBe(me);
    expect(playerAt(input(true), { seriesIndex: SERIES.tags, dataIndex: 0 })).toBeUndefined();
  });
});
