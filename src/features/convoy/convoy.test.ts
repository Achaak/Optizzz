import { describe, expect, it } from "vitest";
import commerceHtml from "./__fixtures__/commerce.html?raw";
import { planConvoy, readConvoysOnWay, recipients, workersAway, workersNeeded } from "./convoy";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date(2026, 9, 7, 20, 31, 45);
const player = (pseudo: string, x: number, y: number, alliance: string | null = null) => ({ pseudo, x, y, alliance });

describe("readConvoysOnWay", () => {
  it("reads each convoy on its way, its load and when it arrives from the time the page shows", () => {
    expect(
      readConvoysOnWay(parse(commerceHtml), now).map(({ recipient, food, materials, arrivesAt }) => ({
        recipient,
        food,
        materials,
        arrivesAt,
      })),
    ).toEqual([
      { recipient: "Messor", food: 1, materials: 0, arrivesAt: new Date(2026, 9, 7, 21, 54, 7) },
      { recipient: "Tetramorium", food: 0, materials: 12_500, arrivesAt: new Date(2026, 9, 8, 22, 34, 49) },
    ]);
  });

  it("reads nothing when no convoy is on its way", () => {
    expect(readConvoysOnWay(parse("<div id='centre'><h2>Convois</h2></div>"), now)).toEqual([]);
  });
});

describe("workersNeeded", () => {
  it("takes one worker per 10 resources, 5 % more per aphid stable level", () => {
    expect(workersNeeded(1, 0)).toBe(1);
    expect(workersNeeded(10_000, 0)).toBe(1000);
    expect(workersNeeded(10_000, 4)).toBe(834);
  });
});

describe("planConvoy", () => {
  const base = {
    from: player("Formica", 55, 28),
    to: player("Messor", 54, 31),
    attackSpeed: 0,
    aphids: 0,
    idleWorkers: 300,
  };

  it("times the trip with the sender's attack speed", () => {
    const plan = planConvoy({ ...base, resources: 1 }, now);
    expect(plan.distance).toBeCloseTo(3.162, 3);
    expect(plan.duration).toBe(5731 * 1000);
    expect(plan.arrivesAt).toEqual(new Date(now.getTime() + 5731 * 1000));
    expect(plan).toMatchObject({ workers: 1, workingTaken: 0, harvestLost: 0 });
  });

  it("counts the working ants taken beyond the idle ones, and what they would have harvested meanwhile", () => {
    // 5 000 resources need 500 workers: 200 more than the 300 idle, away 5 732 s at 2 resources an hour.
    const plan = planConvoy({ ...base, resources: 5000 }, now);
    expect(plan).toMatchObject({ workers: 500, workingTaken: 200, harvestLost: Math.round((200 * 2 * 5731) / 3600) });
  });
});

describe("recipients", () => {
  it("lists the alliance first, then everyone else, each by distance, without the sender", () => {
    const me = player("Formica", 0, 0, "XYZ");
    const players = [
      player("Far friend", 10, 0, "XYZ"),
      me,
      player("Neighbour", 1, 0, "OTHER"),
      player("Near friend", 2, 0, "XYZ"),
      player("Stranger", 5, 0),
    ];
    expect(recipients(players, "Formica").map((recipient) => recipient.pseudo)).toEqual([
      "Near friend",
      "Far friend",
      "Neighbour",
      "Stranger",
    ]);
  });

  it("keeps the export's order when the sender is not in it", () => {
    expect(recipients([player("A", 1, 1), player("B", 0, 0)], "Nobody").map((p) => p.pseudo)).toEqual(["A", "B"]);
  });
});

describe("workersAway", () => {
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  const convoy = (recipient: string, food: number, materials: number, arrivesAt: Date) => ({
    recipient,
    food,
    materials,
    arrivesAt,
  });

  it("counts the workers each convoy on its way carries, soonest back first", () => {
    expect(workersAway([convoy("Tetramorium", 0, 12_500, at(90)), convoy("Messor", 1, 0, at(30))], 0, now)).toEqual([
      { recipient: "Messor", workers: 1, backAt: at(30) },
      { recipient: "Tetramorium", workers: 1250, backAt: at(90) },
    ]);
  });

  it("carries more with the Étable à pucerons and forgets the convoys arrived", () => {
    expect(workersAway([convoy("A", 600, 600, at(10)), convoy("B", 5, 0, at(0))], 4, now)).toEqual([
      { recipient: "A", workers: 100, backAt: at(10) },
    ]);
  });
});
