import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { describe, expect, it } from "vitest";
import { balanceOf, type BalanceInput, type BalancePlayer } from "./balance";
import { parisMidnight } from "./convoy-stats";
import { dayTableDiscord, dayTableOf, memberDaysOf, sortDayRows } from "./day-table";

// Tuesday 3 November 2026, noon in Paris: today counts half a day.
const NOW = new Date("2026-11-03T11:00:00Z");
const day = (back: number) => parisMidnight(NOW, back);

/** In « 4O4 » every day from `back` days ago to today, with this TDC. */
const player = (pseudo: string, field: number, from = 2, extra: Partial<BalancePlayer> = {}): BalancePlayer => ({
  pseudo,
  master: null,
  days: [
    ...(from < 2 ? [{ day: day(2), field, alliance: "AUTRE" }] : []),
    ...Array.from({ length: from + 1 }, (_, i) => ({ day: day(from - i), field, alliance: "4O4" })),
  ],
  ...extra,
});

const delivered = (from: string, to: string, food: number, at: number): ConvoyItem => ({
  kind: "delivered",
  from,
  to,
  food,
  materials: 0,
  at,
});

const balance = (extra: Partial<BalanceInput> = {}) =>
  balanceOf({
    tag: "4O4",
    members: ["Noctis", "Okapi", "Grop"],
    senders: ["Noctis", "Okapi"],
    players: [player("Noctis", 2_000), player("Okapi", 1_000, 1), player("Grop", 500)],
    convoys: [
      delivered("Noctis", "Okapi", 30_000, day(2) + 3600_000),
      delivered("Noctis", "Grop", 10_000, day(0) + 3600_000),
      delivered("Noctis", "Grop", 5_000, day(0) + 2 * 3600_000),
    ],
    days: 3,
    now: NOW,
    ...extra,
  });

describe("the Jours table of the alliance", () => {
  it("gives each member's production day by day, its total and its average over their days in the alliance", () => {
    const table = dayTableOf(balance(), "production");
    expect(table.columns.map((c) => c.label)).toEqual(["01/11", "02/11", "03/11"]);
    const okapi = table.rows.find((r) => r.label === "Okapi");
    // Arrived yesterday: nothing the day before, half of today.
    expect(okapi?.cells).toEqual([null, 48_000, 24_000]);
    expect(okapi?.total).toBe(72_000);
    expect(okapi?.average).toBe(48_000);
  });

  it("heads the table with the alliance, the members present added up, its average over the period", () => {
    const table = dayTableOf(balance(), "production");
    expect(table.alliance.cells).toEqual([120_000, 168_000, 84_000]);
    expect(table.alliance.total).toBe(372_000);
    expect(table.alliance.average).toBe(372_000 / 2.5);
    expect(table.alliance.partial).toBe(false);
  });

  it("gives the TDC of each day, no total, its average over the days", () => {
    const table = dayTableOf(balance(), "field");
    expect(table.rows.find((r) => r.label === "Noctis")).toMatchObject({
      cells: [2_000, 2_000, 2_000],
      total: null,
      average: 2_000,
    });
    expect(table.alliance.cells).toEqual([2_500, 3_500, 3_500]);
  });

  it("gives the production after colony taxes", () => {
    const players = [player("Noctis", 2_000), player("Okapi", 1_000, 2, { master: "Noctis" }), player("Grop", 500)];
    const table = dayTableOf(balance({ players, taxRates: { okapi: 0.25 } }), "afterColonies");
    expect(table.rows.find((r) => r.label === "Okapi")?.cells[0]).toBe(48_000 * 0.75);
    expect(table.rows.find((r) => r.label === "Noctis")?.cells[0]).toBe(96_000 + 12_000);
  });

  it("gives what each member delivered and how many convoys, the alliance partial when a member does not send", () => {
    const table = dayTableOf(balance(), "sent");
    const noctis = table.rows.find((r) => r.label === "Noctis");
    expect(noctis?.cells).toEqual([30_000, 0, 15_000]);
    expect(noctis?.counts).toEqual([1, 0, 2]);
    expect(table.alliance.partial).toBe(true);
    expect(table.rows.find((r) => r.label === "Grop")?.partial).toBe(true);
    expect(dayTableOf(balance(), "production").rows.find((r) => r.label === "Grop")?.partial).toBe(false);
  });

  it("keeps the Équilibre's order, by gap", () => {
    expect(dayTableOf(balance(), "received").rows.map((r) => r.label)).toEqual(balance().rows.map((r) => r.pseudo));
  });

  it("groups more than 31 days by week, the TDC of a week its average", () => {
    const long = balanceOf({
      tag: "4O4",
      members: ["Noctis"],
      senders: ["Noctis"],
      players: [{ pseudo: "Noctis", master: null, days: [{ day: day(40), field: 1_000, alliance: "4O4" }] }],
      convoys: [],
      days: 35,
      now: NOW,
    });
    const table = dayTableOf(long, "field");
    expect(table.columns).toHaveLength(5);
    expect(table.columns[0]).toMatchObject({ start: day(34), days: 7 });
    expect(table.columns[4]?.days).toBe(6.5);
    expect(table.rows[0]?.cells).toEqual([1_000, 1_000, 1_000, 1_000, 1_000]);
    expect(dayTableOf(long, "production").rows[0]?.cells[0]).toBe(7 * 48_000);
  });
});

describe("a member's days", () => {
  it("gives every measure of the member chosen, one per line", () => {
    const table = memberDaysOf(balance(), "noctis");
    expect(table?.rows.map((r) => [r.measure, r.cells])).toEqual([
      ["field", [2_000, 2_000, 2_000]],
      ["production", [96_000, 96_000, 48_000]],
      ["afterColonies", [96_000, 96_000, 48_000]],
      ["sent", [30_000, 0, 15_000]],
      ["received", [0, 0, 0]],
    ]);
    expect(memberDaysOf(balance(), "Gargantua")).toBeNull();
  });
});

describe("sortDayRows", () => {
  const rows = dayTableOf(balance(), "production").rows;

  it("sorts by a day, the total or the name, a member absent that day last", () => {
    expect(sortDayRows(rows, { by: 0, descending: true }).map((r) => r.label)).toEqual(["Noctis", "Grop", "Okapi"]);
    expect(sortDayRows(rows, { by: 0, descending: false }).map((r) => r.label)).toEqual(["Grop", "Noctis", "Okapi"]);
    expect(sortDayRows(rows, { by: "total", descending: false }).map((r) => r.label)).toEqual([
      "Grop",
      "Okapi",
      "Noctis",
    ]);
    expect(sortDayRows(rows, { by: "label", descending: false }).map((r) => r.label)).toEqual([
      "Grop",
      "Noctis",
      "Okapi",
    ]);
  });
});

describe("dayTableDiscord", () => {
  it("writes the measure, the alliance and each member present a day on average, with their total", () => {
    const text = dayTableDiscord(dayTableOf(balance(), "sent"), "sent", { tag: "4O4", days: 3, now: NOW });
    expect(text.split("\n")).toEqual([
      "**Envoyés 4O4 · 3 jours** (du 01/11 au 03/11)",
      "Alliance : 18K/j (45K, partiel)",
      "- Noctis : 18K/j (45K sur 3 jours)",
      "- Okapi : 0/j (0 sur 2 jours)",
      "- Grop : 0/j (0 sur 3 jours, partiel)",
    ]);
  });

  it("writes the TDC on average", () => {
    const text = dayTableDiscord(dayTableOf(balance(), "field"), "field", {
      tag: "4O4",
      days: 3,
      now: NOW,
      free: true,
    });
    expect(text.split("\n").slice(0, 3)).toEqual([
      "**TDC 4O4 · du 01/11 au 03/11**",
      "Alliance : 3 167 en moyenne",
      "- Noctis : 2 000 en moyenne",
    ]);
  });
});
