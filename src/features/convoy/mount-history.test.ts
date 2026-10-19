import { describe, expect, it, vi } from "vitest";
import type { ConvoyHistory } from "@/data/convoy-history";
import type { ConvoyMessage } from "@/game/pages/messages";
import { mountConvoyHistory } from "./mount-history";

const now = new Date(2026, 9, 19, 12, 30);
const DAY = 24 * 3600_000;
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const message = (
  id: number,
  direction: ConvoyMessage["direction"],
  player: string,
  food: number,
  materials: number,
  at: Date,
): ConvoyMessage => ({ id, direction, player, food, materials, at });

const history: ConvoyHistory = {
  messages: [
    message(4, "sent", "Fourmi_Alpha", 0, 381_000, ago(0.3)),
    message(3, "received", "Beta-42", 2, 1, ago(0.4)),
    message(2, "sent", "Beta-42", 0, 249_999, ago(3)),
    message(1, "sent", "Atta", 0, 35_000, ago(20)),
  ],
  readAt: new Date(now.getTime() - 5 * 60_000),
  coveredFrom: ago(10),
};

function setup() {
  document.body.innerHTML = `<div id="centre"><table class="simulateur"></table><h3>Convois en cours:</h3>
    <div class="Bas"></div></div>`;
  const copy = vi.fn(() => Promise.resolve());
  const view = mountConvoyHistory(document, () => now, copy);
  const panel = () => document.querySelector<HTMLElement>(".optizzz-convoy-history");
  const rows = (index: number) =>
    [
      ...(panel()?.querySelectorAll("table")[index]?.querySelectorAll<HTMLTableRowElement>("tbody tr, tfoot tr") ?? []),
    ].map((row) => [...row.cells].map((cell) => cell.textContent.trim()));
  const button = (label: string) =>
    [...(panel()?.querySelectorAll("button") ?? [])].find((element) => element.textContent === label);
  return { view, panel, rows, button, copy };
}

describe("mountConvoyHistory", () => {
  it("sits before the bottom of the page, and says it is reading the inbox until it knows", () => {
    const { view, panel } = setup();
    expect(panel()?.nextElementSibling?.className).toBe("Bas");
    expect(panel()?.textContent).toContain("Lecture de la messagerie…");
    view.update(null);
    expect(panel()?.textContent).toContain("La messagerie n'a pas pu être lue");
  });

  it("lists each player's convoys of the last 7 days, delivered then received, with totals", () => {
    const { view, rows, panel } = setup();
    view.update(history);
    expect(rows(0)).toEqual([
      ["Fourmi_Alpha", "0", "381 000"],
      ["Beta-42", "0", "249 999"],
      ["Total", "0", "630 999"],
    ]);
    expect(rows(1)).toEqual([["Beta-42", "2", "1"]]);
    expect(panel()?.querySelector("a")?.getAttribute("href")).toBe("Membre.php?Pseudo=Fourmi_Alpha");
    expect(panel()?.textContent).toContain("lue aujourd'hui 12 h 25");
  });

  it("changes period, and warns when it starts before the convoys Optizzz knows", () => {
    const { view, rows, button, panel } = setup();
    view.update(history);
    button("24 h")?.click();
    expect(button("24 h")?.getAttribute("aria-pressed")).toBe("true");
    expect(rows(0)).toEqual([["Fourmi_Alpha", "0", "381 000"]]);
    expect(panel()?.querySelector(".optizzz-callout")).toBeNull();
    button("30 jours")?.click();
    expect(rows(0).map((row) => row[0])).toEqual(["Fourmi_Alpha", "Beta-42", "Atta", "Total"]);
    expect(panel()?.querySelector(".optizzz-callout")?.textContent).toContain("avant le 09/10 à 12 h 30");
  });

  it("says when nothing was delivered or received", () => {
    const { view, panel } = setup();
    view.update({ ...history, messages: [] });
    expect(panel()?.querySelectorAll("table")).toHaveLength(0);
    expect(panel()?.textContent).toContain("Aucun convoi livré");
    expect(panel()?.textContent).toContain("Aucun convoi reçu");
  });

  it("copies the period's summary as text", async () => {
    const { view, button, copy } = setup();
    view.update(history);
    button("Copier")?.click();
    expect(copy).toHaveBeenCalledWith(
      expect.stringMatching(/^Convois du 12\/10 à 12 h 30 au 19\/10 à 12 h 30\nLivrés :/),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(button("Copié !")).toBeDefined();
  });
});
