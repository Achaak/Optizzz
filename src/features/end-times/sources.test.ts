import { describe, expect, it } from "vitest";
import constructionFullHtml from "../work-queue/__fixtures__/construction-full.html?raw";
import laboratoryHtml from "../work-queue/__fixtures__/laboratory-one.html?raw";
import noSessionHtml from "./__fixtures__/page-without-session.html?raw";
import reineHtml from "./__fixtures__/reine-laying.html?raw";
import ressourcesHtml from "./__fixtures__/ressources-hunts.html?raw";
import { readSection, sourceOf } from "./sources";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date(2026, 9, 7, 12, 50, 0);
const inSeconds = (seconds: number) => new Date(now.getTime() + seconds * 1000);
// The work-queue fixtures predate the #data header check.
const withHeader = (html: string) => `<div id="data"></div>${html}`;

describe("sourceOf", () => {
  it("knows which page lists what, whatever the case", () => {
    expect(sourceOf("/Ressources.php")).toBe("hunt");
    expect(sourceOf("/Reine.php")).toBe("laying");
    expect(sourceOf("/construction.php")).toBe("construction");
    expect(sourceOf("/laboratoire.php")).toBe("research");
    expect(sourceOf("/Armee.php")).toBeNull();
  });
});

describe("readSection", () => {
  it("reads each hunt with its gain", () => {
    expect(readSection(parse(ressourcesHtml), "hunt", now)).toEqual({
      kind: "hunt",
      readAt: now,
      items: [
        { label: "Chasse 183 cm²", endsAt: inSeconds(1586) },
        { label: "Chasse 1 250 cm²", endsAt: inSeconds(3725) },
      ],
    });
  });

  it("reads the layings in queue order, with their total remaining time", () => {
    expect(readSection(parse(reineHtml), "laying", now)?.items).toEqual([
      { label: "6 Jeunes Soldates Naines", endsAt: inSeconds(261) },
      { label: "100 ouvrières", endsAt: inSeconds(1262) },
      { label: "65 Jeunes Soldates Naines", endsAt: inSeconds(4515) },
    ]);
  });

  it("reads buildings and research from the work queue", () => {
    expect(readSection(parse(withHeader(constructionFullHtml)), "construction", now)?.items).toEqual([
      { label: "Champignonnière 9", endsAt: inSeconds(5121) },
      { label: "Entrepôt de Nourriture 6", endsAt: inSeconds(7008) },
    ]);
    expect(readSection(parse(withHeader(laboratoryHtml)), "research", now)?.items).toEqual([
      { label: "Architecture 1", endsAt: inSeconds(189) },
    ]);
  });

  it("reads an empty list when nothing is in progress", () => {
    expect(readSection(parse('<div id="data"></div><div id="centre"></div>'), "laying", now)?.items).toEqual([]);
  });

  it("reads nothing from a page without the player's header (session expired)", () => {
    expect(readSection(parse(noSessionHtml), "hunt", now)).toBeNull();
  });
});
