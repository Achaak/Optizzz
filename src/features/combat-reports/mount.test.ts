import { describe, expect, it, vi } from "vitest";
import conversationsHtml from "@/game/pages/__fixtures__/combat-conversations.html?raw";
import { readCombatConversation } from "@/game/pages/combat-reports";
import { decodeOpponent } from "@/features/combat-simulator/form";
import { mountCombatReport } from "./mount";

const setup = () => {
  const doc = new DOMParser().parseFromString(conversationsHtml, "text/html");
  const conversations = [...doc.querySelectorAll(".contenu_conversation")];
  const loots = conversations.flatMap((conversation) => readCombatConversation(conversation).loots);
  return { doc, conversations, loots };
};

const rows = (root: ParentNode, selector: string) =>
  [...root.querySelectorAll(`.optizzz-combat-report ${selector}`)].map((row) =>
    [...row.children].map((cell) => cell.textContent.replace(/\u00a0/g, " ").trim()),
  );

describe("mountCombatReport", () => {
  it("shows each attack with both armies, the opponent's Weapons and what was taken", () => {
    const { conversations, loots } = setup();
    const conversation = conversations[0];
    if (!conversation) throw new Error("fixture");
    mountCombatReport(conversation, { loots: () => loots, simulate: vi.fn() });

    expect(rows(conversation, "thead tr")[0]).toEqual(["Date et lieu", "Résultat", "Mon armée", "Armée adverse", ""]);
    expect(rows(conversation, "tbody tr")).toEqual([
      [
        "16/10/26 14h58Terrain de chasse",
        "VictoirePris : 6 044 cm²",
        "5 531 JSN, 485 SN, 29 NEPertes : 0",
        "10 JSNPertes : 10 · Armes : ?",
        "Simuler",
      ],
    ]);
    // The game's text stays: it is short, and its links work.
    expect(conversation.querySelector(".contenuJoueur")).not.toBeNull();
  });

  it("says an occupying army defended, and reads the opponent's Weapons from their bonus", () => {
    const { conversations, loots } = setup();
    const conversation = conversations[2];
    if (!conversation) throw new Error("fixture");
    mountCombatReport(conversation, { loots: () => loots, simulate: vi.fn() });
    const [row] = rows(conversation, "tbody tr");
    expect(row?.slice(0, 4)).toEqual([
      expect.stringContaining("Fourmilière, armée d'occupation"),
      "Défaite",
      "1 JSNPertes : 1",
      "28 892 TEPertes : 0 · Armes : 31",
    ]);
  });

  it("asks for the « Butin » conversation when the loot is not open", () => {
    const { conversations } = setup();
    const conversation = conversations[0];
    if (!conversation) throw new Error("fixture");
    const report = mountCombatReport(conversation, { loots: () => [], simulate: vi.fn() });
    expect(rows(conversation, "tbody tr")[0]?.[1]).toBe("VictoirePris : ?");
    expect(conversation.querySelector(".optizzz-combat-report-loot")?.getAttribute("title")).toContain(
      "« Butin chez Fourmi_Alpha »",
    );
    report.update();
    expect(conversation.querySelectorAll(".optizzz-combat-report tbody tr")).toHaveLength(1);
  });

  it("opens the simulator with the army seen at the place attacked", () => {
    const { conversations, loots } = setup();
    const conversation = conversations[2];
    if (!conversation) throw new Error("fixture");
    const simulate = vi.fn();
    mountCombatReport(conversation, { loots: () => loots, simulate });
    conversation.querySelector<HTMLButtonElement>(".optizzz-combat-report tbody button")?.click();
    expect(decodeOpponent(simulate.mock.calls[0]?.[0] as string)).toEqual({
      place: "nest",
      army: { TuE: 28892 },
      weapons: 31,
      seen: "attaque du 19/10/26 10h36 contre Fourmi_Beta",
    });
  });

  it("adds nothing to a conversation without an attack", () => {
    const { conversations, loots } = setup();
    const conversation = conversations[1];
    if (!conversation) throw new Error("fixture");
    mountCombatReport(conversation, { loots: () => loots, simulate: vi.fn() });
    expect(conversation.querySelector(".optizzz-combat-report")).toBeNull();
  });
});
