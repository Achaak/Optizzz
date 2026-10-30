import { beforeEach, describe, expect, it } from "vitest";
import { allianceDemandesPanel, convoyFilledNote, fillConvoyForm, shownLevelsOf } from "./alliance-demandes";
import type { DemandesAnswer } from "./demandes";

const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";

const answer = (extra: Partial<Extract<DemandesAnswer, { problem: null }>> = {}): DemandesAnswer => ({
  problem: null,
  spaceUrl: "https://optizzz.fr/spaces/abc",
  open: [
    {
      id: ID,
      requester: "Lasius",
      label: "Champignonnière niveau 12",
      status: "validated",
      cost: { food: 0, materials: 120_000 },
      remaining: { food: 0, materials: 40_000 },
      onWay: { food: 0, materials: 80_000 },
      priorite: "2,5 jours",
    },
    {
      id: "covered",
      requester: "Formica",
      label: "Dôme niveau 3",
      status: "covered",
      cost: { food: 0, materials: 14_000 },
      remaining: { food: 0, materials: 0 },
      onWay: { food: 0, materials: 14_000 },
      priorite: "Priorité inconnue",
    },
  ],
  mine: [],
  toValidate: 0,
  attaches: true,
  ...extra,
});

describe("the alliance's Demandes on commerce.php", () => {
  it("lists the validated Demandes with what remains to send, the status in words, and « Envoyer un convoi »", () => {
    const sent: string[] = [];
    const panel = allianceDemandesPanel(document, answer(), (id) => sent.push(id));
    expect(panel?.querySelector("h3")?.textContent).toBe("Demandes de l'alliance");
    const rows = [...(panel?.querySelectorAll("tbody tr") ?? [])].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent),
    );
    expect(rows).toEqual([
      [
        "Lasius",
        "2,5 jours",
        "Champignonnière niveau 12",
        "40 000 matériaux (80 000 en route)",
        "validée",
        "Envoyer un convoi",
      ],
      ["Formica", "Priorité inconnue", "Dôme niveau 3", "rien (14 000 en route)", "couverte", ""],
    ]);
    panel?.querySelector("button")?.click();
    expect(sent).toEqual([ID]);
  });

  it("tells an Admin or a Délégué the Demandes to validate, and the player their own", () => {
    const panel = allianceDemandesPanel(
      document,
      answer({
        open: [],
        toValidate: 2,
        mine: [
          {
            id: "m",
            requester: "Messor",
            label: "Laboratoire niveau 9",
            status: "pending",
            cost: { food: 0, materials: 358_400 },
            remaining: { food: 0, materials: 358_400 },
            onWay: { food: 0, materials: 0 },
          },
        ],
      }),
      () => undefined,
    );
    expect(panel?.textContent).toContain("Aucune Demande validée n'attend de convoi.");
    expect(panel?.querySelector("a")?.textContent).toBe("2 Demandes à valider sur optizzz.fr");
    expect(panel?.querySelector("a")?.getAttribute("href")).toBe("https://optizzz.fr/spaces/abc");
    expect(panel?.textContent).toContain("Vos Demandes : Laboratoire niveau 9 (à valider)");
  });

  it("shows nothing without an account or a space, and asks to open the space without the key", () => {
    expect(allianceDemandesPanel(document, { problem: "unlinked" }, () => undefined)).toBeNull();
    expect(allianceDemandesPanel(document, { problem: "no-space" }, () => undefined)).toBeNull();
    expect(allianceDemandesPanel(document, { problem: "no-key" }, () => undefined)?.textContent).toContain(
      "Ouvrez votre espace sur optizzz.fr",
    );
  });
});

describe("« Envoyer un convoi »", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form action="commerce.php" method="post">
        <input id="pseudo_convoi" name="pseudo_convoi">
        <input id="input_nbNourriture" type="tel"><input id="nbNourriture" type="hidden" name="nbNourriture">
        <input id="input_nbMateriaux" type="tel"><input id="nbMateriaux" type="hidden" name="nbMateriaux">
        <input type="submit" name="convoi" value="Lancer le convoi">
      </form>`;
  });

  it("fills the game's form, never sends it", () => {
    let submitted = false;
    const form = document.querySelector("form");
    form?.addEventListener("submit", (event) => {
      submitted = true;
      event.preventDefault();
    });
    const typed: string[] = [];
    document.getElementById("input_nbMateriaux")?.addEventListener("keyup", () => typed.push("keyup"));
    expect(fillConvoyForm(document, { recipient: "Lasius", food: 0, materials: 40_000 })).toBe(true);
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    expect([value("pseudo_convoi"), value("input_nbNourriture"), value("input_nbMateriaux")]).toEqual([
      "Lasius",
      "0",
      "40000",
    ]);
    expect([value("nbNourriture"), value("nbMateriaux")]).toEqual(["0", "40000"]);
    // The game's script and the convoy calculator read the fields on their events.
    expect(typed).toEqual(["keyup"]);
    expect(submitted).toBe(false);
  });

  it("says what was filled, and that the player sends it themself", () => {
    expect(
      convoyFilledNote({
        ok: true,
        recipient: "Lasius",
        label: "Champignonnière niveau 12",
        food: 0,
        materials: 40_000,
        short: true,
        attaches: false,
      }),
    ).toEqual([
      "Formulaire rempli pour la Demande de Lasius (Champignonnière niveau 12) : 40 000 matériaux. Vérifiez-le, puis cliquez vous-même « Lancer le convoi ».",
      "Vous avez moins que ce qui reste à envoyer : le formulaire en prend ce que vous avez.",
      "Cochez « Convois » dans Fonctionnalités › Compte Optizzz pour que ce convoi compte pour la Demande.",
    ]);
  });
});

describe("the levels a page shows", () => {
  it("reads the levels and the works of construction.php", () => {
    document.body.innerHTML = `
      <div class="ligneAmelioration"><h2>Champignonnière</h2><span class="niveau_amelioration">Niveau 12</span></div>`;
    expect(shownLevelsOf(document, "/construction.php", new Date())).toEqual({ levels: { mushroom: 12 }, works: [] });
    expect(shownLevelsOf(document, "/commerce.php", new Date())).toBeNull();
  });
});
