import { describe, expect, it } from "vitest";
import type { Alliance } from "@/data/exports";
import { diplomacyWith, diplomaticCamps } from "./diplomacy";

const alliance = (tag: string, diplomacy: Partial<Alliance["diplomacy"]> = {}): Alliance => ({
  tag,
  name: tag,
  playersCount: 1,
  totalField: 0,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars: [], ...diplomacy },
});

describe("diplomaticCamps", () => {
  it("lists my pacts, and the wars declared by either side whatever their case", () => {
    const alliances = [
      alliance("MOI", { pacts: [{ tag: "ami", name: "PNA", description: "" }], wars: ["Kiss", "MOI"] }),
      alliance("AMI"),
      alliance("KISS"),
      alliance("EVO", { wars: ["moi"] }),
      alliance("NEUTRE"),
    ];
    expect(diplomaticCamps("moi", alliances)).toEqual({ pacts: ["AMI"], wars: ["KISS", "EVO"] });
  });

  it("is empty for an alliance missing from the export", () => {
    expect(diplomaticCamps("NEW", [alliance("EVO", { wars: ["NEW"] })])).toEqual({ pacts: [], wars: [] });
  });
});

describe("diplomacyWith", () => {
  const mine = alliance("MOI", { wars: ["RIVAL", "ennemi"] });

  it("tells who declared a war: us, them or both sides", () => {
    expect(diplomacyWith(mine, alliance("rival"))).toEqual({ kind: "war", declaredBy: "us" });
    expect(diplomacyWith(mine, alliance("HOSTILE", { wars: ["moi"] }))).toEqual({ kind: "war", declaredBy: "them" });
    expect(diplomacyWith(mine, alliance("ENNEMI", { wars: ["MOI"] }))).toEqual({ kind: "war", declaredBy: "both" });
  });

  it("puts a pact before a war, and has nothing between an alliance and itself", () => {
    const pact = { tag: "AMI", name: "PNA", description: "" };
    expect(diplomacyWith(alliance("MOI", { pacts: [pact], wars: ["AMI"] }), alliance("AMI"))).toEqual({
      kind: "pact",
      name: "PNA",
      description: "",
    });
    expect(diplomacyWith(mine, alliance("moi", { wars: ["MOI"] }))).toBeNull();
  });
});
