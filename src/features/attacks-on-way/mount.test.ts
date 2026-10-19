import { afterEach, describe, expect, it, vi } from "vitest";
import armeeS5Html from "@/features/flood/__fixtures__/armee-attacks-s5.html?raw";
import reinforcementsHtml from "@/features/flood/__fixtures__/armee-reinforcements-s2.html?raw";
import attackFormHtml from "@/features/flood/__fixtures__/attack-form.html?raw";
import { readAttacksOnWay } from "@/features/flood/attacks";
import { renderAttacksOnWay } from "./mount";
import { attacksOnWay } from ".";

const now = new Date(2026, 9, 16, 16, 39, 0);
const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

const setup = () => {
  const doc = new DOMParser().parseFromString(armeeS5Html, "text/html");
  const copied: string[] = [];
  stops.push(
    renderAttacksOnWay(
      doc,
      () => now,
      (text) => {
        copied.push(text);
        return Promise.resolve();
      },
    ),
  );
  const rows = [...doc.querySelectorAll(".optizzz-attacks .optizzz-on-way-row")];
  const texts = (selector: string) => rows.map((row) => row.querySelector(selector)?.textContent);
  return { doc, copied, rows, texts };
};

describe("renderAttacksOnWay", () => {
  it("lists the attacks with their target, place, troops as the game abbreviates them, and arrival", () => {
    const { texts } = setup();
    expect(texts(".optizzz-on-way-to")).toEqual(["→ Cible_1(TAG)", "→ Cible_2"]);
    expect(texts(".optizzz-attacks-place")).toEqual(["Terrain de chasse", "Fourmilière"]);
    expect(texts(".optizzz-attacks-troops")).toEqual(["4 047 JSN", "1 488 JSN, 485 SN, 29 NE"]);
    expect(texts(".optizzz-on-way-left")).toEqual(["dans 3H 15m 0s", "dans 3H 15m 3s"]);
    expect(texts(".optizzz-on-way-when")).toEqual(["arrivée aujourd'hui 19 h 54", "arrivée aujourd'hui 19 h 54"]);
  });

  it("folds the game's lines away, where they are still read", () => {
    const { doc } = setup();
    const folded = doc.querySelector<HTMLElement>(".optizzz-attacks-game");
    expect(folded?.hidden).toBe(true);
    expect(folded?.textContent).toContain("Vous allez attaquer");
    expect(folded?.querySelectorAll("small")).toHaveLength(2);
    expect(readAttacksOnWay(doc, now).map((attack) => attack.target)).toEqual(["Cible_1", "Cible_2"]);
  });

  it("lists troops coming home (« Des renforts arrivent »), alone or after the attacks, in the game's order", () => {
    const alone = new DOMParser().parseFromString(reinforcementsHtml, "text/html");
    stops.push(
      renderAttacksOnWay(
        alone,
        () => now,
        () => Promise.resolve(),
      ),
    );
    const row = alone.querySelector(".optizzz-attacks .optizzz-on-way-row");
    expect(row?.querySelector(".optizzz-on-way-to")?.textContent).toBe("← Renforts");
    expect(row?.querySelector(".optizzz-on-way-left")?.textContent).toBe("dans 42m 36s");
    expect(row?.querySelector(".optizzz-on-way-when")?.textContent).toBe("arrivée aujourd'hui 17 h 21");
    expect(alone.querySelector<HTMLElement>(".optizzz-attacks-game")?.textContent).toContain("Des renforts arrivent");

    const { rows } = (() => {
      const doc = new DOMParser().parseFromString(armeeS5Html, "text/html");
      const line = new DOMParser().parseFromString(reinforcementsHtml, "text/html").querySelector("h3");
      const block: ChildNode[] = [];
      for (let node = line?.nextSibling ?? null; node; node = node.nextSibling) block.push(node);
      doc.querySelector("#centre > center")?.append(...block.map((node) => doc.importNode(node, true)));
      stops.push(
        renderAttacksOnWay(
          doc,
          () => now,
          () => Promise.resolve(),
        ),
      );
      return { rows: [...doc.querySelectorAll(".optizzz-attacks .optizzz-on-way-row")] };
    })();
    expect(rows.map((r) => r.querySelector(".optizzz-on-way-to")?.textContent)).toEqual([
      "→ Cible_1(TAG)",
      "→ Cible_2",
      "← Renforts",
    ]);
  });

  it("leaves a line it does not read where the game wrote it, such as troops coming home", () => {
    // Markup not yet seen: troops coming home after freeing a colony must not vanish with the attacks.
    const doc = new DOMParser().parseFromString(armeeS5Html, "text/html");
    const back = new DOMParser().parseFromString(
      '- Vos troupes rentrent dans <span class="gras" id="retour_1">1 heure</span><script>reste(3600, "retour_1");</script><br />',
      "text/html",
    ).body;
    doc.querySelector("#centre > center")?.append(...[...back.childNodes].map((node) => doc.importNode(node, true)));
    stops.push(
      renderAttacksOnWay(
        doc,
        () => now,
        () => Promise.resolve(),
      ),
    );
    expect(doc.querySelectorAll(".optizzz-attacks .optizzz-on-way-row")).toHaveLength(2);
    const countdown = doc.querySelector("#retour_1");
    expect(countdown?.closest("[hidden]")).toBeNull();
    expect(countdown?.previousSibling?.textContent).toContain("Vos troupes rentrent");
    expect(doc.querySelector(".optizzz-attacks-game")?.textContent).not.toContain("rentrent");
  });

  it("keeps the game's « Annuler » link in the row of the attack it cancels, while the game offers it", () => {
    const { rows } = setup();
    const cancels = rows.map((row) => row.querySelector<HTMLAnchorElement>(".optizzz-on-way-actions a"));
    expect(cancels.map((link) => link?.getAttribute("href"))).toEqual([undefined, "/Armee.php?annuler=34251"]);
    expect(cancels[1]?.textContent).toBe("Annuler");
    expect(cancels[1]?.closest("[hidden]")).toBeNull();
  });

  it("copies an attack as the game writes it", async () => {
    const { rows, copied } = setup();
    const button = rows[0]?.querySelector("button");
    button?.click();
    await vi.waitFor(() => {
      expect(button?.textContent).toBe("Copié !");
    });
    expect(copied).toEqual([
      "Vous allez attaquer Cible_1(TAG) (Terrain de chasse) dans 3 heures 14 minutes 54 secondes\nTroupes en attaques : 4 047 Jeunes Soldates Naines.\nArrivée à 19h54",
    ]);
  });

  it("draws the list once, and nothing when no attack is on its way", () => {
    const { doc } = setup();
    stops.push(
      renderAttacksOnWay(
        doc,
        () => now,
        () => Promise.resolve(),
      ),
    );
    expect(doc.querySelectorAll(".optizzz-attacks")).toHaveLength(1);
    const empty = new DOMParser().parseFromString("<div id='centre'><h3>Attaque(s) en cours</h3></div>", "text/html");
    renderAttacksOnWay(
      empty,
      () => now,
      () => Promise.resolve(),
    )();
    expect(empty.querySelector(".optizzz-attacks")).toBeNull();
  });

  it("draws the same list on the attack form, where the game writes its attacks the same way", () => {
    // The attack form's page (ennemie.php?Attaquer=…) ends with the same block as Armee.php (relevé S5 2026-10-16).
    const doc = new DOMParser().parseFromString(attackFormHtml, "text/html");
    const armee = new DOMParser().parseFromString(armeeS5Html, "text/html");
    const block: ChildNode[] = [];
    for (let node: ChildNode | null = armee.querySelector("#centre h3"); node; node = node.nextSibling)
      block.push(node);
    doc.querySelector("#centre > center")?.append(...block.map((node) => doc.importNode(node, true)));
    stops.push(
      renderAttacksOnWay(
        doc,
        () => now,
        () => Promise.resolve(),
      ),
    );
    const targets = [...doc.querySelectorAll(".optizzz-attacks .optizzz-on-way-to")].map((to) => to.textContent);
    expect(targets).toEqual(["→ Cible_1(TAG)", "→ Cible_2"]);
    expect(doc.querySelector<HTMLElement>(".optizzz-attacks-game")?.hidden).toBe(true);
    expect(attacksOnWay.matches(new URL("https://s5.fourmizzz.fr/ennemie.php?Attaquer=947&lieu=1"))).toBe(true);
    expect(attacksOnWay.matches(new URL("https://s5.fourmizzz.fr/ennemie.php"))).toBe(false);
  });
});
