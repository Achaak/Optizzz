import { describe, expect, it } from "vitest";
import coloniesHtml from "./__fixtures__/colonies.html?raw";
import { readColonies } from "./colonies";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readColonies", () => {
  it("reads my colonies with the troops occupying them, and my master", () => {
    expect(readColonies(parse(coloniesHtml))).toEqual({
      master: "Maitre_1",
      colonies: [{ pseudo: "Colonie_1", troops: { JSN: 10 } }],
    });
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
