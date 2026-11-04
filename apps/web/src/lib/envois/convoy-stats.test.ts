import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { describe, expect, it } from "vitest";
import { convoyStats, convoyStatsDiscord, type ConvoyStatsInput } from "./convoy-stats";

// Sunday 1 November 2026, 12 h 00 in Paris (UTC+1).
const NOW = new Date("2026-11-01T11:00:00Z");
const at = (iso: string) => new Date(iso).getTime();

const delivered = (from: string, to: string, food: number, materials: number, when: string): ConvoyItem => ({
  kind: "delivered",
  from,
  to,
  food,
  materials,
  at: at(when),
});

const input = (convoys: ConvoyItem[], more: Partial<ConvoyStatsInput> = {}): ConvoyStatsInput => ({
  convoys,
  demandeConvoys: [],
  members: ["Noctis", "Lunaire", "Okapi"],
  senders: ["Noctis", "Lunaire", "Okapi"],
  days: 7,
  member: null,
  now: NOW,
  ...more,
});

describe("convoy statistics of a space", () => {
  it("adds up the convoys delivered in the last days of Paris, today included", () => {
    const stats = convoyStats(
      input([
        delivered("Noctis", "Lunaire", 100_000, 200_000, "2026-11-01T08:00:00Z"),
        delivered("Okapi", "Lunaire", 0, 50_000, "2026-10-26T00:30:00Z"), // 26/10 at 1 h 30 in Paris: day 1 of 7
        delivered("Okapi", "Noctis", 0, 999_000, "2026-10-25T22:30:00Z"), // 25/10 at 23 h 30 in Paris: before
      ]),
    );
    expect(stats.delivered).toEqual({ food: 100_000, materials: 250_000, count: 2 });
    expect(stats.since).toBe(at("2026-10-25T23:00:00Z"));
  });

  it("gives each member what they delivered and received, their Solde received less delivered", () => {
    const stats = convoyStats(
      input(
        [
          delivered("Noctis", "Lunaire", 100_000, 200_000, "2026-10-31T08:00:00Z"),
          delivered("noctis", "Okapi", 0, 50_000, "2026-11-01T09:00:00Z"),
          delivered("Lunaire", "Noctis", 10_000, 0, "2026-10-30T08:00:00Z"),
        ],
        { senders: ["Noctis", "Lunaire"] },
      ),
    );
    expect(stats.rows).toEqual([
      {
        player: "Noctis",
        member: true,
        partial: false,
        delivered: 350_000,
        received: 10_000,
        solde: -340_000,
        count: 3,
        last: at("2026-11-01T09:00:00Z"),
      },
      {
        player: "Lunaire",
        member: true,
        partial: false,
        delivered: 10_000,
        received: 300_000,
        solde: 290_000,
        count: 2,
        last: at("2026-10-31T08:00:00Z"),
      },
      {
        player: "Okapi",
        member: true,
        partial: true,
        delivered: 0,
        received: 50_000,
        solde: 50_000,
        count: 1,
        last: at("2026-11-01T09:00:00Z"),
      },
    ]);
  });

  it("ranks the flows between two members, one way per line, and tells the share between members", () => {
    const stats = convoyStats(
      input([
        delivered("Noctis", "Lunaire", 0, 100_000, "2026-10-31T08:00:00Z"),
        delivered("Noctis", "lunaire", 50_000, 0, "2026-10-31T09:00:00Z"),
        delivered("Lunaire", "Noctis", 0, 200_000, "2026-10-31T10:00:00Z"),
        delivered("Okapi", "Gargantua", 0, 150_000, "2026-10-31T11:00:00Z"),
      ]),
    );
    expect(stats.flows).toEqual([
      { from: "Lunaire", to: "Noctis", amount: 200_000, count: 1 },
      { from: "Noctis", to: "Lunaire", amount: 150_000, count: 2 },
    ]);
    expect(stats.betweenMembers).toBe(350_000 / 500_000);
  });

  it("keeps the 8 biggest flows", () => {
    const names = ["A", "B", "C", "D", "E"];
    const convoys = names.flatMap((from, i) =>
      names
        .filter((to) => to !== from)
        .map((to, j) => delivered(from, to, 0, 1000 * (i * 5 + j + 1), "2026-10-31T08:00:00Z")),
    );
    const stats = convoyStats(input(convoys, { members: names, senders: names }));
    expect(stats.flows).toHaveLength(8);
    expect(stats.flows[0]).toMatchObject({ from: "E", to: "D", amount: 24_000 });
  });

  it("gathers the convoys with other players both ways, the 3 biggest by name", () => {
    const stats = convoyStats(
      input([
        delivered("Noctis", "Gargantua", 0, 400_000, "2026-10-31T08:00:00Z"),
        delivered("Okapi", "gargantua", 0, 100_000, "2026-10-31T08:00:00Z"),
        delivered("Noctis", "Viking", 0, 300_000, "2026-10-31T08:00:00Z"),
        delivered("Noctis", "Ragnar", 0, 200_000, "2026-10-31T08:00:00Z"),
        delivered("Noctis", "Bjorn", 0, 100_000, "2026-10-31T08:00:00Z"),
        delivered("Kraken", "Lunaire", 70_000, 0, "2026-10-31T08:00:00Z"),
        delivered("Noctis", "Lunaire", 0, 999, "2026-10-31T08:00:00Z"),
      ]),
    );
    expect(stats.outside).toEqual({
      sent: {
        total: 1_100_000,
        top: [
          { player: "Gargantua", amount: 500_000 },
          { player: "Viking", amount: 300_000 },
          { player: "Ragnar", amount: 200_000 },
        ],
        others: 1,
      },
      received: { total: 70_000, top: [{ player: "Kraken", amount: 70_000 }], others: 0 },
    });
  });

  it("tells the convoys on their way, the soonest first; one whose arrival passed is left out", () => {
    const transit = (to: string, materials: number, when: string): ConvoyItem => ({
      kind: "transit",
      from: "Noctis",
      to,
      food: 0,
      materials,
      at: at(when),
    });
    const stats = convoyStats(
      input([
        transit("Lunaire", 400_000, "2026-11-01T14:00:00Z"),
        transit("Okapi", 100_000, "2026-11-01T12:00:00Z"),
        transit("Lunaire", 200_000, "2026-11-01T13:00:00Z"),
        transit("Okapi", 50_000, "2026-11-02T13:00:00Z"),
        transit("Okapi", 999_000, "2026-11-01T10:00:00Z"),
      ]),
    );
    expect(stats.onWay).toMatchObject({ count: 4, food: 0, materials: 750_000 });
    expect(stats.onWay.next.map((c) => c.materials)).toEqual([100_000, 200_000, 400_000]);
    expect(stats.delivered.count).toBe(0);
  });

  it("names the members who do not send their Convois", () => {
    const stats = convoyStats(input([], { senders: ["lunaire"] }));
    expect(stats.coverage).toEqual({ members: 3, senders: 1, missing: ["Noctis", "Okapi"] });
  });

  it("tells the oldest delivery known when the period starts before it", () => {
    const convoys = [
      delivered("Noctis", "Lunaire", 0, 1_000, "2026-10-28T08:00:00Z"),
      delivered("Noctis", "Lunaire", 0, 1_000, "2026-10-12T08:00:00Z"),
    ];
    expect(convoyStats(input(convoys, { days: 7 })).knownSince).toBeNull();
    expect(convoyStats(input(convoys, { days: 30 })).knownSince).toBe(at("2026-10-12T08:00:00Z"));
    expect(convoyStats(input(convoys, { days: 90 })).knownSince).toBe(at("2026-10-12T08:00:00Z"));
    expect(convoyStats(input([], { days: 7 })).knownSince).toBeNull();
  });

  it("adds up, roughly, the convoys attached to a Demande arrived in the period", () => {
    const attached = (demande: string, materials: number, when: string) => ({
      demande,
      from: "Noctis",
      to: "Lunaire",
      food: 0,
      materials,
      at: at(when),
    });
    const A = "0b9f3e4c-6a1d-4c47-9b7a-1f2e3d4c5b6a";
    const B = "1c8e2d3b-5a4f-4e36-8a6b-2e3f4a5b6c7d";
    const stats = convoyStats(
      input([], {
        demandeConvoys: [
          attached(A, 100_000, "2026-10-30T08:00:00Z"),
          attached(A, 50_000, "2026-10-31T08:00:00Z"),
          attached(B, 70_000, "2026-11-01T09:00:00Z"),
          attached(B, 999_000, "2026-11-01T15:00:00Z"), // on its way
          attached(B, 888_000, "2026-10-20T08:00:00Z"), // before
        ],
      }),
    );
    expect(stats.forDemandes).toEqual({ amount: 220_000, demandes: 2 });
  });

  it("splits the delivered by day of Paris, every day of the period shown", () => {
    const stats = convoyStats(
      input([
        delivered("Noctis", "Lunaire", 10_000, 20_000, "2026-10-26T00:30:00Z"),
        delivered("Okapi", "Lunaire", 5_000, 0, "2026-10-26T20:00:00Z"),
        delivered("Okapi", "Noctis", 0, 7_000, "2026-11-01T10:00:00Z"),
      ]),
    );
    expect(stats.buckets).toHaveLength(7);
    expect(stats.buckets[0]).toEqual({
      start: at("2026-10-25T23:00:00Z"),
      label: "26/10",
      food: 15_000,
      materials: 20_000,
      sent: 0,
      received: 0,
    });
    expect(stats.buckets[1]).toMatchObject({ label: "27/10", food: 0, materials: 0 });
    expect(stats.buckets[6]).toMatchObject({ label: "01/11", food: 0, materials: 7_000 });
  });

  it("splits 90 days by week", () => {
    const stats = convoyStats(input([delivered("Noctis", "Lunaire", 0, 1_000, "2026-08-04T08:00:00Z")], { days: 90 }));
    expect(stats.buckets).toHaveLength(13);
    expect(stats.buckets[0]).toMatchObject({ label: "04/08", materials: 1_000 });
    expect(stats.buckets[12]?.label).toBe("27/10");
  });

  it("counts a free period up to its end, the convoys on their way still those of now", () => {
    const stats = convoyStats(
      input(
        [
          delivered("Noctis", "Lunaire", 0, 1_000, "2026-10-20T08:00:00Z"),
          delivered("Noctis", "Lunaire", 0, 2_000, "2026-10-21T08:00:00Z"), // 21/10: after the end
          delivered("Noctis", "Lunaire", 0, 4_000, "2026-10-19T21:30:00Z"), // 19/10 at 23 h 30 in Paris: before
          { kind: "transit", from: "Okapi", to: "Noctis", food: 0, materials: 40_000, at: at("2026-11-01T13:00:00Z") },
        ],
        { days: 1, end: new Date(at("2026-10-20T22:00:00Z") - 1) },
      ),
    );
    expect(stats.since).toBe(at("2026-10-19T22:00:00Z"));
    expect(stats.delivered).toEqual({ food: 0, materials: 1_000, count: 1 });
    expect(stats.buckets.map((b) => b.label)).toEqual(["20/10"]);
    expect(stats.onWay.count).toBe(1);
  });

  it("splits a free period of more than 31 days by week", () => {
    const stats = convoyStats(input([], { days: 32 }));
    expect(stats.buckets).toHaveLength(5);
    expect(convoyStats(input([], { days: 31 })).buckets).toHaveLength(31);
  });

  describe("with a member chosen", () => {
    const convoys = [
      delivered("Noctis", "Lunaire", 0, 300_000, "2026-10-31T08:00:00Z"),
      delivered("Lunaire", "noctis", 50_000, 0, "2026-10-31T09:00:00Z"),
      delivered("Noctis", "Gargantua", 0, 100_000, "2026-10-30T08:00:00Z"),
      delivered("Okapi", "Lunaire", 0, 999_000, "2026-10-30T08:00:00Z"),
      { kind: "transit", from: "Okapi", to: "Noctis", food: 0, materials: 40_000, at: at("2026-11-01T13:00:00Z") },
      { kind: "transit", from: "Okapi", to: "Lunaire", food: 0, materials: 1, at: at("2026-11-01T13:00:00Z") },
    ] satisfies ConvoyItem[];
    const stats = convoyStats(input(convoys, { member: "NOCTIS" }));

    it("counts their convoys only, both ways", () => {
      expect(stats.self).toMatchObject({ player: "Noctis", delivered: 400_000, received: 50_000, solde: -350_000 });
      expect(stats.delivered).toEqual({ food: 50_000, materials: 400_000, count: 3 });
      expect(stats.onWay).toMatchObject({ count: 1, materials: 40_000 });
      expect(stats.flows.map((f) => `${f.from}>${f.to}`)).toEqual(["Noctis>Lunaire", "Lunaire>Noctis"]);
      expect(stats.outside.sent.total).toBe(100_000);
    });

    it("lists whom they exchanged with, members or not, from their side", () => {
      expect(stats.rows).toEqual([
        expect.objectContaining({ player: "Lunaire", member: true, delivered: 300_000, received: 50_000, count: 2 }),
        expect.objectContaining({ player: "Gargantua", member: false, delivered: 100_000, received: 0, count: 1 }),
      ]);
    });

    it("splits what they delivered and received by day", () => {
      expect(stats.buckets[5]).toMatchObject({ label: "31/10", sent: 300_000, received: 50_000 });
      expect(stats.buckets[4]).toMatchObject({ label: "30/10", sent: 100_000, received: 0 });
    });
  });

  it("lists a member without a convoy in the period last, with nothing", () => {
    const stats = convoyStats(input([delivered("Noctis", "Lunaire", 0, 1_000, "2026-10-31T08:00:00Z")]));
    expect(stats.rows.at(-1)).toMatchObject({ player: "Okapi", count: 0, last: null, delivered: 0, received: 0 });
  });

  describe("copied for Discord", () => {
    const convoys = [
      delivered("Noctis", "Lunaire", 100_000, 2_400_000, "2026-10-31T08:00:00Z"),
      delivered("Lunaire", "Noctis", 15_000, 0, "2026-10-30T08:00:00Z"),
      delivered("Noctis", "Gargantua", 0, 50_000, "2026-10-30T08:00:00Z"),
    ];

    it("gives the period, the total, each member with a convoy, and who does not send", () => {
      const stats = convoyStats(input(convoys, { senders: ["Noctis", "Lunaire"] }));
      expect(convoyStatsDiscord(stats, { tag: "4O4", days: 7, now: NOW })).toBe(
        [
          "**Convois 4O4 · 7 jours** (du 26/10 au 01/11)",
          "Livré : 2,56M (115K nourriture · 2,45M matériaux) · 3 convois",
          "- Noctis : livré 2,55M · reçu 15K · solde -2,54M",
          "- Lunaire : livré 15K · reçu 2,5M · solde 2,48M",
          "(Okapi n'envoie pas ses convois : seuls ceux échangés avec les autres membres comptent)",
        ].join("\n"),
      );
    });

    it("gives a free period by its days", () => {
      const stats = convoyStats(input(convoys, { days: 3, end: new Date(at("2026-10-31T23:00:00Z") - 1) }));
      expect(
        convoyStatsDiscord(stats, {
          tag: "4O4",
          days: 3,
          now: new Date(at("2026-10-31T23:00:00Z") - 1),
          free: true,
        }).split("\n")[0],
      ).toBe("**Convois 4O4 · du 29/10 au 31/10**");
    });

    it("gives a member's convoys with each player", () => {
      const stats = convoyStats(input(convoys, { member: "Noctis" }));
      expect(convoyStatsDiscord(stats, { tag: "4O4", days: 7, now: NOW })).toBe(
        [
          "**Convois de Noctis (4O4) · 7 jours** (du 26/10 au 01/11)",
          "Livré 2,55M · reçu 15K · solde -2,54M · 3 convois",
          "- avec Lunaire : livré 2,5M · reçu 15K",
          "- avec Gargantua : livré 50K · reçu 0",
        ].join("\n"),
      );
    });
  });
});
