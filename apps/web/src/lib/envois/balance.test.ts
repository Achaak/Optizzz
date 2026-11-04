import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { describe, expect, it } from "vitest";
import {
  balanceDiscord,
  balanceLine,
  balanceOf,
  balancePlayers,
  inOutOf,
  taxRatesOf,
  verdictText,
  warehouseInputOf,
  type BalanceInput,
} from "./balance";
import { parisMidnight } from "./convoy-stats";

// Noon in Paris: today counts half a day.
const NOW = new Date("2026-11-03T11:00:00Z");
const DAY = 24 * 3600_000;
const TODAY = parisMidnight(NOW, 0);
const YESTERDAY = parisMidnight(NOW, 1);

/** A player in the alliance « 4O4 » both days, with this TDC. */
const player = (pseudo: string, field: number, extra: Partial<BalanceInput["players"][number]> = {}) => ({
  pseudo,
  master: null,
  days: [
    { day: YESTERDAY, field, alliance: "4O4" },
    { day: TODAY, field, alliance: "4O4" },
  ],
  ...extra,
});

const delivered = (from: string, to: string, food: number, at = TODAY + 3600_000): ConvoyItem => ({
  kind: "delivered",
  from,
  to,
  food,
  materials: 0,
  at,
});

const input = (extra: Partial<BalanceInput> = {}): BalanceInput => ({
  tag: "4O4",
  members: ["Noctis", "Okapi"],
  senders: ["Noctis", "Okapi"],
  players: [player("Noctis", 1_000), player("Okapi", 1_000)],
  convoys: [],
  days: 2,
  now: NOW,
  ...extra,
});

const row = (balance: ReturnType<typeof balanceOf>, pseudo: string) => {
  const found = balance.rows.find((r) => r.pseudo === pseudo);
  if (!found) throw new Error(`no row for ${pseudo}`);
  return found;
};

describe("balanceOf", () => {
  it("gives each member present the alliance's production split evenly, today counting so far", () => {
    const balance = balanceOf(input({ players: [player("Noctis", 3_000), player("Okapi", 1_000)] }));
    // 1.5 days of TDC × 48.
    expect(row(balance, "Noctis").production).toBe(3_000 * 48 * 1.5);
    expect(row(balance, "Noctis").part).toBe(2_000 * 48 * 1.5);
    expect(row(balance, "Okapi").part).toBe(2_000 * 48 * 1.5);
    expect(balance.production).toBe(4_000 * 48 * 1.5);
    expect(row(balance, "Noctis").verdict).toBe("convoy");
    expect(row(balance, "Okapi").verdict).toBe("receive");
    expect(row(balance, "Noctis").ratio).toBeCloseTo(1.5);
  });

  it("counts a member arrived during the period from the day the export puts them in the alliance", () => {
    const okapi = player("Okapi", 1_000, {
      days: [
        { day: YESTERDAY, field: 1_000, alliance: "AUTRE" },
        { day: TODAY, field: 1_000, alliance: "4O4" },
      ],
    });
    const balance = balanceOf(input({ players: [player("Noctis", 3_000), okapi] }));
    expect(row(balance, "Okapi").production).toBe(1_000 * 48 * 0.5);
    expect(row(balance, "Okapi").part).toBe(2_000 * 48 * 0.5);
    // Alone yesterday, then half of the two.
    expect(row(balance, "Noctis").part).toBe(3_000 * 48 + 2_000 * 48 * 0.5);
    expect(row(balance, "Okapi").daily.map((d) => d.present)).toEqual([false, true]);
  });

  it("keeps the TDC of the last day known when a day is missing from the export", () => {
    const okapi = player("Okapi", 1_000, { days: [{ day: YESTERDAY, field: 1_000, alliance: "4O4" }] });
    expect(row(balanceOf(input({ players: [player("Noctis", 1_000), okapi] })), "Okapi").production).toBe(
      1_000 * 48 * 1.5,
    );
  });

  it("moves a colony's tax between two members without changing the alliance's total", () => {
    const balance = balanceOf(
      input({
        players: [player("Noctis", 1_000), player("Okapi", 1_000, { master: "Noctis" })],
        taxRates: { okapi: 0.25 },
      }),
    );
    const tax = 1_000 * 48 * 1.5 * 0.25;
    expect(row(balance, "Okapi").taxes).toEqual({ paid: tax, received: 0, estimated: false });
    expect(row(balance, "Noctis").taxes).toEqual({ paid: 0, received: tax, estimated: false });
    expect(row(balance, "Noctis").net).toBe(1_000 * 48 * 1.5 + tax);
    expect(row(balance, "Okapi").gap).toBe(-tax);
    expect(balance.production).toBe(2_000 * 48 * 1.5);
  });

  it("supposes 20 % for a tax whose rate is unknown, and counts a colony outside the space", () => {
    const balance = balanceOf(
      input({
        players: [
          player("Noctis", 1_000, { master: "Gargantua" }),
          player("Okapi", 1_000),
          player("Lasius", 500, { master: "Okapi", days: [{ day: YESTERDAY, field: 500, alliance: null }] }),
        ],
      }),
    );
    expect(row(balance, "Noctis").taxes).toEqual({ paid: 1_000 * 48 * 1.5 * 0.2, received: 0, estimated: true });
    expect(row(balance, "Okapi").taxes).toEqual({ paid: 0, received: 500 * 48 * 1.5 * 0.2, estimated: true });
    expect(balance.rows.map((r) => r.pseudo)).not.toContain("Lasius");
  });

  it("counts the convoys delivered in the period, with players outside the alliance too", () => {
    const balance = balanceOf(
      input({
        convoys: [
          delivered("Noctis", "Okapi", 10_000),
          delivered("Okapi", "Gargantua", 4_000),
          delivered("Noctis", "Okapi", 99_000, YESTERDAY - DAY),
          { ...delivered("Noctis", "Okapi", 77_000), kind: "transit", at: NOW.getTime() + 3600_000 },
        ],
      }),
    );
    expect(row(balance, "Noctis")).toMatchObject({ sent: 10_000, received: 0 });
    expect(row(balance, "Okapi")).toMatchObject({ sent: 4_000, received: 10_000 });
    expect(row(balance, "Okapi").gap).toBe(6_000);
    expect(row(balance, "Okapi").daily[1]).toMatchObject({ sent: 4_000, received: 10_000 });
  });

  it("says « balanced » within 5 % of the part", () => {
    const part = 1_000 * 48 * 1.5;
    const balance = balanceOf(input({ convoys: [delivered("Noctis", "Okapi", Math.floor(part * 0.05))] }));
    expect(balance.rows.map((r) => r.verdict)).toEqual(["balanced", "balanced"]);
    expect(balance.counts).toEqual({ convoy: 0, balanced: 2, receive: 0, unknown: 0 });
  });

  it("gives no verdict to a member who does not send their Convois, who still has a part", () => {
    const balance = balanceOf(
      input({ senders: ["Noctis"], players: [player("Noctis", 1_000), player("Okapi", 3_000)] }),
    );
    expect(row(balance, "Okapi")).toMatchObject({ partial: true, verdict: null });
    expect(row(balance, "Noctis").part).toBe(2_000 * 48 * 1.5);
    expect(balance.coverage).toEqual({ members: 2, senders: 1, missing: ["Okapi"] });
    // Without a verdict last, the others by gap.
    expect(balance.rows.map((r) => r.pseudo)).toEqual(["Noctis", "Okapi"]);
  });

  it("leaves out a member the export does not know", () => {
    const balance = balanceOf(input({ members: ["Noctis", "Okapi", "Inconnu"] }));
    expect(row(balance, "Inconnu")).toMatchObject({ production: 0, part: 0, ratio: null, verdict: null });
  });

  it("sorts by gap, the biggest first", () => {
    const balance = balanceOf(input({ convoys: [delivered("Noctis", "Okapi", 50_000)] }));
    expect(balance.rows.map((r) => r.pseudo)).toEqual(["Okapi", "Noctis"]);
  });
});

describe("inOutOf", () => {
  const PER_DAY = 1_000 * 48;

  it("averages what comes in and goes out over each member's days in the alliance, today counting so far", () => {
    const okapi = player("Okapi", 1_000, {
      days: [
        { day: YESTERDAY, field: 1_000, alliance: "AUTRE" },
        { day: TODAY, field: 1_000, alliance: "4O4" },
      ],
    });
    const balance = balanceOf(
      input({ players: [player("Noctis", 3_000), okapi], convoys: [delivered("Noctis", "Okapi", 6_000)] }),
    );
    const chart = inOutOf(balance.rows, balance.partPerDay);
    const noctis = chart.rows.find((r) => r.pseudo === "Noctis");
    const okapiRow = chart.rows.find((r) => r.pseudo === "Okapi");
    expect(noctis).toMatchObject({ days: null, present: true, partial: false });
    expect(noctis?.in.production).toBe(3 * PER_DAY);
    expect(noctis?.out.convoys).toBe(6_000 / 1.5);
    expect(noctis?.rest).toBe(3 * PER_DAY - 6_000 / 1.5);
    // Arrived today: half a day so far, one day of the period.
    expect(okapiRow).toMatchObject({ days: 1, present: true });
    expect(okapiRow?.in.production).toBe(PER_DAY);
    expect(okapiRow?.in.convoys).toBe(6_000 / 0.5);
    expect(okapiRow?.part).toBe(row(balance, "Okapi").part / 0.5);
  });

  it("keeps the order of the rows given", () => {
    const balance = balanceOf(input({ convoys: [delivered("Noctis", "Okapi", 50_000)] }));
    const reversed = [...balance.rows].reverse();
    expect(inOutOf(reversed, balance.partPerDay).rows.map((r) => r.pseudo)).toEqual(reversed.map((r) => r.pseudo));
  });

  it("splits the colony taxes paid and received", () => {
    const balance = balanceOf(
      input({
        players: [player("Noctis", 1_000), player("Okapi", 1_000, { master: "Noctis" })],
        taxRates: { okapi: 0.25 },
      }),
    );
    const chart = inOutOf(balance.rows, balance.partPerDay);
    expect(chart.rows.find((r) => r.pseudo === "Noctis")?.in.taxes).toBe(PER_DAY * 0.25);
    expect(chart.rows.find((r) => r.pseudo === "Okapi")?.out.taxes).toBe(PER_DAY * 0.25);
    expect(chart.rows.find((r) => r.pseudo === "Okapi")?.rest).toBe(PER_DAY * 0.75);
  });

  it("gives no rest to a member who does not send their Convois", () => {
    const balance = balanceOf(input({ senders: ["Noctis"] }));
    const okapi = inOutOf(balance.rows, balance.partPerDay).rows.find((r) => r.pseudo === "Okapi");
    expect(okapi).toMatchObject({ partial: true, rest: null });
    expect(okapi?.in.production).toBe(PER_DAY);
  });

  it("draws nothing for a member never in the alliance over the period", () => {
    const balance = balanceOf(input({ members: ["Noctis", "Okapi", "Inconnu"] }));
    const unknown = inOutOf(balance.rows, balance.partPerDay).rows.find((r) => r.pseudo === "Inconnu");
    expect(unknown).toMatchObject({ present: false, days: 0, rest: null, part: null });
    expect(unknown?.in).toEqual({ production: 0, taxes: 0, convoys: 0 });
  });

  it("scales the axis on round ticks around zero, wide enough for every bar, rest and the average part", () => {
    const balance = balanceOf(input({ convoys: [delivered("Noctis", "Okapi", 30_000)] }));
    const chart = inOutOf(balance.rows, balance.partPerDay);
    // Out: 20 000 a day at most; in: 48 000 + 20 000 at most.
    expect(chart.min).toBe(-20_000);
    expect(chart.max).toBe(80_000);
    expect(chart.ticks).toEqual([-20_000, 0, 20_000, 40_000, 60_000, 80_000]);
  });

  it("widens the axis to a rest below zero", () => {
    const balance = balanceOf(input({ convoys: [delivered("Noctis", "Gargantua", 150_000)] }));
    const chart = inOutOf(balance.rows, balance.partPerDay);
    expect(chart.rows[1]?.rest).toBe(PER_DAY - 100_000);
    expect(chart.min).toBe(-100_000);
  });

  it("keeps an axis without any bar", () => {
    expect(inOutOf([], 0)).toEqual({ rows: [], min: 0, max: 1, ticks: [0] });
  });
});

describe("the Entrepôt estimé", () => {
  const stockAt = NOW.getTime() - 6 * 3600_000;
  const warehouse = {
    stock: { food: 10_000, materials: 20_000, at: stockAt },
    perDay: { food: 4_800, materials: 2_400 },
  };

  it("adds the production since the stock to it, less the convoys gone, plus those come", () => {
    const balance = balanceOf(
      input({
        warehouses: { noctis: { ...warehouse, capacities: null } },
        convoys: [
          delivered("Noctis", "Okapi", 1_000, stockAt + 3600_000),
          delivered("Okapi", "Noctis", 300, stockAt + 3600_000),
          delivered("Noctis", "Okapi", 5_000, stockAt - 3600_000),
          { ...delivered("Noctis", "Okapi", 700), kind: "transit", at: NOW.getTime() + 3600_000 },
        ],
      }),
    );
    expect(row(balance, "Noctis").warehouse).toEqual({
      food: 10_000 + 1_200 - 1_000 + 300 - 700,
      materials: 20_000 + 600,
      capped: false,
    });
    expect(row(balance, "Okapi").warehouse).toBeNull();
  });

  it("is bounded by the warehouses' capacities when known", () => {
    const balance = balanceOf(
      input({ warehouses: { noctis: { ...warehouse, capacities: { food: 5_000, materials: 100_000 } } } }),
    );
    expect(row(balance, "Noctis").warehouse).toEqual({ food: 5_000, materials: 20_600, capped: true });
  });

  it("is unknown when the stock is 48 hours old or more", () => {
    const old = { ...warehouse, stock: { ...warehouse.stock, at: NOW.getTime() - 48 * 3600_000 }, capacities: null };
    expect(row(balanceOf(input({ warehouses: { noctis: old } })), "Noctis").warehouse).toBeNull();
  });

  it("is read from a member's shared state: its production net of tax, its capacities", () => {
    expect(
      warehouseInputOf({
        server: "s5",
        alliance: "4O4",
        pseudo: "Noctis",
        readAt: NOW,
        production: {
          foodWorkers: 100,
          materialWorkers: 50,
          mushroomPerDay: 1_000,
          taxRate: 0.25,
          master: null,
          colonies: null,
        },
        stock: { food: 1, materials: 2, at: new Date(stockAt) },
        capacities: { food: 9, materials: 8 },
      }),
    ).toEqual({
      stock: { food: 1, materials: 2, at: stockAt },
      perDay: { food: (100 * 48 + 1_000) * 0.75, materials: 50 * 48 * 0.75 },
      capacities: { food: 9, materials: 8 },
    });
    expect(warehouseInputOf({ server: "s5", alliance: "4O4", pseudo: "Noctis", readAt: NOW })).toBeNull();
  });
});

describe("balanceDiscord", () => {
  it("writes one line per member with a verdict, then those without, never the warehouse", () => {
    const balance = balanceOf(
      input({
        members: ["Noctis", "Okapi", "Grop"],
        senders: ["Noctis", "Okapi"],
        players: [player("Noctis", 3_000), player("Okapi", 1_000), player("Grop", 2_000)],
        warehouses: {
          noctis: {
            stock: { food: 1, materials: 1, at: NOW.getTime() },
            perDay: { food: 0, materials: 0 },
            capacities: null,
          },
        },
      }),
    );
    const text = balanceDiscord(balance, { tag: "4O4", days: 30, now: NOW });
    expect(text.split("\n")).toEqual([
      "**Équilibre 4O4 · 30 jours** (du 02/11 au 03/11)",
      "Production : 432K · part par jour : 96K",
      "- Noctis : convoyer · écart +72K (ratio 1,5)",
      "- Okapi : recevoir · écart −72K (ratio 0,5)",
      "(Grop n'envoie pas ses convois : pas de verdict)",
    ]);
  });
});

describe("balanceLine", () => {
  it("writes the verdict and the gap under a Priorité", () => {
    const balance = balanceOf(
      input({ senders: ["Noctis"], players: [player("Noctis", 3_000), player("Okapi", 1_000)] }),
    );
    expect(balanceLine(row(balance, "Noctis"), 30)).toBe("Équilibre : convoyer (+72K sur 30 jours)");
    expect(balanceLine(row(balance, "Okapi"), 30)).toBe("Équilibre : partiel");
  });
});

describe("verdictText", () => {
  it("writes the verdict in words", () => {
    expect([verdictText("convoy"), verdictText("balanced"), verdictText("receive"), verdictText(null)]).toEqual([
      "Convoyer",
      "Équilibré",
      "Recevoir",
      "Partiel",
    ]);
  });
});

describe("balancePlayers", () => {
  it("dates each day of the export at its midnight in Paris", () => {
    const [okapi] = balancePlayers([
      { pseudo: "Okapi", master: "Noctis", days: [{ day: "2026-11-03", field: 10, alliance: "4O4" }] },
    ]);
    expect(okapi).toEqual({ pseudo: "Okapi", master: "Noctis", days: [{ day: TODAY, field: 10, alliance: "4O4" }] });
  });
});

describe("taxRatesOf", () => {
  const production = { foodWorkers: 0, materialWorkers: 0, mushroomPerDay: 0, master: null, colonies: null };
  it("takes the colonized player's own rate, else their colonizer's Étable à pucerons", () => {
    const players = [
      player("Okapi", 1, { master: "Noctis" }),
      player("Lasius", 1, { master: "Noctis" }),
      player("Grop", 1, { master: "Gargantua" }),
      player("Noctis", 1),
    ];
    const states = [
      { pseudo: "Okapi", production: { ...production, taxRate: 0.31 } },
      { pseudo: "Noctis", buildings: { aphids: 7 } },
    ];
    expect(taxRatesOf(states, players)).toEqual({ okapi: 0.31, lasius: 0.27 });
  });
});
