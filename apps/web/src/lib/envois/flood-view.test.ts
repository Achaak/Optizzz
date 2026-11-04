import { describe, expect, it } from "vitest";
import { floodViewSearch, readFloodView } from "./flood-view";

const members = ["Noctis", "Lunaire"];
const read = (search: string) => readFloodView(new URLSearchParams(search), members);

describe("the Floods tab's choice in the address", () => {
  it("opens on the statistics of 7 days for the whole alliance", () => {
    expect(read("")).toEqual({ view: "stats", period: "7j", range: null, member: null });
  });

  it("reads the list, 24 hours and a member, the member as the space writes them", () => {
    expect(read("vue=liste&periode=24h&membre=lunaire")).toEqual({
      view: "list",
      period: "24h",
      range: null,
      member: "Lunaire",
    });
  });

  it("reads and writes a free period", () => {
    expect(read("du=2026-10-30&au=2026-11-01").range).toEqual({ from: "2026-10-30", to: "2026-11-01" });
    expect(
      floodViewSearch({ view: "stats", period: "7j", range: { from: "2026-10-30", to: "2026-11-01" }, member: null }),
    ).toBe("onglet=floods&du=2026-10-30&au=2026-11-01");
  });

  it("ignores what it does not know", () => {
    expect(read("vue=x&periode=30&membre=Gargantua")).toEqual({
      view: "stats",
      period: "7j",
      range: null,
      member: null,
    });
  });

  it("writes only what differs from the default, the tab with it", () => {
    expect(floodViewSearch({ view: "stats", period: "7j", range: null, member: null })).toBe("onglet=floods");
    expect(floodViewSearch({ view: "list", period: "24h", range: null, member: "Noctis" })).toBe(
      "onglet=floods&vue=liste&periode=24h&membre=Noctis",
    );
  });
});
