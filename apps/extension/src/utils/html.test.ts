import { describe, expect, it } from "vitest";
import { escapeHtml, htmlElement, svgElement } from "./html";

describe("htmlElement", () => {
  it("builds the root element of a static template, with its content", () => {
    const table = htmlElement(
      document,
      "table",
      `<table class="report"><thead><tr><th>Heure</th></tr></thead><tbody></tbody></table>`,
    );
    expect(table).toBeInstanceOf(HTMLTableElement);
    expect(table.className).toBe("report");
    expect(table.querySelector("thead th")?.textContent).toBe("Heure");
    expect(table.ownerDocument).toBe(document);
  });

  it("rejects a template whose root is not the expected element", () => {
    expect(() => htmlElement(document, "div", "just text")).toThrow();
    expect(() => htmlElement(document, "div", "<span></span>")).toThrow();
  });
});

describe("svgElement", () => {
  it("builds an SVG element usable in the page", () => {
    const svg = svgElement(
      document,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle r="3"/></svg>`,
    );
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.querySelector("circle")).not.toBeNull();
    expect(svg.ownerDocument).toBe(document);
  });
});

describe("escapeHtml", () => {
  it("replaces each markup character with a numeric entity", () => {
    expect(escapeHtml("&")).toBe("&#38;");
    expect(escapeHtml("<")).toBe("&#60;");
    expect(escapeHtml(">")).toBe("&#62;");
    expect(escapeHtml('"')).toBe("&#34;");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("leaves plain text, accents included, unchanged", () => {
    expect(escapeHtml("Fourmi élite 42")).toBe("Fourmi élite 42");
  });
});
