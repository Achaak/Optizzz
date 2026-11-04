import type { MemberStates, SharedState } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import type { FloodItem } from "@optizzz/game/site-links/envoi-floods";
import { describe, expect, it } from "vitest";
import {
  COLUMN_GROUPS,
  DEFAULT_COLUMNS,
  cellChange,
  cellReadAt,
  isOld,
  nextSort,
  parseColumns,
  sortRows,
  tableRows,
  toggleColumn,
  type TableRow,
} from "./member-table";
import type { MemberState } from "./states";

const NOW = new Date("2026-11-03T15:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3600_000);
const state = (pseudo: string, readAt: Date, parts: Partial<SharedState>): SharedState => ({
  server: "s5",
  alliance: "ABC",
  pseudo,
  readAt,
  ...parts,
});

describe("columns", () => {
  it("offers every column once, the defaults among them", () => {
    const keys = COLUMN_GROUPS.flatMap((group) => group.columns.map((column) => column.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of DEFAULT_COLUMNS) expect(keys).toContain(key);
  });

  it("starts from the former summary, plus what each member sends and their last Envoi", () => {
    expect(DEFAULT_COLUMNS).toEqual([
      "production",
      "huntingField",
      "workers",
      "army",
      "research.shield",
      "research.weapons",
      "research.attackSpeed",
      "buildings.dome",
      "buildings.lodge",
      "nextWork",
      "sends",
      "lastEnvoi",
    ]);
  });

  it("reads the stored choice, dropping what is unknown, the defaults when nothing is stored", () => {
    expect(parseColumns(null)).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns("not json")).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns('{"a":1}')).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns('["workers","nope","huntingField"]')).toEqual(["huntingField", "workers"]);
    expect(parseColumns("[]")).toEqual([]);
  });

  it("keeps the defaults in the menu's order, so that a toggle moves nothing", () => {
    expect(toggleColumn(toggleColumn(DEFAULT_COLUMNS, "hunts"), "hunts")).toEqual(DEFAULT_COLUMNS);
  });

  it("toggles a column, keeping the menu's order", () => {
    expect(toggleColumn(["workers"], "huntingField")).toEqual(["huntingField", "workers"]);
    expect(toggleColumn(["huntingField", "workers"], "huntingField")).toEqual(["workers"]);
  });
});

describe("tableRows", () => {
  const members = [
    { playerId: 1, pseudo: "Messor" },
    { playerId: 2, pseudo: "Lasius" },
  ];
  const merged: MemberState[] = [
    { pseudo: "Messor", states: { latest: state("Messor", hoursAgo(2), { workers: 10 }) } },
    { pseudo: "Lasius", states: null },
  ];
  const convoy = (from: string, to: string, at: Date, food = 0, kind: ConvoyItem["kind"] = "transit") => ({
    kind,
    from,
    to,
    food,
    materials: 0,
    at: at.getTime(),
    observedAt: hoursAgo(5).getTime(),
    reporter: from,
  });
  const flood = (from: string, target: string, at: Date): FloodItem & { observedAt: number } => ({
    from,
    target,
    at: at.getTime(),
    take: null,
    observedAt: hoursAgo(1).getTime(),
  });

  it("counts the convoys on their way, sent and received, and what comes", () => {
    const rows = tableRows({
      members,
      merged,
      envois: [],
      convoys: [
        convoy("Messor", "Lasius", hoursAgo(-2), 500),
        convoy("Messor", "Lasius", hoursAgo(-1), 300),
        convoy("Lasius", "messor", hoursAgo(-3)),
        convoy("Messor", "Lasius", hoursAgo(1), 900),
        convoy("Messor", "Lasius", hoursAgo(-4), 900, "delivered"),
      ],
      floods: [],
      sends: [],
      now: NOW,
    });
    expect(rows[0]?.convoys).toMatchObject({ sent: 2, received: 1 });
    expect(rows[1]?.convoys).toEqual({
      sent: 1,
      received: 2,
      food: 800,
      materials: 0,
      nextArrival: hoursAgo(-1),
    });
  });

  it("counts the floods on their way, launched and aimed at the member", () => {
    const rows = tableRows({
      members,
      merged,
      envois: [],
      convoys: [],
      floods: [
        flood("Messor", "Gargantua", hoursAgo(-1)),
        flood("Messor", "LASIUS", hoursAgo(-2)),
        flood("Messor", "Lasius", hoursAgo(3)),
      ],
      sends: [],
      now: NOW,
    });
    expect(rows[0]?.floods).toEqual({ launched: 2, aimed: 0, nextArrival: hoursAgo(-1) });
    expect(rows[1]?.floods).toEqual({ launched: 0, aimed: 1, nextArrival: hoursAgo(-2) });
  });

  it("dates the last Envoi by the newest of the member's states, convoys and floods, never by a pasted state", () => {
    const envois: MemberStates[] = [{ latest: state("messor", hoursAgo(6), { workers: 10 }) }];
    const rows = tableRows({
      members,
      merged,
      envois,
      convoys: [convoy("Messor", "Lasius", hoursAgo(-2))],
      floods: [flood("Messor", "Gargantua", hoursAgo(-1))],
      sends: [{ playerId: 1, categories: ["convoys", "floods", "nonsense"] }],
      now: NOW,
    });
    expect(rows[0]?.lastEnvoi).toEqual(hoursAgo(1));
    expect(rows[0]?.sends).toEqual(["convoys", "floods"]);
    // Lasius only pasted (nothing in `envois`), and is the convoy's recipient, not its reporter.
    expect(rows[1]?.lastEnvoi).toBeNull();
    expect(rows[1]?.sends).toEqual([]);
  });
});

describe("cells", () => {
  const row = (states: MemberStates | null): TableRow => ({
    pseudo: "Messor",
    states,
    sends: [],
    lastEnvoi: null,
    convoys: { sent: 0, received: 0, food: 0, materials: 0, nextArrival: null },
    floods: { launched: 0, aimed: 0, nextArrival: null },
  });
  const messor = row({
    latest: state("Messor", hoursAgo(1), { workers: 12, research: { weapons: 13 } }),
    previous: state("Messor", hoursAgo(30), { workers: 10, research: { weapons: 13 } }),
    partsReadAt: { workers: hoursAgo(1), research: hoursAgo(50) },
  });

  it("dates a cell by its own part", () => {
    expect(cellReadAt(messor, "workers")).toEqual(hoursAgo(1));
    expect(cellReadAt(messor, "research.weapons")).toEqual(hoursAgo(50));
    expect(cellReadAt(messor, "sends")).toBeUndefined();
    expect(cellReadAt(row(null), "workers")).toBeUndefined();
  });

  it("says a reading is old past 48 hours", () => {
    expect(isOld(hoursAgo(47), NOW)).toBe(false);
    expect(isOld(hoursAgo(49), NOW)).toBe(true);
  });

  it("shows a change read in the last 24 hours", () => {
    expect(cellChange(messor, "workers", NOW)).toBe("up");
    expect(cellChange(messor, "research.weapons", NOW)).toBeUndefined();
    const fell = row({
      latest: state("Messor", hoursAgo(30), { workers: 8 }),
      previous: state("Messor", hoursAgo(40), { workers: 10 }),
      partsReadAt: { workers: hoursAgo(30) },
    });
    expect(cellChange(fell, "workers", NOW)).toBeUndefined();
    const fresh = row({
      latest: state("Messor", hoursAgo(2), { workers: 8 }),
      previous: state("Messor", hoursAgo(40), { workers: 10 }),
      partsReadAt: { workers: hoursAgo(2) },
    });
    expect(cellChange(fresh, "workers", NOW)).toBe("down");
  });
});

describe("sorting", () => {
  const row = (pseudo: string, workers?: number): TableRow => ({
    pseudo,
    states: workers === undefined ? null : { latest: state(pseudo, hoursAgo(1), { workers }) },
    sends: [],
    lastEnvoi: null,
    convoys: { sent: 0, received: 0, food: 0, materials: 0, nextArrival: null },
    floods: { launched: 0, aimed: 0, nextArrival: null },
  });
  const rows = [row("A", 5), row("B"), row("C", 9), row("D", 1)];

  it("goes down, then up, then back to the space's order", () => {
    expect(nextSort(null, "workers")).toEqual({ key: "workers", direction: "descending" });
    expect(nextSort({ key: "workers", direction: "descending" }, "workers")).toEqual({
      key: "workers",
      direction: "ascending",
    });
    expect(nextSort({ key: "workers", direction: "ascending" }, "workers")).toBeNull();
    expect(nextSort({ key: "workers", direction: "ascending" }, "huntingField")).toEqual({
      key: "huntingField",
      direction: "descending",
    });
  });

  it("keeps the empty cells at the bottom both ways", () => {
    const names = (sorted: TableRow[]) => sorted.map((r) => r.pseudo);
    expect(names(sortRows(rows, null, NOW))).toEqual(["A", "B", "C", "D"]);
    expect(names(sortRows(rows, { key: "workers", direction: "descending" }, NOW))).toEqual(["C", "A", "D", "B"]);
    expect(names(sortRows(rows, { key: "workers", direction: "ascending" }, NOW))).toEqual(["D", "A", "C", "B"]);
  });

  it("sorts the convoys by those received, the floods by those launched", () => {
    const withMoves = (pseudo: string, received: number, launched: number): TableRow => ({
      ...row(pseudo),
      convoys: { sent: 9 - received, received, food: 0, materials: 0, nextArrival: null },
      floods: { launched, aimed: 9 - launched, nextArrival: null },
    });
    const moving = [withMoves("A", 1, 3), withMoves("B", 2, 1)];
    const first = (key: "convoys" | "floods") => sortRows(moving, { key, direction: "descending" }, NOW)[0]?.pseudo;
    expect(first("convoys")).toBe("B");
    expect(first("floods")).toBe("A");
  });
});
