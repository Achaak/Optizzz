import { describe, expect, it } from "vitest";
import type { SharedState } from "@optizzz/game/sharing/shared-state";
import { withEnvois } from "./merge";

const at = (iso: string) => new Date(iso);
const state = (pseudo: string, iso: string, parts: Partial<SharedState>): SharedState => ({
  server: "s5",
  alliance: "ABC",
  pseudo,
  readAt: at(iso),
  ...parts,
});

describe("withEnvois", () => {
  it("merges the pasted states and the Envois of the members page's members, the newest part winning", () => {
    const pasted = {
      members: {
        Messor: { latest: state("Messor", "2026-10-25T10:00:00Z", { workers: 10, research: { weapons: 3 } }) },
      },
      manual: {},
    };
    const envois = [
      { latest: state("messor", "2026-10-26T10:00:00Z", { workers: 12, huntingField: 50 }) },
      { latest: state("Lasius", "2026-10-26T10:00:00Z", { army: { total: 5, incomplete: false } }) },
      { latest: state("Outsider", "2026-10-26T10:00:00Z", { workers: 1 }) },
    ];

    const merged = withEnvois(pasted, envois, ["Messor", "Lasius", "Formica"]);

    expect(Object.keys(merged.members)).toEqual(["Messor", "Lasius"]);
    expect(merged.members.Messor?.latest).toMatchObject({
      pseudo: "Messor",
      workers: 12,
      huntingField: 50,
      research: { weapons: 3 },
    });
    expect(merged.members.Messor?.previous?.workers).toBe(10);
    expect(merged.members.Lasius?.latest.army?.total).toBe(5);
  });
});
