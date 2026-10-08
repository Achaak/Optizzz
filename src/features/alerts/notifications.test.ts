import { describe, expect, it } from "vitest";
import type { Sections } from "../end-times/recap";
import type { ServerData } from "./badge";
import { dueNotifications, type NotificationSettings } from "./notifications";

const MINUTE = 60_000;
const now = new Date(2026, 9, 8, 16, 40);
const at = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);

const ALL: NotificationSettings = { famine: true, full: true, construction: true, hunt: true };

/** S5, read just now, eating `perHour` food an hour from `food`. */
const server = (food: number, perHour: number, overrides: Partial<ServerData> = {}): ServerData => ({
  host: "s5.fourmizzz.fr",
  stock: { food, materials: 0, workers: 1000, readAt: now },
  income: {
    foodWorkers: 0,
    materialWorkers: 0,
    mushroomPerDay: 0,
    armyPerDay: perHour * 24,
    taxRate: 0,
    nextHarvestAt: at(10),
    hunts: [],
    newWorkersGoTo: "none",
    readAt: now,
  },
  capacities: null,
  ...overrides,
});

const input = (servers: ServerData[], ends: Record<string, Sections> = {}, settings = ALL) => ({
  servers,
  ends,
  settings,
  sent: {},
});

describe("dueNotifications", () => {
  it("warns once famine is less than an hour away, naming the server", () => {
    // 520 food, 600 eaten an hour: 52 min.
    expect(dueNotifications(input([server(520, 600)]), now)).toEqual([
      {
        id: expect.stringContaining("s5.fourmizzz.fr:famine:") as string,
        message: "S5 : famine dans 52 min (17 h 32)",
        url: "https://s5.fourmizzz.fr/Ressources.php",
      },
    ]);
  });

  it("says nothing more than an hour before, or when switched off", () => {
    expect(dueNotifications(input([server(700, 600)]), now)).toEqual([]);
    expect(dueNotifications(input([server(520, 600)], {}, { ...ALL, famine: false }), now)).toEqual([]);
  });

  it("says nothing already said", () => {
    const [notice] = dueNotifications(input([server(520, 600)]), now);
    const sent = { [notice?.id ?? ""]: { at: now.getTime(), url: "" } };
    // Read again a few minutes later: the forecast barely moved.
    const later = server(500, 600, {});
    expect(dueNotifications({ ...input([later]), sent }, at(1))).toEqual([]);
  });

  it("does not say again a famine whose forecast crossed a quarter-hour boundary", () => {
    const [notice] = dueNotifications(input([server(520, 600)]), now);
    const slot = Number(notice?.id.split(":")[2]);
    // Same famine, foreseen in the next quarter hour.
    const sent = { [`s5.fourmizzz.fr:famine:${String(slot - 1)}`]: { at: now.getTime(), url: "" } };
    expect(dueNotifications({ ...input([server(520, 600)]), sent }, now)).toEqual([]);
  });

  it("says a famine that has just come, not one missed for more than 15 minutes", () => {
    // Read 1 h ago with 50 min of food: starving for 10 min.
    const recent = server(500, 600, { stock: { food: 500, materials: 0, workers: 1000, readAt: at(-60) } });
    expect(dueNotifications(input([recent]), now)).toMatchObject([{ message: "S5 : famine depuis 16 h 30" }]);
    const missed = server(300, 600, { stock: { food: 300, materials: 0, workers: 1000, readAt: at(-60) } });
    expect(dueNotifications(input([missed]), now)).toEqual([]);
  });

  it("trusts no forecast older than 24 hours", () => {
    const old = server(520, 600, { stock: { food: 520, materials: 0, workers: 1000, readAt: at(-25 * 60) } });
    expect(dueNotifications(input([old]), now)).toEqual([]);
  });

  it("warns of a full warehouse", () => {
    const base = server(0, 0, { capacities: { food: 100_000, materials: 1000 } });
    const data = { ...base, income: base.income && { ...base.income, materialWorkers: 1000 } };
    expect(dueNotifications(input([data]), now)).toMatchObject([
      {
        message: "S5 : entrepôt de matériaux plein dans 10 min (16 h 50)",
        url: "https://s5.fourmizzz.fr/Ressources.php",
      },
    ]);
    expect(dueNotifications(input([data], {}, { ...ALL, full: false }), now)).toEqual([]);
  });

  it("says when a construction, a research or a hunt is over, with a link to its page", () => {
    const ends: Record<string, Sections> = {
      "s5.fourmizzz.fr": {
        construction: { kind: "construction", readAt: at(-120), items: [{ label: "Couveuse 12", endsAt: at(-1) }] },
        research: { kind: "research", readAt: at(-120), items: [{ label: "Bouclier 8", endsAt: at(30) }] },
        hunt: { kind: "hunt", readAt: at(-120), items: [{ label: "Chasse 183 cm²", endsAt: at(-5) }] },
        laying: { kind: "laying", readAt: at(-120), items: [{ label: "100 JSN", endsAt: at(-2) }] },
      },
    };
    expect(dueNotifications(input([], ends), now)).toEqual([
      {
        id: "s5.fourmizzz.fr:construction:Couveuse 12:" + String(at(-1).getTime()),
        message: "S5 : chantier terminé · Couveuse 12",
        url: "https://s5.fourmizzz.fr/construction.php",
      },
      {
        id: "s5.fourmizzz.fr:hunt:Chasse 183 cm²:" + String(at(-5).getTime()),
        message: "S5 : chasse rentrée · 183 cm²",
        url: "https://s5.fourmizzz.fr/Ressources.php",
      },
    ]);
  });

  it("forgets ends missed for more than 15 minutes, and those switched off", () => {
    const ends: Record<string, Sections> = {
      "s5.fourmizzz.fr": {
        construction: { kind: "construction", readAt: at(-120), items: [{ label: "Couveuse 12", endsAt: at(-16) }] },
        research: { kind: "research", readAt: at(-120), items: [{ label: "Bouclier 8", endsAt: at(-1) }] },
      },
    };
    expect(dueNotifications(input([], ends), now)).toHaveLength(1);
    expect(dueNotifications(input([], ends, { ...ALL, construction: false }), now)).toEqual([]);
  });
});
