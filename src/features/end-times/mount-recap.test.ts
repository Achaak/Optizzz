import { describe, expect, it } from "vitest";
import { mountRecap } from "./mount-recap";
import type { RecapRow } from "./recap";

const now = new Date(2026, 9, 7, 12, 0, 0);
const minutes = (count: number) => new Date(now.getTime() + count * 60_000);

// Left column as observed on s5 (2026-10-07): boxes absolutely placed in the fixed #menuBoite.
const page = (comptePlusRows = "") =>
  new DOMParser().parseFromString(
    `<div id="menuBoite">
      <div id="boiteComptePlus" class="boite_compte_plus" style="top: 200px">
        <div class="titre_colonne_cliquable"><a>Compte +</a></div>
        <div class="contenu_boite_compte_plus">${comptePlusRows || "<div>Publicité</div>"}</div>
      </div>
      <div id="data"></div>
      <div id="boiteInfo" class="boite_info" style="top: 20px"></div>
    </div>`,
    "text/html",
  );

const row = (overrides: Partial<RecapRow>): RecapRow => ({
  kind: "hunt",
  label: "Chasse 183 cm²",
  endsAt: minutes(26),
  done: false,
  queued: 0,
  readAt: now,
  stale: false,
  ...overrides,
});

const lines = (doc: Document) =>
  [...doc.querySelectorAll(".optizzz-recap li")].map((item) =>
    [...item.childNodes]
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(" "),
  );

describe("mountRecap", () => {
  it("lists the rows with their time left, end time and link", () => {
    const doc = page();
    mountRecap(doc)?.render(
      [
        row({}),
        row({ kind: "laying", label: "100 ouvrières", endsAt: minutes(90), queued: 2 }),
        row({ kind: "construction", label: "Couveuse 8", endsAt: minutes(-5), done: true }),
        row({ kind: "research", label: "Armes 3", endsAt: minutes(60), readAt: minutes(-26 * 60), stale: true }),
      ],
      now,
    );
    expect(doc.querySelector(".optizzz-recap .titre_colonne_cliquable")?.textContent).toBe("Prochaines fins");
    expect(lines(doc)).toEqual([
      "🏹 Chasse 183 cm² 26 min · 12 h 26",
      "🥚 100 ouvrières +2 en file 1 h 30 · 13 h 30",
      "🔨 Couveuse 8 terminé",
      "🔬 Armes 3 1 h 00 · 13 h 00 · vu il y a 1 j 2 h",
    ]);
    expect(doc.querySelector<HTMLAnchorElement>(".optizzz-recap li a")?.getAttribute("href")).toBe("Ressources.php");
  });

  it("is hidden with nothing to show, and the Compte+ box goes back to its place", () => {
    const doc = page();
    const recap = mountRecap(doc);
    recap?.render([row({})], now);
    recap?.render([], now);
    expect(doc.querySelector<HTMLElement>(".optizzz-recap")?.hidden).toBe(true);
    expect(doc.querySelector<HTMLElement>("#boiteComptePlus")?.style.top).toBe("200px");
  });

  it("is not shown with Compte+, whose box already lists all this", () => {
    expect(mountRecap(page('<div id="ligne_ponte"></div>'))).toBeNull();
  });
});
