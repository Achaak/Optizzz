import { describe, expect, it } from "vitest";
import { DEFAULT_HUNT_VIEW, huntViewSearch, readHuntView } from "./hunt-view";

const params = (search: string) => new URLSearchParams(search);

describe("the « Chasses » tab's choice in the address", () => {
  it("reads the view, the period and the member, the defaults for what it does not know", () => {
    expect(readHuntView(params("onglet=chasses&vue=liste&periode=30j&membre=noctis"), ["Noctis"])).toEqual({
      view: "list",
      period: "30j",
      member: "Noctis",
    });
    expect(readHuntView(params("periode=90j&membre=Inconnu"), ["Noctis"])).toEqual(DEFAULT_HUNT_VIEW);
  });

  it("writes only what differs from the defaults", () => {
    expect(huntViewSearch(DEFAULT_HUNT_VIEW)).toBe("onglet=chasses");
    expect(huntViewSearch({ view: "list", period: "24h", member: "Noctis" })).toBe(
      "onglet=chasses&vue=liste&periode=24h&membre=Noctis",
    );
  });
});
