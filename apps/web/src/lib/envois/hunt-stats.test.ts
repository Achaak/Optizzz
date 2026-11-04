import { describe, expect, it } from "vitest";
import { huntStats, huntStatsDiscord, type HuntStatsInput } from "./hunt-stats";
import type { AllianceHunt } from "./hunts";

// Wednesday 4 November 2026, 14 h in Paris.
const NOW = new Date("2026-11-04T13:00:00Z");
const HOUR = 3600_000;
const DAY = 24 * HOUR;

let n = 0;
const hunt = (hunter: string, returnsIn: number, fieldGain: number, ants: number | null = null): AllianceHunt => ({
  hunter,
  returnsAt: NOW.getTime() + returnsIn,
  fieldGain,
  ants,
  fingerprint: `fp-${String(n++)}`,
  observedAt: 0,
});

const input = (hunts: AllianceHunt[], over: Partial<HuntStatsInput> = {}): HuntStatsInput => ({
  hunts,
  members: ["Noctis", "XaTaK", "Grop"],
  senders: ["Noctis", "XaTaK"],
  period: "7j",
  member: null,
  now: NOW,
  ...over,
});

describe("the statistics of the « Chasses » tab", () => {
  const hunts = [
    hunt("Noctis", -2 * HOUR, 12_000, 20_000),
    hunt("Noctis", -3 * DAY, 8_000, 20_000),
    hunt("XaTaK", -HOUR, 4_000),
    // Out of 7 days, in 30.
    hunt("XaTaK", -10 * DAY, 6_000),
    // Out now.
    hunt("Noctis", 2 * HOUR, 9_000),
    hunt("XaTaK", HOUR, 3_000),
  ];

  it("counts the hunts back in the period, at their return, and those still out apart", () => {
    const stats = huntStats(input(hunts));
    expect(stats.returned).toEqual({ count: 3, field: 24_000, average: 8_000, perDay: 3 / 7 });
    expect(stats.out.count).toBe(2);
    expect(stats.out.field).toBe(12_000);
    expect(stats.out.next.map((h) => h.hunter)).toEqual(["XaTaK", "Noctis"]);
    // cm² for 1 000 ants, over the hunts whose ants are known (Compte+).
    expect(stats.perThousandAnts).toEqual({ value: 500, hunts: 2 });
  });

  it("goes back 24 hours, 7 days or 30 days, by hour or by day of Paris", () => {
    expect(huntStats(input(hunts, { period: "24h" })).returned.count).toBe(2);
    expect(huntStats(input(hunts, { period: "24h" })).buckets).toHaveLength(24);
    const month = huntStats(input(hunts, { period: "30j" }));
    expect(month.returned.count).toBe(4);
    expect(month.buckets).toHaveLength(30);
    const week = huntStats(input(hunts));
    expect(week.buckets.map((b) => b.label)).toEqual(["29/10", "30/10", "31/10", "01/11", "02/11", "03/11", "04/11"]);
    expect(week.buckets.at(-1)).toMatchObject({ count: 2, field: 16_000 });
  });

  it("lists the members, the biggest field first, those who do not send last", () => {
    const { rows, coverage } = huntStats(input(hunts));
    expect(rows.map((r) => [r.player, r.sends, r.count, r.field, r.average, r.out, r.outField])).toEqual([
      ["Noctis", true, 2, 20_000, 10_000, 1, 9_000],
      ["XaTaK", true, 1, 4_000, 4_000, 1, 3_000],
      ["Grop", false, 0, 0, null, 0, 0],
    ]);
    expect(rows[0]?.last).toBe(NOW.getTime() - 2 * HOUR);
    expect(coverage).toEqual({ members: 3, senders: 2, missing: ["Grop"] });
  });

  it("says when the period starts before the oldest hunt known", () => {
    expect(huntStats(input(hunts)).knownSince).toBeNull();
    expect(huntStats(input(hunts.slice(0, 1))).knownSince).toBe(NOW.getTime() - 2 * HOUR);
    expect(huntStats(input([])).knownSince).toBeNull();
  });

  it("turns to a member: their figures, and their own hunts, latest first", () => {
    const stats = huntStats(input(hunts, { member: "noctis" }));
    expect(stats.returned.count).toBe(2);
    expect(stats.out.count).toBe(1);
    expect(stats.self?.player).toBe("Noctis");
    expect(stats.own.map((h) => h.returnsAt - NOW.getTime())).toEqual([2 * HOUR, -2 * HOUR, -3 * DAY]);
  });

  it("writes a message to paste in Discord", () => {
    const text = huntStatsDiscord(huntStats(input(hunts)), { tag: "4O4", period: "7j", now: NOW });
    expect(text.split("\n")).toEqual([
      "**Chasses 4O4 · 7 jours** (du 29/10 au 04/11)",
      "3 chasses rentrées · 24K cm² · 8 000 cm² par chasse",
      "- Noctis : 2 chasses · 20K cm²",
      "- XaTaK : 1 chasse · 4 000 cm²",
      "(Grop n'envoie pas ses chasses)",
    ]);
    expect(huntStatsDiscord(huntStats(input([])), { tag: "4O4", period: "24h", now: NOW }).split("\n")[1]).toBe(
      "Aucune chasse rentrée.",
    );
  });
});
