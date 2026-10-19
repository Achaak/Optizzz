import { describe, expect, it } from "vitest";
import { stableGain } from "@/game/aphids";
import { readLevelRows } from "@/game/pages/level-rows";
import { costWithRequirements } from "@/game/requirements";
import { aphidsAdvice, aphidsText, mountAphids } from "./aphids";

/** A row as construction.php and laboratoire.php show it (S5, 2026-10-19), the requirement repeated for phones. */
const row = (name: string, level: number, workers: string, food: string, materials: string, requires = "") => `
  <tr class="ligneAmelioration">
    <td class="desciption_amelioration">
      <h2>${name}</h2><span class="niveau_amelioration">niveau ${String(level)}</span>
      ${requires && `<table><tr><td>Requis:</td><td><a class="cliquable3 verificationNonOK">${requires}</a></td></tr></table>`}
      ${requires && `<div class="que_sur_telephone"><a class="verificationNonOK">${requires}</a></div>`}
    </td>
    <td class="cout_amelioration"><table><tr>
      <td><div class="temps">33m 51s</div></td><td><div class="ouvriere">${workers}</div></td>
      <td><div class="nourriture">${food}</div></td><td><div class="materiaux">${materials}</div></td>
    </tr></table></td>
  </tr>`;
const page = (rows: string) => new DOMParser().parseFromString(`<table>${rows}</table>`, "text/html");
const construction = () =>
  page(
    row("Etable à pucerons", 5, "0", "0", "48 000", "Communication avec les animaux niveau 8") +
      row("Laboratoire", 7, "0", "0", "358 400"),
  );
const laboratory = () =>
  page(row("Communication avec les animaux", 7, "10 240", "25 600", "64 000", "Laboratoire niveau 8"));
/** The text with plain spaces: the numbers' are non-breaking. */
const plain = (text: string | null | undefined) => text?.replace(/\u00a0/g, " ");

describe("aphidsAdvice", () => {
  it("costs the next stable level with Communication and the Laboratoire it needs", () => {
    const advice = aphidsAdvice(readLevelRows([construction(), laboratory()]), [100_000, 50_000], null);
    expect(advice).toMatchObject({
      cost: { level: 6, total: 48_000 + 64_000 + 25_600 + 358_400, complete: true },
      gain: { colonies: 2, daily: 72_000 },
      unlockedBy: { name: "Communication avec les animaux", level: 8 },
    });
  });

  it("is unlocked by nothing when the stable needs no research", () => {
    const free = page(row("Etable à pucerons", 5, "0", "0", "48 000"));
    expect(aphidsAdvice(readLevelRows([free]), [], null)?.unlockedBy).toBeNull();
  });

  it("is null without the stable's row", () => {
    expect(aphidsAdvice(readLevelRows([laboratory()]), [], null)).toBeNull();
  });
});

const rows = readLevelRows([construction(), laboratory()]);
const stable = rows.find((candidate) => candidate.name === "Etable à pucerons");
if (!stable) throw new Error("fixture");
const cost = costWithRequirements(stable, rows);
const lead = "Niveau 6 (avec Communication avec les animaux 8 et Laboratoire 8) :";
const text = (colonies: number[] | null, spare: number | null, where: "stable" | "research" = "stable") => {
  const { lead, strong, detail } = aphidsText({ cost, gain: stableGain(5, colonies, spare), unlockedBy: null }, where);
  return { lead, strong: plain(strong), detail: plain(detail) };
};

describe("aphidsText", () => {
  it("says how soon the colonies and the convoys pay the level back", () => {
    expect(text([100_000, 50_000], 9_000)).toEqual({
      lead,
      strong: "remboursé en 7 jours au moins par vos colonies, ou en 111 envois de convoi",
      detail:
        "+72 000 par jour sur vos 2 colonies · +4 500 par envoi avec vos 9 000 ouvrières libres · " +
        "coût 496 000 ressources et 10 240 ouvrières",
    });
  });

  it("speaks of one colony, and of more than a year", () => {
    expect(text([100], null)).toMatchObject({
      strong: "remboursé en plus d'un an par vos colonies",
      detail: expect.stringContaining("+48 par jour sur votre colonie · ") as string,
    });
  });

  it("only speaks of convoys without a colony", () => {
    expect(text([], 9_000)).toMatchObject({
      strong: "remboursé en 111 envois de convoi",
      detail: expect.stringMatching(/^sans colonie · /) as string,
    });
  });

  it("falls back on loot when neither colonies nor convoys pay it back", () => {
    expect(text(null, null)).toEqual({
      lead,
      strong: "ne rapporte qu'au pillage",
      detail:
        "colonies inconnues · 3 076 ouvrières de moins par million envoyé · coût 496 000 ressources et 10 240 ouvrières",
    });
    expect(text([], 0).detail).toContain("aucune ouvrière libre pour les convois");
  });

  it("speaks of both levels from the research", () => {
    expect(text([100_000, 50_000], 1_000_000, "research")).toMatchObject({
      lead: "Débloque Étable à pucerons 6 (avec Laboratoire 8) :",
      strong: "remboursés ensemble en 7 jours au moins par vos colonies, ou en 1 envoi de convoi",
    });
  });
});

describe("mountAphids", () => {
  it("adds the line in the row's description", () => {
    const description = construction().querySelector(".desciption_amelioration");
    if (!description) throw new Error("fixture");
    mountAphids(description, { cost, gain: stableGain(5, [], 9_000), unlockedBy: null }, "stable");
    expect(plain(description.querySelector(".optizzz-aphids")?.textContent)).toBe(
      `Conseil ${lead} remboursé en 111 envois de convoi ` +
        "sans colonie · +4 500 par envoi avec vos 9 000 ouvrières libres · coût 496 000 ressources et 10 240 ouvrières",
    );
  });
});
