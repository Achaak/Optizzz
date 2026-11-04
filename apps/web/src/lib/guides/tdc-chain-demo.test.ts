import { floodLinkFormat, floodToolPlan } from "@optizzz/game/site-links/flood";
import { describe, expect, it } from "vitest";
import { tdcChainDemo } from "./tdc-chain-demo";

const demo = tdcChainDemo();
const names = demo.members.map((member) => member.name);
const cell = (attacker: string, target: string) => demo.matrix[names.indexOf(attacker)]?.[names.indexOf(target)];

describe("tdcChainDemo", () => {
  it("lists the invented alliance from the granaries down to the hunters", () => {
    expect(names).toEqual([
      "Brindebois",
      "Chaumelune",
      "Ardoisine",
      "Terrepaille",
      "Mandiflore",
      "Pollenard",
      "Ramille",
    ]);
    expect(demo.members.map((member) => member.role.kind)).toEqual([
      "granary",
      "granary",
      "passer",
      "passer",
      "hunter",
      "hunter",
      "hunter",
    ]);
  });

  it("gives what each member takes from each other one in a won attack, nothing out of range", () => {
    expect(cell("Chaumelune", "Ardoisine")).toBe(112_000);
    expect(cell("Ardoisine", "Brindebois")).toBe(240_000);
    expect(cell("Brindebois", "Ardoisine")).toBeNull();
    expect(cell("Mandiflore", "Mandiflore")).toBeNull();
  });

  it("plans the hunters' surplus up to a granary, numbered in landing order", () => {
    expect(demo.hits.map((hit) => hit.n)).toEqual(demo.hits.map((_, i) => i + 1));
    expect(demo.hits[0]).toMatchObject({ attacker: "Chaumelune", target: "Ardoisine" });
    expect(demo.hits.some((hit) => hit.target === "Mandiflore")).toBe(true);
    expect(demo.hits.some((hit) => hit.target === "Pollenard")).toBe(true);
    expect(demo.hits.some((hit) => hit.target === "Ramille")).toBe(false);
  });

  it("marks the matrix cells the plan uses", () => {
    expect(demo.planned.has("Chaumelune→Ardoisine")).toBe(true);
    expect(demo.planned.has("Ardoisine→Brindebois")).toBe(false);
  });

  it("leaves the passers where they started", () => {
    const last = (name: string) =>
      demo.hits.findLast((hit) => hit.attacker === name || hit.target === name) ?? demo.hits[0];
    const camponotus = last("Terrepaille");
    expect(camponotus?.attacker === "Terrepaille" ? camponotus.attackerAfter : camponotus?.targetAfter).toBe(300_000);
  });

  it("names the hunter no one can reach, the passer missing and who could be it", () => {
    expect(demo.gap).toEqual({
      name: "Ramille",
      field: 90_000,
      above: "Terrepaille",
      min: 151_500,
      max: 178_217,
      candidates: ["Mandiflore", "Pollenard"],
    });
  });

  it("opens the plan's first attack in the flood simulator, which takes as much in all", () => {
    const [path, encoded] = demo.floodLink.split("#p=");
    expect(path).toBe("/tools/flood");
    const state = floodLinkFormat.decode(encoded ?? "");
    expect(state).toMatchObject({ attackerField: 1_050_000, targetField: 560_000 });
    const plan = state && floodToolPlan(state);
    const taken = plan?.kind === "plan" ? plan.attacks.reduce((sum, attack) => sum + attack.take, 0) : 0;
    expect(taken).toBe(demo.hits[0]?.take);
  });
});
