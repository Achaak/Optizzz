import { describe, expect, it } from "vitest";
import headerHtml from "../resource-forecast/__fixtures__/header.html?raw";
import { renderConvoyWorkers, type ConvoyWorkers } from "./mount-workers";

const now = new Date(2026, 9, 7, 20, 0);
const at = (hours: number, minutes: number) => new Date(2026, 9, 7, hours, minutes);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const state = (overrides: Partial<ConvoyWorkers> = {}): ConvoyWorkers => ({
  atHome: 4170,
  away: [
    { recipient: "Messor", workers: 1, backAt: at(21, 54) },
    { recipient: "Tetramorium", workers: 1250, backAt: at(23, 5) },
  ],
  readAt: now,
  stale: false,
  aphidsKnown: true,
  ...overrides,
});

const line = (doc: Document) =>
  doc.querySelector(".icone_ouvriere_boite_info")?.closest("td")?.querySelector<HTMLElement>(".optizzz-convoy-workers");

describe("renderConvoyWorkers", () => {
  it("adds the workers carrying convoys to the header's count, with each convoy in the tooltip", () => {
    const doc = parse(headerHtml);
    renderConvoyWorkers(doc, state(), now);
    expect(line(doc)?.textContent).toBe("Total 5 421 · 1 251 en convoi");
    expect(line(doc)?.dataset.optizzzTip).toBe(
      [
        "Ouvrières en convoi, de retour à l'arrivée :",
        "1 → Messor, aujourd'hui 21 h 54",
        "1 250 → Tetramorium, aujourd'hui 23 h 05",
        "Comptées d'après les ressources portées.",
      ].join("\n"),
    );
  });

  it("tells when the count may be off", () => {
    const doc = parse(headerHtml);
    renderConvoyWorkers(doc, state({ aphidsKnown: false, stale: true, readAt: at(13, 36) }), now);
    expect(line(doc)?.dataset.optizzzTip?.split("\n").slice(-2)).toEqual([
      "Étable à pucerons inconnue : ouvrez Construction pour un compte exact.",
      "Convois lus aujourd'hui 13 h 36 : ouvrez Convois pour les revoir.",
    ]);
  });

  it("shows nothing while no convoy is on its way, and redraws without doubling", () => {
    const doc = parse(headerHtml);
    renderConvoyWorkers(doc, state(), now);
    renderConvoyWorkers(doc, state(), now);
    expect(doc.querySelectorAll(".optizzz-convoy-workers")).toHaveLength(1);
    renderConvoyWorkers(doc, state({ away: [] }), now);
    expect(line(doc)).toBeNull();
  });
});
