import { describe, expect, it } from "vitest";
import profileHtml from "@optizzz/game/pages/__fixtures__/profile.html?raw";
import {
  coloniesText,
  COLONIES_ROW_ATTRIBUTE,
  mountColoniesRow,
  mountProductionRow,
  PRODUCTION_ROW_ATTRIBUTE,
  productionText,
} from "./mount";

const profile = () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = profileHtml;
  return doc;
};

describe("productionText", () => {
  it("gives the whole harvest of a free anthill", () => {
    expect(productionText(1_206_299, { kind: "none" })).toMatchObject({
      value: "≈ 57 902 352",
      detail: null,
    });
  });

  it("takes off a known colony tax", () => {
    expect(productionText(1_206_299, { kind: "known", rate: 0.33 })).toMatchObject({
      value: "≈ 38 794 576",
      detail: "taxe de 33 % déduite, 57 902 352 avant",
    });
  });

  it("gives an upper bound when the master's aphid stable is unknown", () => {
    const { value, detail, title } = productionText(1_206_299, { kind: "atLeast" });
    expect(value).toBe("≤ 46 321 882");
    expect(detail).toBe("taxe d'au moins 20 % déduite, 57 902 352 avant");
    expect(title).toContain("Étable à pucerons");
  });
});

describe("mountProductionRow", () => {
  it("adds the row just after « Etat », aligned as the game's labels", () => {
    const doc = profile();
    mountProductionRow(doc, 1_206_299, { kind: "none" });
    const row = doc.querySelector<HTMLTableRowElement>(`tr[${PRODUCTION_ROW_ATTRIBUTE}]`);
    expect(row?.previousElementSibling?.textContent).toContain("Etat");
    expect(row?.cells[0]?.style.textAlign).toBe("right");
    expect(row?.cells[1]?.querySelector("strong")?.textContent).toBe("≈ 57 902 352");
    expect(row?.cells[1]?.textContent).toBe("≈ 57 902 352 par jour");
    expect(row?.querySelector(".optizzz-production-detail")).toBeNull();
  });

  it("updates the row instead of adding a second one", () => {
    const doc = profile();
    mountProductionRow(doc, 1_206_299, { kind: "atLeast" });
    mountProductionRow(doc, 1_206_299, { kind: "known", rate: 0.25 });
    const rows = doc.querySelectorAll(`tr[${PRODUCTION_ROW_ATTRIBUTE}]`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector(".optizzz-production-detail")?.textContent).toBe(
      "(taxe de 25 % déduite, 57 902 352 avant)",
    );
  });
});

describe("coloniesText", () => {
  it("adds up what the colonies pay, at least 20 % of their ceiling when the stable is unknown", () => {
    expect(coloniesText([{ field: 60_495, rate: null }])).toMatchObject({
      value: "≥ 580 752",
      detail: "1 colonie, sur son TDC du dernier export",
    });
  });

  it("is exact when every rate is known", () => {
    expect(
      coloniesText([
        { field: 1000, rate: 0.25 },
        { field: 2000, rate: 0.25 },
      ]),
    ).toMatchObject({ value: "≈ 36 000", detail: "2 colonies, sur leur TDC du dernier export" });
  });
});

describe("mountColoniesRow", () => {
  it("adds the row after the production row", () => {
    const doc = profile();
    mountProductionRow(doc, 1_206_299, { kind: "none" });
    mountColoniesRow(doc, [{ field: 1000, rate: null }]);
    mountColoniesRow(doc, [{ field: 1000, rate: null }]);
    const rows = doc.querySelectorAll(`tr[${COLONIES_ROW_ATTRIBUTE}]`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.previousElementSibling?.hasAttribute(PRODUCTION_ROW_ATTRIBUTE)).toBe(true);
    expect(rows[0]?.textContent).toContain("≥ 9 600 par jour");
  });

  it("adds nothing without colonies", () => {
    const doc = profile();
    mountProductionRow(doc, 1_206_299, { kind: "none" });
    mountColoniesRow(doc, []);
    expect(doc.querySelector(`tr[${COLONIES_ROW_ATTRIBUTE}]`)).toBeNull();
  });
});
