import { describe, expect, it } from "vitest";
import { allianceFloodsPanel } from "./alliance-floods";

const NOW = new Date("2026-10-26T15:00:00Z");
const at = (text: string) => Date.parse(text);

describe("the alliance's floods on Armee.php", () => {
  const answer = {
    problem: null,
    me: "Messor",
    members: ["Messor", "Lasius", "Formica"],
    floods: [
      { from: "Lasius", target: "Messor", at: at("2026-10-26T17:12:00Z"), take: 12_348 },
      { from: "Messor", target: "Formica", at: at("2026-10-26T16:00:00Z"), take: null },
      { from: "Lasius", target: "Ennemi", at: at("2026-10-26T16:00:00Z"), take: null },
    ],
  };

  it("lists first those on their way to the player, then those on the other members by target", () => {
    const panel = allianceFloodsPanel(document, answer, NOW);
    expect(panel?.querySelector("h3")?.textContent).toBe("Floods en route vers l'alliance");
    expect([...(panel?.querySelectorAll("h4, p, li") ?? [])].map((e) => e.textContent)).toEqual([
      "Vers vous",
      "Lasius, arrivée aujourd'hui 18 h 12, prise attendue 12 348",
      "Vers les autres membres",
      "Formica",
      "Messor, arrivée aujourd'hui 17 h 00",
      "Seuls les floods des membres qui les envoient à Optizzz apparaissent ici, d'après la dernière relève d'optizzz.fr.",
    ]);
  });

  it("says when none is on its way, or when the access must be opened on optizzz.fr", () => {
    const empty = allianceFloodsPanel(document, { ...answer, floods: [] }, NOW)?.textContent;
    expect(empty).toContain("Aucun flood d'un membre en route vers vous.");
    expect(empty).toContain("Aucun flood en route vers un autre membre.");
    expect(
      allianceFloodsPanel(document, { problem: "no-key", me: null, members: [], floods: [] }, NOW)?.textContent,
    ).toContain("Ouvrez votre espace sur optizzz.fr");
  });

  it("shows nothing without an account or a space", () => {
    for (const problem of ["unlinked", "no-space"] as const)
      expect(allianceFloodsPanel(document, { problem, me: null, members: [], floods: [] }, NOW)).toBeNull();
  });
});
