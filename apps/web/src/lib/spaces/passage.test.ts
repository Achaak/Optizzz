import type { Launch, ProjectedFlood } from "@optizzz/game/tdc-chain/passage";
import { describe, expect, it } from "vitest";
import { passageAlerts, passageDiscord, passageInput, passageViewSearch, readPassageView } from "./passage";

// Sunday 1 November 2026, 12 h 00 in Paris (UTC+1).
const NOW = new Date("2026-11-01T11:00:00Z").getTime();
const MIN = 60_000;

const launch = (n: number, attackerId: number, targetId: number, take: number, more: Partial<Launch> = {}): Launch => ({
  n,
  attackerId,
  targetId,
  take,
  arrival: NOW + 65 * MIN,
  departFrom: NOW + 5 * MIN,
  departTo: NOW + 20 * MIN,
  approx: false,
  attackerBefore: 0,
  attackerAfter: 0,
  targetBefore: 0,
  targetAfter: 0,
  ...more,
});

const flood = (more: Partial<ProjectedFlood>): ProjectedFlood => ({
  from: "Lunaire",
  target: "Brindille",
  at: NOW + 105 * MIN,
  expected: 86_400,
  actual: 0,
  status: "fails",
  targetBefore: 432_000,
  targetAfter: 432_000,
  before: null,
  ...more,
});

const names = new Map([
  [1, "Okapi"],
  [2, "Zeph"],
  [3, "XaTaK"],
]);

describe("the Plan de passage copied for Discord", () => {
  it("gives each flood to launch in landing order, then the floods on their way that go wrong", () => {
    const text = passageDiscord(
      {
        launches: [
          launch(1, 1, 2, 122_000),
          launch(2, 3, 1, 254_400, {
            departFrom: NOW + 40 * MIN,
            departTo: NOW + 40 * MIN,
            arrival: NOW + 160 * MIN,
            approx: true,
          }),
        ],
        floods: [
          flood({}),
          flood({
            target: "Mandibule",
            status: "reduced",
            expected: 136_000,
            actual: 108_800,
            before: "Okapi",
            at: NOW + 36 * MIN,
          }),
          flood({ status: "holds", actual: 86_400 }),
        ],
      },
      { tag: "4O4", names, now: new Date(NOW) },
    );
    expect(text).toBe(
      [
        "**Plan de passage 4O4** (calculé à 12 h 00)",
        "1. partir 12 h 05–12 h 20 · Okapi → Zeph · 122 000 fourmis · arrivée 13 h 05",
        "2. partir ≈ 12 h 40 · XaTaK → Okapi · 254 400 fourmis · arrivée 14 h 40",
        "⚠ Lunaire → Brindille, arrivée 13 h 45 : échouera, hors portée à l'arrivée",
        "⚠ Lunaire → Mandibule, arrivée 12 h 36 : Okapi passe devant, prise 108 800 au lieu de 136 000",
      ].join("\n"),
    );
  });

  it("says when there is nothing to launch", () => {
    expect(passageDiscord({ launches: [], floods: [] }, { tag: "4O4", names, now: new Date(NOW) })).toBe(
      ["**Plan de passage 4O4** (calculé à 12 h 00)", "Aucun flood à lancer."].join("\n"),
    );
  });
});

describe("the Plan de passage in the address", () => {
  const members = ["Okapi", "Zeph"];
  const read = (search: string) => readPassageView(new URLSearchParams(search), members);

  it("opens on the roles, 6 hours ahead, for the reader", () => {
    expect(read("onglet=chaine")).toEqual({ view: "roles", horizon: 6, member: null });
  });

  it("reads the plan, an horizon and a member, and ignores what it does not know", () => {
    expect(read("vue=plan&horizon=12&membre=zeph")).toEqual({ view: "plan", horizon: 12, member: "Zeph" });
    expect(read("vue=x&horizon=5&membre=Gargantua")).toEqual({ view: "roles", horizon: 6, member: null });
  });

  it("writes only what differs from the default, the tab with it", () => {
    expect(passageViewSearch({ view: "roles", horizon: 6, member: null })).toBe("onglet=chaine");
    expect(passageViewSearch({ view: "plan", horizon: 24, member: "Okapi" })).toBe(
      "onglet=chaine&vue=plan&horizon=24&membre=Okapi",
    );
  });
});

describe("what the Plan de passage starts from", () => {
  const roster = [
    { id: 1, pseudo: "Okapi", field: 1_000_000, x: 0, y: 0, onHoliday: false, isBanned: false },
    { id: 2, pseudo: "Zeph", field: 600_000, x: 3, y: 4, onHoliday: false, isBanned: false },
  ];
  const state = (pseudo: string, readAt: number, more: object) => ({
    latest: { server: "s5", alliance: "4O4", pseudo, readAt: new Date(readAt), ...more },
  });

  it("takes each member's newest field, the export's marked as estimated, and their hunts, army and slots", () => {
    const { input, sources } = passageInput({
      roster,
      exportAt: NOW - 40 * MIN,
      states: [
        state("okapi", NOW - 5 * MIN, {
          huntingField: 1_150_000,
          research: { attackSpeed: 4 },
          army: { total: 90_000, incomplete: false },
        }),
        state("Zeph", NOW - 60 * MIN, {
          huntingField: 590_000,
          hunts: [{ returnsAt: new Date(NOW + 30 * MIN), fieldGain: 20_000 }],
        }),
      ],
      floods: [],
      roles: new Map(),
      keep: new Map(),
      now: NOW,
      horizonHours: 6,
    });
    expect(input.members).toEqual([
      { id: 1, pseudo: "Okapi", field: 1_150_000, fieldAt: NOW - 5 * MIN },
      { id: 2, pseudo: "Zeph", field: 600_000, fieldAt: NOW - 40 * MIN },
    ]);
    expect(sources.get(1)).toEqual({ at: NOW - 5 * MIN, approx: false });
    expect(sources.get(2)).toEqual({ at: NOW - 40 * MIN, approx: true });
    expect(input.hunts).toEqual([{ memberId: 2, at: NOW + 30 * MIN, gain: 20_000 }]);
    expect(input.ants?.get(1)).toBe(90_000);
    expect(input.slots.get(1)).toBe(5);
    // Zeph's Attack Speed is unknown: the members' median known level, and the trip is estimated.
    expect(input.slots.get(2)).toBe(5);
    expect(input.travel(2, 1)).toEqual({ seconds: expect.any(Number) as number, approx: true });
    expect(input.travel(1, 2).approx).toBe(false);
  });
});

describe("the alerts on the Chaîne tab", () => {
  it("counts the floods to come that will fail or take less than expected", () => {
    const roster = [
      { id: 1, pseudo: "Lunaire", field: 1_000_000, x: 0, y: 0, onHoliday: false, isBanned: false },
      { id: 2, pseudo: "Brindille", field: 540_000, x: 1, y: 1, onHoliday: false, isBanned: false },
    ];
    const floods = [
      { from: "Lunaire", target: "Brindille", at: NOW + 20 * MIN, take: 108_000 },
      { from: "Lunaire", target: "Brindille", at: NOW + 45 * MIN, take: 86_400 },
    ];
    expect(passageAlerts({ roster, exportAt: NOW - 10 * MIN, states: null, floods, now: NOW })).toBe(1);
    expect(passageAlerts({ roster, exportAt: NOW - 10 * MIN, states: null, floods, now: NOW + 50 * MIN })).toBe(0);
  });
});
