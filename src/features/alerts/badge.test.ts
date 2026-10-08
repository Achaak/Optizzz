import { describe, expect, it } from "vitest";
import { badge, type ServerData } from "./badge";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const now = new Date(2026, 9, 8, 16, 40);
const ago = (ms: number) => new Date(now.getTime() - ms);

/** A server read just now, with nothing moving, unless a test says otherwise. */
const server = (overrides: Partial<ServerData> = {}): ServerData => ({
  host: "s5.fourmizzz.fr",
  stock: { food: 0, materials: 0, workers: 1000, readAt: now },
  income: {
    foodWorkers: 0,
    materialWorkers: 0,
    mushroomPerDay: 0,
    armyPerDay: 0,
    taxRate: 0,
    nextHarvestAt: new Date(now.getTime() + 10 * MINUTE),
    hunts: [],
    newWorkersGoTo: "none",
    readAt: now,
  },
  capacities: null,
  ...overrides,
});

/** Eats `perHour` food an hour from `food`: famine after food / perHour hours. */
const starving = (food: number, perHour: number, overrides: Partial<ServerData> = {}) => {
  const base = server(overrides);
  return {
    ...base,
    stock: { ...base.stock, food },
    income: base.income && { ...base.income, armyPerDay: perHour * 24 },
  };
};

describe("badge", () => {
  it("is red with hours and minutes under 2 hours of famine", () => {
    // 1 000 food, 600 eaten an hour: 1 h 40.
    expect(badge([starving(1000, 600)], now)).toEqual({
      text: "1h40",
      color: "red",
      title: "Optizzz\nS5 : famine dans 1 h 40 (18 h 20)",
    });
  });

  it("is orange with whole hours between 2 and 12 hours", () => {
    // 5 h 50, rounded down.
    expect(badge([starving(3500, 600)], now)).toMatchObject({ text: "5h", color: "orange" });
  });

  it("shows minutes under an hour", () => {
    expect(badge([starving(450, 600)], now)).toMatchObject({ text: "45m", color: "red" });
  });

  it("shows « ! » when the problem has already come", () => {
    // Read 2 hours ago with 1 h 40 of food left: starving since 16 h 20.
    const data = starving(1000, 600, { stock: { food: 0, materials: 0, workers: 1000, readAt: ago(2 * HOUR) } });
    expect(badge([data], now)).toEqual({
      text: "!",
      color: "red",
      title: "Optizzz\nS5 : famine depuis 16 h 20",
    });
  });

  it("shows nothing beyond 12 hours, but the hover still tells", () => {
    // 52 h of food.
    expect(badge([starving(5200, 100)], now)).toEqual({
      text: "",
      color: null,
      title: "Optizzz\nS5 : famine dans 2 j 4 h (sam. 20 h 40)",
    });
  });

  it("says so when nothing is coming", () => {
    expect(badge([server()], now)).toEqual({ text: "", color: null, title: "Optizzz\nS5 : rien de prévu" });
  });

  it("sees nothing coming beyond 30 days", () => {
    // 31 days of food.
    expect(badge([starving(31 * 24, 1)], now)).toMatchObject({ title: "Optizzz\nS5 : rien de prévu" });
  });

  it("shows a gray « ? » when the stock was read more than 24 hours ago", () => {
    const data = server({ stock: { food: 0, materials: 0, workers: 1000, readAt: ago(50 * HOUR) } });
    expect(badge([data], now)).toEqual({
      text: "?",
      color: "gray",
      title: "Optizzz\nS5 : données d'il y a 2 j 2 h, ouvrez le jeu",
    });
  });

  it("shows « ? » when the income was read more than 24 hours ago", () => {
    const base = server();
    const data = { ...base, income: base.income && { ...base.income, readAt: ago(25 * HOUR) } };
    expect(badge([data], now)).toMatchObject({ text: "?", color: "gray" });
  });

  it("shows « ? » until Ressources has been read", () => {
    expect(badge([server({ income: null })], now)).toEqual({
      text: "?",
      color: "gray",
      title: "Optizzz\nS5 : ouvrez la page Ressources",
    });
  });

  it("forgets a server left for more than 7 days", () => {
    const data = server({ stock: { food: 0, materials: 0, workers: 1000, readAt: ago(8 * 24 * HOUR) } });
    expect(badge([data], now)).toEqual({ text: "", color: null, title: "Optizzz" });
  });

  it("warns of a full warehouse", () => {
    // 1 000 materials a harvest, every 30 min from 16 h 50: full at the 4th, 18 h 20.
    const base = server({ capacities: { food: 100_000, materials: 4000 } });
    const data = { ...base, income: base.income && { ...base.income, materialWorkers: 1000 } };
    expect(badge([data], now)).toEqual({
      text: "1h40",
      color: "red",
      title: "Optizzz\nS5 : entrepôt de matériaux plein dans 1 h 40 (18 h 20)",
    });
  });

  it("shows the worst server, the others' lines sorted by urgency", () => {
    const servers = [
      server({ host: "s1.fourmizzz.fr" }),
      starving(5200, 100, { host: "s2.fourmizzz.fr" }),
      server({ host: "s3.fourmizzz.fr", income: null }),
      starving(3500, 600, { host: "s4.fourmizzz.fr" }),
      starving(1000, 600, { host: "s5.fourmizzz.fr" }),
    ];
    expect(badge(servers, now)).toEqual({
      text: "1h40",
      color: "red",
      title: [
        "Optizzz",
        "S5 : famine dans 1 h 40 (18 h 20)",
        "S4 : famine dans 5 h 50 (22 h 30)",
        "S3 : ouvrez la page Ressources",
        "S2 : famine dans 2 j 4 h (sam. 20 h 40)",
        "S1 : rien de prévu",
      ].join("\n"),
    });
  });
});
