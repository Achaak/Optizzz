import { describe, expect, it } from "vitest";
import { convoyViewSearch, DEFAULT_CONVOY_VIEW, readConvoyView } from "./convoy-view";

const members = ["Noctis", "Lunaire"];
const read = (search: string) => readConvoyView(new URLSearchParams(search), members);

describe("the Convois tab's choice in the address", () => {
  it("opens on the statistics of 30 days for the whole alliance", () => {
    expect(read("")).toEqual({ view: "stats", days: 30, range: null, measure: "production", member: null });
  });

  it("reads the list, a period and a member, the member as the space writes them", () => {
    expect(read("vue=liste&periode=7&membre=noctis")).toEqual({
      view: "list",
      days: 7,
      range: null,
      measure: "production",
      member: "Noctis",
    });
  });

  it("reads and writes the Équilibre", () => {
    expect(read("vue=equilibre&periode=7")).toEqual({
      view: "balance",
      days: 7,
      range: null,
      measure: "production",
      member: null,
    });
    expect(convoyViewSearch({ ...DEFAULT_CONVOY_VIEW, view: "balance", member: "Noctis" })).toBe(
      "onglet=convois&vue=equilibre&membre=Noctis",
    );
  });

  it("reads and writes the days, their measure and a free period", () => {
    expect(read("vue=jours&mesure=envoyes&du=2026-10-12&au=2026-10-20")).toEqual({
      view: "days",
      days: 30,
      range: { from: "2026-10-12", to: "2026-10-20" },
      measure: "sent",
      member: null,
    });
    expect(
      convoyViewSearch({
        ...DEFAULT_CONVOY_VIEW,
        view: "days",
        days: 7,
        range: { from: "2026-10-12", to: "2026-10-20" },
        measure: "afterColonies",
      }),
    ).toBe("onglet=convois&vue=jours&du=2026-10-12&au=2026-10-20&mesure=apres-colonies");
  });

  it("ignores what it does not know", () => {
    expect(read("vue=graphe&periode=12&membre=Gargantua&mesure=or")).toEqual(DEFAULT_CONVOY_VIEW);
  });

  it("writes only what differs from the default, the tab with it", () => {
    expect(convoyViewSearch(DEFAULT_CONVOY_VIEW)).toBe("onglet=convois");
    expect(convoyViewSearch({ ...DEFAULT_CONVOY_VIEW, view: "list", days: 90, member: "Lunaire" })).toBe(
      "onglet=convois&vue=liste&periode=90&membre=Lunaire",
    );
  });
});
