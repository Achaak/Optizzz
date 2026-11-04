import type { FloodItem } from "@optizzz/game/site-links/envoi-floods";
import { describe, expect, it } from "vitest";
import { floodStats, floodStatsDiscord, type FloodStatsInput } from "./flood-stats";

// Sunday 1 November 2026, 12 h 00 in Paris (UTC+1).
const NOW = new Date("2026-11-01T11:00:00Z");
const at = (iso: string) => new Date(iso).getTime();

type Flood = FloodItem & { army: Record<string, number> | null };

const flood = (from: string, target: string, take: number | null, when: string, army: Flood["army"] = null): Flood => ({
  from,
  target,
  take,
  at: at(when),
  army,
});

const input = (floods: Flood[], more: Partial<FloodStatsInput> = {}): FloodStatsInput => ({
  floods,
  members: ["Noctis", "Lunaire", "Okapi"],
  senders: ["Noctis", "Lunaire", "Okapi"],
  period: "7j",
  member: null,
  now: NOW,
  ...more,
});

describe("flood statistics of a space", () => {
  it("counts the floods arrived in the last 7 days of Paris and the take the Plan expected, at least", () => {
    const stats = floodStats(
      input([
        flood("Noctis", "Gargantua", 100_000, "2026-11-01T08:00:00Z"),
        flood("Lunaire", "Viking", null, "2026-10-26T00:30:00Z"),
        flood("Okapi", "Viking", 50_000, "2026-10-28T08:00:00Z"),
        flood("Okapi", "Viking", 999_000, "2026-10-25T22:30:00Z"), // before
        flood("Okapi", "Viking", 888_000, "2026-11-01T13:00:00Z"), // on its way
      ]),
    );
    expect(stats.arrived).toEqual({ count: 3, take: 150_000, withoutPlan: 1 });
    expect(stats.since).toBe(at("2026-10-25T23:00:00Z"));
  });

  it("counts the last 24 hours over 24 hours", () => {
    const stats = floodStats(
      input(
        [
          flood("Noctis", "Gargantua", 1_000, "2026-10-31T11:30:00Z"),
          flood("Noctis", "Gargantua", 1_000, "2026-10-31T10:30:00Z"), // 24 h 30 ago
        ],
        { period: "24h" },
      ),
    );
    expect(stats.arrived.count).toBe(1);
  });

  it("gives each member their floods, take, targets and floods on their way; those who do not send last", () => {
    const stats = floodStats(
      input(
        [
          flood("Noctis", "Gargantua", 100_000, "2026-10-31T08:00:00Z"),
          flood("noctis", "gargantua", null, "2026-11-01T09:00:00Z"),
          flood("Noctis", "Viking", 30_000, "2026-10-30T08:00:00Z"),
          flood("Noctis", "Viking", 5_000, "2026-11-01T15:00:00Z"), // on its way
          flood("Lunaire", "Viking", 200_000, "2026-10-30T08:00:00Z"),
        ],
        { senders: ["Noctis", "Lunaire"] },
      ),
    );
    expect(stats.rows).toEqual([
      {
        player: "Lunaire",
        sends: true,
        count: 1,
        take: 200_000,
        withoutPlan: 0,
        targets: 1,
        onWay: 0,
        last: at("2026-10-30T08:00:00Z"),
      },
      {
        player: "Noctis",
        sends: true,
        count: 3,
        take: 130_000,
        withoutPlan: 1,
        targets: 2,
        onWay: 1,
        last: at("2026-11-01T09:00:00Z"),
      },
      { player: "Okapi", sends: false, count: 0, take: 0, withoutPlan: 0, targets: 0, onWay: 0, last: null },
    ]);
  });

  it("ranks the targets by take, with the members who hit each and how many targets several members hit", () => {
    const stats = floodStats(
      input([
        flood("Noctis", "Gargantua", 100_000, "2026-10-31T08:00:00Z"),
        flood("Lunaire", "gargantua", 50_000, "2026-10-31T09:00:00Z"),
        flood("Noctis", "Gargantua", null, "2026-10-31T10:00:00Z"),
        flood("Okapi", "Viking", 200_000, "2026-10-30T08:00:00Z"),
      ]),
    );
    expect(stats.targets).toEqual([
      { target: "Viking", count: 1, take: 200_000, withoutPlan: 0, by: ["Okapi"], last: at("2026-10-30T08:00:00Z") },
      {
        target: "Gargantua",
        count: 3,
        take: 150_000,
        withoutPlan: 1,
        by: ["Noctis", "Lunaire"],
        last: at("2026-10-31T10:00:00Z"),
      },
    ]);
    expect(stats.targetCount).toEqual({ all: 2, shared: 1 });
  });

  it("keeps the 8 biggest targets", () => {
    const floods = Array.from({ length: 10 }, (_, i) =>
      flood("Noctis", `T${String(i)}`, 1000 * (i + 1), "2026-10-31T08:00:00Z"),
    );
    const stats = floodStats(input(floods));
    expect(stats.targets.map((t) => t.target)).toEqual(["T9", "T8", "T7", "T6", "T5", "T4", "T3", "T2"]);
    expect(stats.targetCount.all).toBe(10);
  });

  it("tells the floods on their way, the soonest first", () => {
    const stats = floodStats(
      input([
        flood("Noctis", "Gargantua", 1, "2026-11-01T14:00:00Z"),
        flood("Okapi", "Viking", null, "2026-11-01T12:00:00Z"),
        flood("Lunaire", "Viking", 3, "2026-11-01T13:00:00Z"),
        flood("Lunaire", "Viking", 4, "2026-11-02T13:00:00Z"),
        flood("Lunaire", "Viking", 5, "2026-11-01T10:00:00Z"), // arrived
      ]),
    );
    expect(stats.onWay.count).toBe(4);
    expect(stats.onWay.next.map((f) => f.from)).toEqual(["Okapi", "Lunaire", "Noctis"]);
  });

  it("names the members who do not send their Floods", () => {
    expect(floodStats(input([], { senders: ["okapi"] })).coverage).toEqual({
      members: 3,
      senders: 1,
      missing: ["Noctis", "Lunaire"],
    });
  });

  it("adds up the army sent with the floods arrived, unit by unit, with how many floods it comes from", () => {
    const stats = floodStats(
      input([
        flood("Noctis", "Gargantua", 1, "2026-10-31T08:00:00Z", { JSN: 1000, SN: 50 }),
        flood("Okapi", "Viking", 1, "2026-10-31T09:00:00Z", { JSN: 500 }),
        flood("Okapi", "Viking", null, "2026-10-31T10:00:00Z"),
        flood("Okapi", "Viking", 1, "2026-11-01T15:00:00Z", { JSN: 99_999 }), // on its way
      ]),
    );
    expect(stats.army).toEqual({ units: { JSN: 1500, SN: 50 }, floods: 2 });
  });

  it("has no army without one (a member's page)", () => {
    expect(floodStats(input([flood("Noctis", "Gargantua", 1, "2026-10-31T08:00:00Z")])).army).toBeNull();
  });

  it("splits the floods arrived by day of Paris over 7 days", () => {
    const stats = floodStats(
      input([
        flood("Noctis", "Gargantua", 100_000, "2026-10-26T00:30:00Z"),
        flood("Okapi", "Viking", null, "2026-10-26T20:00:00Z"),
        flood("Okapi", "Viking", 7_000, "2026-11-01T10:00:00Z"),
      ]),
    );
    expect(stats.buckets).toHaveLength(7);
    expect(stats.buckets[0]).toEqual({ start: at("2026-10-25T23:00:00Z"), label: "26/10", count: 2, take: 100_000 });
    expect(stats.buckets[6]).toMatchObject({ label: "01/11", count: 1, take: 7_000 });
  });

  it("splits the last 24 hours by hour of Paris", () => {
    const stats = floodStats(
      input(
        [
          flood("Noctis", "Gargantua", 1_000, "2026-10-31T11:30:00Z"), // 12 h 30 in Paris, yesterday
          flood("Noctis", "Gargantua", 2_000, "2026-11-01T10:59:00Z"), // 11 h 59 today
        ],
        { period: "24h" },
      ),
    );
    expect(stats.buckets).toHaveLength(24);
    expect(stats.buckets[0]).toMatchObject({ label: "12 h", count: 1, take: 1_000 });
    expect(stats.buckets[23]).toMatchObject({ label: "11 h", count: 1, take: 2_000 });
  });

  it("counts a free period by day of Paris up to its end, the floods on their way still those of now", () => {
    const end = new Date(at("2026-10-30T23:00:00Z") - 1); // 30/10 at midnight in Paris, less a millisecond
    const stats = floodStats(
      input(
        [
          flood("Noctis", "Gargantua", 100_000, "2026-10-29T08:00:00Z"),
          flood("Noctis", "Gargantua", 7, "2026-10-31T08:00:00Z"), // after its end
          flood("Noctis", "Gargantua", 9, "2026-11-01T13:00:00Z"), // on its way
        ],
        { span: { days: 2, end } },
      ),
    );
    expect(stats.since).toBe(at("2026-10-28T23:00:00Z"));
    expect(stats.arrived.count).toBe(1);
    expect(stats.buckets.map((b) => b.label)).toEqual(["29/10", "30/10"]);
    expect(stats.onWay.count).toBe(1);
    expect(
      floodStatsDiscord(stats, { tag: "4O4", period: "7j", now: end, free: true, alliances: null }).split("\n")[0],
    ).toBe("**Floods 4O4 · du 29/10 au 30/10**");
  });

  it("with a member chosen, keeps their floods only", () => {
    const stats = floodStats(
      input(
        [
          flood("Noctis", "Gargantua", 100_000, "2026-10-31T08:00:00Z", { JSN: 10 }),
          flood("Lunaire", "Gargantua", 50_000, "2026-10-31T09:00:00Z", { JSN: 99 }),
          flood("noctis", "Viking", null, "2026-10-31T10:00:00Z"),
          flood("Noctis", "Viking", 1, "2026-11-01T15:00:00Z"),
          flood("Lunaire", "Viking", 1, "2026-11-01T16:00:00Z"),
        ],
        { member: "NOCTIS" },
      ),
    );
    expect(stats.self).toMatchObject({ player: "Noctis", count: 2, take: 100_000, targets: 2, onWay: 1 });
    expect(stats.arrived).toEqual({ count: 2, take: 100_000, withoutPlan: 1 });
    expect(stats.targets.map((t) => [t.target, t.by])).toEqual([
      ["Gargantua", ["Noctis"]],
      ["Viking", ["Noctis"]],
    ]);
    expect(stats.onWay.count).toBe(1);
    expect(stats.army).toEqual({ units: { JSN: 10 }, floods: 1 });
    expect(stats.buckets[5]?.count).toBe(2);
  });

  it("has no member of its own for the whole alliance", () => {
    expect(floodStats(input([])).self).toBeNull();
  });

  describe("copied for Discord", () => {
    const floods = [
      flood("Noctis", "Gargantua", 1_200_000, "2026-10-31T08:00:00Z", { JSN: 5000 }),
      flood("Noctis", "Viking", null, "2026-10-30T08:00:00Z"),
      flood("Lunaire", "Gargantua", 300_000, "2026-10-29T08:00:00Z"),
    ];
    const alliances = new Map([["gargantua", "C6P"]]);

    it("gives the period, the floods and take, each member, the 3 biggest targets and who does not send; never the army", () => {
      const stats = floodStats(input(floods, { senders: ["Noctis", "Lunaire"] }));
      expect(floodStatsDiscord(stats, { tag: "4O4", period: "7j", now: NOW, alliances })).toBe(
        [
          "**Floods 4O4 · 7 jours** (du 26/10 au 01/11)",
          "3 floods arrivés · prise attendue ≥ 1,5M (1 sans le Plan)",
          "- Noctis : 2 floods · prise ≥ 1,2M · 2 cibles",
          "- Lunaire : 1 flood · prise 300K · 1 cible",
          "Cibles : Gargantua [C6P] (2 floods, 1,5M), Viking (1 flood, ≥ 0)",
          "(Okapi n'envoie pas ses floods)",
        ].join("\n"),
      );
    });

    it("gives a member's floods over 24 hours", () => {
      const stats = floodStats(input(floods, { member: "Lunaire", period: "24h" }));
      expect(floodStatsDiscord(stats, { tag: "4O4", period: "24h", now: NOW, alliances })).toBe(
        ["**Floods de Lunaire (4O4) · 24 heures** (depuis le 31/10 à 12 h 00)", "Aucun flood arrivé."].join("\n"),
      );
    });
  });
});
