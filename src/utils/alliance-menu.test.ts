import { describe, expect, it } from "vitest";
import { addAllianceMenuEntry, addColonyMenuEntry } from "./alliance-menu";

const ICON = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;

function menu() {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = `<ul id="menuAlliance"><li><a class="boutonMembres">Membres</a></li><li><a>Forum</a></li></ul>`;
  return doc;
}

const labels = (doc: Document) => [...doc.querySelectorAll("#menuAlliance a")].map((a) => a.textContent);

describe("addAllianceMenuEntry", () => {
  it("keeps the Optizzz entries in order after Membres, whichever are on", () => {
    const doc = menu();
    addAllianceMenuEntry(doc, { className: "optizzz-history", href: "#h", label: "Historique", icon: ICON });
    addAllianceMenuEntry(doc, { className: "optizzz-alliance-map", href: "#c", label: "Carte", icon: ICON });
    expect(labels(doc)).toEqual(["Membres", "Carte", "Historique", "Forum"]);
  });

  it("adds an entry only once", () => {
    const doc = menu();
    const entry = { className: "optizzz-tdc-chain", href: "#ch", label: "Chaîne", icon: ICON } as const;
    addAllianceMenuEntry(doc, entry);
    addAllianceMenuEntry(doc, entry);
    expect(labels(doc)).toEqual(["Membres", "Chaîne", "Forum"]);
  });

  it("puts the Partage entry after Historique", () => {
    const doc = menu();
    addAllianceMenuEntry(doc, { className: "optizzz-alliance-sharing", href: "#p", label: "Partage", icon: ICON });
    addAllianceMenuEntry(doc, { className: "optizzz-history", href: "#h", label: "Historique", icon: ICON });
    expect(labels(doc)).toEqual(["Membres", "Historique", "Partage", "Forum"]);
  });
});

describe("addColonyMenuEntry", () => {
  it("adds the entry once to the Fourmilière menu, after « Ma Fourmilière »", () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `<ul id="menuFourmiliere"><li><a class="boutonArmee">Armée</a></li><li><a class="boutonMaFourmiliere">Ma Fourmilière</a></li></ul>`;
    const entry = { className: "optizzz-my-state", href: "#e", label: "Mon état", icon: ICON } as const;
    addColonyMenuEntry(doc, entry);
    addColonyMenuEntry(doc, entry);
    expect([...doc.querySelectorAll("#menuFourmiliere a")].map((a) => a.textContent)).toEqual([
      "Armée",
      "Ma Fourmilière",
      "Mon état",
    ]);
  });
});
