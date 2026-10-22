import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape-html";

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
