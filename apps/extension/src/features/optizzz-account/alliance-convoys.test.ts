import { describe, expect, it } from "vitest";
import { allianceConvoysPanel } from "./alliance-convoys";

const NOW = new Date("2026-10-25T15:00:00Z");

describe("the alliance's convoys on commerce.php", () => {
  it("lists those on their way to the player, with the sender, the load and the arrival", () => {
    const panel = allianceConvoysPanel(
      document,
      {
        problem: null,
        convoys: [{ from: "Lasius", food: 12_348, materials: 0, at: Date.parse("2026-10-25T17:12:00Z") }],
      },
      NOW,
    );
    expect(panel?.querySelector("h3")?.textContent).toBe("Convois de l'alliance en route vers vous");
    const cells = [...(panel?.querySelectorAll("tbody td") ?? [])].map((td) => td.textContent);
    expect(cells).toEqual(["Lasius", "12 348", "0", "aujourd'hui 18 h 12"]);
    expect(panel?.textContent).toContain("Seuls les convois des membres qui les envoient à Optizzz apparaissent ici");
  });

  it("says when none is on its way, or when the access must be opened on optizzz.fr", () => {
    expect(allianceConvoysPanel(document, { problem: null, convoys: [] }, NOW)?.textContent).toContain(
      "Aucun convoi d'un membre en route vers vous.",
    );
    expect(allianceConvoysPanel(document, { problem: "no-key", convoys: [] }, NOW)?.textContent).toContain(
      "Ouvrez votre espace sur optizzz.fr",
    );
  });

  it("shows nothing without an account or a space", () => {
    expect(allianceConvoysPanel(document, { problem: "unlinked", convoys: [] }, NOW)).toBeNull();
    expect(allianceConvoysPanel(document, { problem: "no-space", convoys: [] }, NOW)).toBeNull();
  });
});
