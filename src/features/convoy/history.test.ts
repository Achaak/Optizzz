import { describe, expect, it } from "vitest";
import type { ConvoyMessage } from "@/game/pages/messages";
import { convoySummaryText, summarizeConvoys } from "./history";

const at = (day: number, hours = 12) => new Date(2026, 9, day, hours, 0);
const message = (
  id: number,
  direction: ConvoyMessage["direction"],
  player: string,
  food: number,
  materials: number,
  when: Date,
): ConvoyMessage => ({ id, direction, player, food, materials, at: when });

const messages = [
  message(6, "sent", "Fourmi_Alpha", 0, 381_000, at(19, 5)),
  message(5, "received", "Beta-42", 2, 1, at(19, 2)),
  message(4, "sent", "Beta-42", 0, 249_999, at(18)),
  message(3, "sent", "fourmi_alpha", 180_000, 75_000, at(14)),
  message(2, "sent", "Atta", 0, 35_000, at(12, 6)),
  message(1, "sent", "Atta", 0, 1_000, at(1)),
];

describe("summarizeConvoys", () => {
  it("adds up each player's convoys of the period, most first, sent apart from received", () => {
    expect(summarizeConvoys(messages, at(12), at(19, 12))).toEqual({
      sent: [
        { player: "Fourmi_Alpha", food: 180_000, materials: 456_000 },
        { player: "Beta-42", food: 0, materials: 249_999 },
      ],
      received: [{ player: "Beta-42", food: 2, materials: 1 }],
      sentTotal: { food: 180_000, materials: 705_999 },
      receivedTotal: { food: 2, materials: 1 },
    });
  });

  it("is empty when nothing falls in the period", () => {
    expect(summarizeConvoys(messages, at(2), at(3))).toEqual({
      sent: [],
      received: [],
      sentTotal: { food: 0, materials: 0 },
      receivedTotal: { food: 0, materials: 0 },
    });
  });
});

describe("convoySummaryText", () => {
  it("writes one line per player, then the totals, ready to paste on Discord", () => {
    const summary = summarizeConvoys(messages, at(12), at(19, 12));
    expect(convoySummaryText(summary, at(12), at(19, 12), at(1))).toBe(
      [
        "Convois du 12/10 à 12 h 00 au 19/10 à 12 h 00",
        "Livrés :",
        "- Fourmi_Alpha : 180 000 nourriture et 456 000 matériaux",
        "- Beta-42 : 249 999 matériaux",
        "Total livré : 180 000 nourriture et 705 999 matériaux",
        "Reçus :",
        "- Beta-42 : 2 nourriture et 1 matériaux",
        "Total reçu : 2 nourriture et 1 matériaux",
      ].join("\n"),
    );
  });

  it("says when nothing was sent or received, and when convoys may be missing", () => {
    const summary = summarizeConvoys([], at(12), at(19, 12));
    expect(convoySummaryText(summary, at(12), at(19, 12), at(15, 9))).toBe(
      [
        "Convois du 12/10 à 12 h 00 au 19/10 à 12 h 00",
        "Livrés : aucun",
        "Reçus : aucun",
        "(convois inconnus avant le 15/10 à 9 h 00)",
      ].join("\n"),
    );
  });
});
