import { describe, expect, it } from "vitest";
import coloniesHtml from "./__fixtures__/colonies.html?raw";
import { readColonies } from "./colonies";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readColonies", () => {
  it("reads my colonies with the troops occupying them, and my master", () => {
    expect(readColonies(parse(coloniesHtml))).toEqual({
      master: "Maitre_1",
      colonies: [
        {
          pseudo: "Colonie_1",
          troops: { JSN: 10 },
          heldFor: (24 * 60 + 42) * 1000,
          brought: { food: 0, materials: 0 },
        },
      ],
    });
  });

  it("reads how long a colony has been held and what it brought, in the game's numbers", () => {
    const doc = parse(coloniesHtml);
    const held = [...doc.querySelectorAll(".caseColonie p")][1];
    if (held)
      held.innerHTML =
        'Cette colonie vous appartient depuis 3j 4h 10m 2s <br> Elle vous a rapporté <span class="sur_une_ligne">1 234 567</span> nourriture et <span class="sur_une_ligne">89 012</span> matériaux';
    expect(readColonies(doc).colonies[0]).toMatchObject({
      heldFor: ((3 * 24 + 4) * 3600 + 10 * 60 + 2) * 1000,
      brought: { food: 1_234_567, materials: 89_012 },
    });
  });

  it("leaves the time held and what it brought unknown when the page does not say them", () => {
    const doc = parse(coloniesHtml);
    [...doc.querySelectorAll(".caseColonie p")][1]?.remove();
    expect(readColonies(doc).colonies[0]).toMatchObject({ heldFor: null, brought: null });
  });

  it("reads several units, one per line", () => {
    const doc = parse(coloniesHtml);
    const troops = doc.querySelector(".caseColonie p");
    const line = [...(troops?.childNodes ?? [])].find((node) => node.textContent?.includes("10 Jeunes"));
    line?.after(doc.createElement("br"), doc.createTextNode("1 200 Soldates Naines"));
    expect(readColonies(doc).colonies[0]?.troops).toEqual({ JSN: 10, SN: 1200 });
  });

  it("is free and without colony on an empty page", () => {
    expect(readColonies(parse("<div id='centre'><div class='Bas'></div></div>"))).toEqual({
      master: null,
      colonies: [],
    });
  });
});
