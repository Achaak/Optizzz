import { describe, expect, it } from "vitest";
import { formatChance, stepNotice, unitsText } from "./view";

describe("formatChance", () => {
  it("never shows 100 % or 0 % unless it is certain", () => {
    expect(formatChance(1)).toBe("100 %");
    expect(formatChance(0.9996)).toBe("> 99 %");
    expect(formatChance(0.934)).toBe("93 %");
    expect(formatChance(0.003)).toBe("< 1 %");
    expect(formatChance(0)).toBe("0 %");
  });
});

describe("unitsText", () => {
  it("lists the units sent with their short names, in game order", () => {
    expect(unitsText({ SN: 70, JSN: 1000, Tk: 0 })).toBe("1 000 JSN + 70 SN");
    expect(unitsText({})).toBe("aucune unité");
  });
});

describe("stepNotice", () => {
  it("warns when the hunts cross a difficulty step", () => {
    expect(stepNotice(4400, 100)).toBe(
      "Ces chasses font passer ton terrain au palier de 4 457 cm² : les suivantes seront 4 % plus difficiles.",
    );
  });

  it("tells how far the next step is otherwise", () => {
    expect(stepNotice(3886, 118)).toBe("Prochain palier de difficulté à 4 457 cm² (encore 453 cm² après ces chasses).");
  });
});
