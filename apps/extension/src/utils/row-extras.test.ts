import { describe, expect, it } from "vitest";
import { placeInRow } from "./row-extras";

const make = (doc: Document, text: string) => {
  const div = doc.createElement("div");
  div.textContent = text;
  return div;
};

describe("placeInRow", () => {
  it("keeps forecast, advice line, advice block in that order, whoever comes first", () => {
    const doc = document.implementation.createHTMLDocument();
    const description = doc.createElement("td");
    description.append(make(doc, "game"));
    placeInRow(description, "optizzz-advice", make(doc, "block"));
    placeInRow(description, "optizzz-speed-up", make(doc, "line"));
    placeInRow(description, "optizzz-forecast", make(doc, "forecast"));
    expect([...description.children].map((child) => child.textContent)).toEqual(["game", "forecast", "line", "block"]);
  });

  it("replaces the previous one of the same kind, in place", () => {
    const doc = document.implementation.createHTMLDocument();
    const description = doc.createElement("td");
    placeInRow(description, "optizzz-forecast", make(doc, "old"));
    placeInRow(description, "optizzz-advice", make(doc, "block"));
    placeInRow(description, "optizzz-forecast", make(doc, "new"));
    expect([...description.children].map((child) => child.textContent)).toEqual(["new", "block"]);
  });
});
