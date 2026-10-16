import { describe, expect, it } from "vitest";
import type { Alliance } from "@/data/exports";
import { diplomaticCamps } from "./diplomacy";

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
