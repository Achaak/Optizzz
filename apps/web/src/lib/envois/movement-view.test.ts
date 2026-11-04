import { describe, expect, it } from "vitest";
import { movementViewSearch, readMovementView } from "./movement-view";

const members = ["Noctis", "Zeph"];
const read = (search: string) => readMovementView(new URLSearchParams(search), members);

describe("the « Mouvements » tab's choice in the address", () => {
  it("opens on today, the whole alliance, every kind", () => {
    expect(read("")).toEqual({ day: null, member: null, kinds: ["flood", "convoy", "hunt"] });
  });

  it("reads a day, a member as the space writes them, and kinds", () => {
    expect(read("jour=2026-11-02&membre=zeph&types=chasses,floods")).toEqual({
      day: "2026-11-02",
      member: "Zeph",
      kinds: ["flood", "hunt"],
    });
  });

  it("ignores what it does not know", () => {
    expect(read("jour=hier&membre=Gargantua&types=attaques")).toEqual({
      day: null,
      member: null,
      kinds: ["flood", "convoy", "hunt"],
    });
  });

  it("writes only what differs from the default, the tab with it", () => {
    expect(movementViewSearch({ day: null, member: null, kinds: ["flood", "convoy", "hunt"] })).toBe(
      "onglet=mouvements",
    );
    expect(movementViewSearch({ day: "2026-11-02", member: "Zeph", kinds: ["hunt", "flood"] })).toBe(
      "onglet=mouvements&jour=2026-11-02&membre=Zeph&types=floods,chasses",
    );
  });
});
