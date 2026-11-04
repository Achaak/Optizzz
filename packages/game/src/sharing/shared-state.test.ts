import { describe, expect, it } from "vitest";
import { mergeMemberStates, type SharedState } from "./shared-state";

const at = (iso: string) => new Date(iso);
const base = { server: "s5", alliance: "ABC", pseudo: "Messor" };
const state = (iso: string, parts: Partial<SharedState>): SharedState => ({ ...base, readAt: at(iso), ...parts });

describe("mergeMemberStates", () => {
  it("is null without any source", () => {
    expect(mergeMemberStates([])).toBeNull();
  });

  it("keeps the newest reading of each part, whatever its source", () => {
    const pasted = {
      latest: state("2026-10-25T10:00:00Z", { huntingField: 8000, workers: 9000, research: { weapons: 12 } }),
    };
    const levels = { latest: state("2026-10-26T08:00:00Z", { research: { weapons: 13 }, buildings: { dome: 5 } }) };
    const production = { latest: state("2026-10-24T08:00:00Z", { huntingField: 7000, workers: 8500 }) };

    const merged = mergeMemberStates([pasted, levels, production]);

    expect(merged?.latest).toMatchObject({ huntingField: 8000, workers: 9000, research: { weapons: 13 } });
    expect(merged?.latest.buildings).toEqual({ dome: 5 });
    expect(merged?.latest.readAt).toEqual(at("2026-10-26T08:00:00Z"));
  });

  it("takes the reading before the newest one of each part for the changes", () => {
    const pasted = {
      latest: state("2026-10-25T10:00:00Z", { research: { weapons: 12 } }),
      previous: state("2026-10-20T10:00:00Z", { research: { weapons: 11 } }),
    };
    const levels = {
      latest: state("2026-10-26T08:00:00Z", { research: { weapons: 13 } }),
      previous: state("2026-10-23T08:00:00Z", { research: { weapons: 12 } }),
    };

    const merged = mergeMemberStates([levels, pasted]);

    expect(merged?.previous?.research).toEqual({ weapons: 12 });
    expect(merged?.previous?.readAt).toEqual(at("2026-10-25T10:00:00Z"));
  });

  it("counts a reading seen twice once: no previous from the same time", () => {
    const one = { latest: state("2026-10-25T10:00:00Z", { workers: 10 }) };
    const merged = mergeMemberStates([one, { latest: { ...one.latest } }]);
    expect(merged).toEqual({ latest: one.latest, partsReadAt: { workers: one.latest.readAt } });
  });

  it("dates each part by the reading it comes from", () => {
    const levels = { latest: state("2026-10-26T08:00:00Z", { research: { weapons: 13 } }) };
    const production = { latest: state("2026-10-24T08:00:00Z", { huntingField: 7000, workers: 8500 }) };

    const merged = mergeMemberStates([levels, production]);

    expect(merged?.partsReadAt).toEqual({
      research: at("2026-10-26T08:00:00Z"),
      huntingField: at("2026-10-24T08:00:00Z"),
      workers: at("2026-10-24T08:00:00Z"),
    });
  });
});
