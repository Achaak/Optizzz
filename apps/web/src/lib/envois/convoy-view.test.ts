import { describe, expect, it } from "vitest";
import { convoyViewSearch, readConvoyView } from "./convoy-view";

const members = ["Noctis", "Lunaire"];
const read = (search: string) => readConvoyView(new URLSearchParams(search), members);

describe("the Convois tab's choice in the address", () => {
  it("opens on the statistics of 30 days for the whole alliance", () => {
    expect(read("")).toEqual({ view: "stats", days: 30, member: null });
  });

  it("reads the list, a period and a member, the member as the space writes them", () => {
    expect(read("vue=liste&periode=7&membre=noctis")).toEqual({ view: "list", days: 7, member: "Noctis" });
  });

  it("reads and writes the Équilibre", () => {
    expect(read("vue=equilibre&periode=7")).toEqual({ view: "balance", days: 7, member: null });
    expect(convoyViewSearch({ view: "balance", days: 30, member: "Noctis" })).toBe(
      "onglet=convois&vue=equilibre&membre=Noctis",
    );
  });

  it("ignores what it does not know", () => {
    expect(read("vue=graphe&periode=12&membre=Gargantua")).toEqual({ view: "stats", days: 30, member: null });
  });

  it("writes only what differs from the default, the tab with it", () => {
    expect(convoyViewSearch({ view: "stats", days: 30, member: null })).toBe("onglet=convois");
    expect(convoyViewSearch({ view: "list", days: 90, member: "Lunaire" })).toBe(
      "onglet=convois&vue=liste&periode=90&membre=Lunaire",
    );
  });
});
