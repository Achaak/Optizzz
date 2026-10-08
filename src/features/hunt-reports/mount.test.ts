import { describe, expect, it, vi } from "vitest";
import conversationHtml from "./__fixtures__/conversation.html?raw";
import { mountHuntReport } from "./mount";

const setup = () => {
  const doc = new DOMParser().parseFromString(conversationHtml, "text/html");
  const conversation = doc.querySelector(".contenu_conversation");
  if (!conversation) throw new Error("fixture");
  return { doc, conversation };
};

const cells = (doc: Document, selector: string) =>
  [...doc.querySelectorAll(`.optizzz-hunt-report ${selector}`)].map((row) =>
    // Numbers and units are joined by non-breaking spaces, never cut apart.
    [...row.children].map((cell) => cell.textContent.replace(/\u00a0/g, " ").trim()),
  );

const levels = { shield: 4, cochineal: 0 };

describe("mountHuntReport", () => {
  it("shows one row per fight with the predicted losses, and a total", () => {
    const { doc, conversation } = setup();
    mountHuntReport(conversation, levels, vi.fn());

    expect(doc.querySelector(".optizzz-hunt-report thead")?.textContent).toContain("Pertes (prévu avec Bouclier 4)");
    expect(cells(doc, "tbody tr")).toEqual([
      ["07/10/26 11h08", "1 921 JSN, 119 SN", "43 Petites araignées", "4 (prévu 4, +1 blessée)", "5", "118", "794"],
      [
        "07/10/26 12h40",
        "1 975 JSN, 124 SN",
        "18 Petites araignées, 8 Guèpes",
        "5 (prévu 5, +1 blessée)",
        "5",
        "122",
        "820",
      ],
    ]);
    expect(cells(doc, "tfoot tr")[0]).toEqual(["Total : 2 combats", "", "", "9", "10", "240", "1 614"]);
    expect(doc.querySelector(".optizzz-hunt-report-yield")?.textContent).toBe(
      "26,7 cm² par fourmi tuée (d'après les rapports, sans les blessées)",
    );
  });

  it("flags a fight far from the prediction", () => {
    const { doc, conversation } = setup();
    mountHuntReport(conversation, { shield: 0, cochineal: 0 }, vi.fn());
    const flagged = [...doc.querySelectorAll(".optizzz-hunt-report tbody tr")].map((row) =>
      row.classList.contains("optizzz-hunt-report-off"),
    );
    expect(flagged).toContain(true);
  });

  it("says when the shield is unknown", () => {
    const { doc, conversation } = setup();
    mountHuntReport(conversation, null, vi.fn());
    expect(doc.querySelector(".optizzz-hunt-report thead")?.textContent).toContain("Bouclier inconnu");
    expect(cells(doc, "tbody tr")[0]?.[3]).toBe("4");
  });

  it("folds the game's text away, and shows it on demand", () => {
    const { doc, conversation } = setup();
    mountHuntReport(conversation, levels, vi.fn());
    const gameTable = conversation.querySelector<HTMLElement>(":scope > td > table");
    const toggle = doc.querySelector<HTMLButtonElement>(".optizzz-hunt-report-text");
    expect(gameTable?.hidden).toBe(true);
    toggle?.click();
    expect(gameTable?.hidden).toBe(false);
    expect(toggle?.textContent).toBe("Masquer le texte du jeu");
  });

  it("copies the fights, one line each", () => {
    const { doc, conversation } = setup();
    const copy = vi.fn(() => Promise.resolve());
    mountHuntReport(conversation, levels, copy);
    doc.querySelector<HTMLButtonElement>(".optizzz-hunt-report-copy")?.click();
    expect(copy).toHaveBeenCalledWith(
      "07/10/26 11h08|1921 JSN, 119 SN|43 Petites araignées|6358+2544|43|56|4|5|118|794\n" +
        "07/10/26 12h40|1975 JSN, 124 SN|18 Petites araignées, 8 Guèpes|6545+2618|26|64|5|5|122|820",
    );
  });

  it("loads the older fights through the game's link, and redraws when they come", () => {
    const { doc, conversation } = setup();
    const report = mountHuntReport(conversation, levels, vi.fn());
    const gameLink = conversation.querySelector<HTMLAnchorElement>("a");
    const clicked = vi.fn();
    gameLink?.addEventListener("click", clicked);
    doc.querySelector<HTMLButtonElement>(".optizzz-hunt-report-older")?.click();
    expect(clicked).toHaveBeenCalledOnce();

    const older = conversation.querySelector('tr[id^="message_"]')?.cloneNode(true) as HTMLElement;
    older.id = "message_10";
    conversation.querySelector("tbody")?.prepend(older);
    report.update();
    expect(cells(doc, "tbody tr")).toHaveLength(3);
  });

  it("tells how many fights the conversation has when only some are shown", () => {
    const { doc, conversation } = setup();
    mountHuntReport(conversation, levels, () => Promise.resolve(), 191);
    expect(doc.querySelector(".optizzz-hunt-report tfoot")?.textContent).toContain("affichés sur 191");
  });

  it("keeps the game's « Corbeille » at hand when its text is folded", () => {
    const { doc, conversation } = setup();
    const gameTable = conversation.querySelector(":scope > td > table");
    if (!gameTable) throw new Error("fixture");
    const bin = doc.createElement("a");
    bin.href = "#";
    bin.textContent = "Corbeille";
    gameTable.querySelector("td")?.append(bin);
    mountHuntReport(conversation, null, () => Promise.resolve());
    expect(bin.closest(".optizzz-hunt-report-tools")).not.toBeNull();
  });
});
