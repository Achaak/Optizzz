import { describe, expect, it } from "vitest";
import { formatChance, formatShare, parisClockTime, ratioOptionText, splitText, stepNotice, unitsText } from "./view";

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
      "Ces chasses font passer votre terrain au palier de 4 457 cm² : les suivantes seront 4 % plus difficiles.",
    );
  });

  it("tells how far the next step is otherwise", () => {
    expect(stepNotice(3886, 118)).toBe("Prochain palier de difficulté à 4 457 cm² (encore 453 cm² après ces chasses).");
  });
});

describe("splitText", () => {
  it("writes equal hunts as a product, others as a sum", () => {
    expect(splitText([115, 115])).toBe("2 × 115 cm²");
    expect(splitText([1200, 118])).toBe("1 200 + 118 cm²");
    expect(splitText([])).toBe("aucune chasse");
  });
});

describe("ratioOptionText", () => {
  it("tells what the ratio would hunt and cost", () => {
    const choice = { ratio: 8, hunts: 2, totalAmount: 231, lostUnits: 11.6, replyChance: 0.874 };
    expect(ratioOptionText(8, choice)).toBe("8 → réplique 87 %, pertes moy. 12, 231 cm² (2 × 115)");
    expect(ratioOptionText(6.5, undefined)).toBe("6,5");
    expect(ratioOptionText(1, { ...choice, hunts: 0, totalAmount: 0 })).toBe("1 → aucune chasse possible");
  });
});

describe("formatShare", () => {
  it("writes a share as a percentage with one decimal", () => {
    expect(formatShare(0.1581)).toBe("15,8 %");
  });
});

describe("parisClockTime", () => {
  it("reads a clock on a Paris day", () => {
    const now = new Date("2026-10-17T14:00:00Z");
    expect(parisClockTime(now, 0, "16:47")?.toISOString()).toBe("2026-10-17T14:47:00.000Z");
    expect(parisClockTime(now, 1, "8:00")?.toISOString()).toBe("2026-10-18T06:00:00.000Z");
    expect(parisClockTime(now, 0, "midi")).toBeNull();
  });
});
