import { describe, expect, it } from "vitest";
import membersHtml from "../alliance-map/__fixtures__/members.html?raw";
import constructionHtml from "../resource-forecast/__fixtures__/construction-costs.html?raw";
import huntHtml from "../hunt-reports/__fixtures__/conversation.html?raw";
import { readConversation } from "../hunt-reports/report";
import ressourcesHtml from "../resource-forecast/__fixtures__/ressources-colonized.html?raw";
import { compactGameNumbers, compactNumbersIn, compactReports, zonesOf } from "./game-numbers";
import combatHtml from "@/game/pages/__fixtures__/combat-conversations.html?raw";
import { readMembersHuntingField } from "@/game/pages/alliance";
import { readCombatConversation } from "@/game/pages/combat-reports";
import { readCosts, readIncome, readStock } from "@/game/pages/resources";
import { readMembersScores } from "@/game/pages/scores";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const shown = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>(".optizzz-compact")].map((span) => span.dataset.compact);

const box = (html: string) => {
  const doc = parse(`<div id="centre">${html}</div>`);
  const root = doc.querySelector("#centre");
  if (!root) throw new Error("no root");
  return { doc, root };
};

describe("zonesOf", () => {
  it("adds the header to the page's own zones", () => {
    expect(zonesOf(new URL("http://s5.fourmizzz.fr/Armee.php"))).toEqual([".texte_ligne_boite_info", "#centre"]);
  });

  it("keeps the alliance members, not the chat or the forum", () => {
    expect(zonesOf(new URL("http://s5.fourmizzz.fr/alliance.php?Membres"))).toContain("#centre");
    expect(zonesOf(new URL("http://s5.fourmizzz.fr/alliance.php"))).toEqual([".texte_ligne_boite_info"]);
    expect(zonesOf(new URL("http://s5.fourmizzz.fr/messagerie.php"))).toEqual([".texte_ligne_boite_info"]);
  });
});

describe("compactNumbersIn", () => {
  it("shortens the game's numbers from 10 000 on, the exact one on hover", () => {
    const { root } = box("<p>Vous avez <strong>1 234 567</strong> fourmis et 9 999 ouvrières.</p>");
    compactNumbersIn(root);
    expect(shown(root)).toEqual(["1,23M"]);
    expect(root.querySelector<HTMLElement>(".optizzz-compact")?.title).toBe("1 234 567");
  });

  it("leaves the text the game and Optizzz read unchanged", () => {
    const { root } = box("<td>Troupes : 2 023 150 JSN, 485 SN, 16 185 200 vie</td>");
    const before = root.textContent;
    compactNumbersIn(root);
    expect(shown(root)).toEqual(["2,02M", "16,2M"]);
    expect(root.textContent).toBe(before);
  });

  it("puts the exact value in front of a tooltip the game already shows", () => {
    const { root } = box(`<a title="Entrepôt rempli à 7%"><div>208 302 916</div></a>`);
    compactNumbersIn(root);
    expect(root.querySelector("a")?.title).toBe("208 302 916 · Entrepôt rempli à 7%");
    expect(root.querySelector<HTMLElement>(".optizzz-compact")?.title).toBe("");
  });

  it("skips fields, what the game's scripts read back, descriptions and Optizzz's own additions", () => {
    const { root } = box(`
      <input value="12 345"><span id="cout_nourriture1">12 345</span>
      <div class="contenuJoueur">Rejoignez-nous, 50 000 cm² !</div>
      <div class="optizzz-note">12 345</div>`);
    compactNumbersIn(root);
    expect(shown(root)).toEqual([]);
  });

  it("keeps a game row that Optizzz only marked", () => {
    const { root } = box(`<table><tr class="alt optizzz-members-me"><td>108 966</td></tr></table>`);
    compactNumbersIn(root);
    expect(shown(root)).toEqual(["109K"]);
  });

  it("ignores decimals, numbers glued to words and raw numbers without separators", () => {
    const { root } = box("<p>1 234,5 · lasius12 345 · 307169 · x=21 et y=745</p>");
    compactNumbersIn(root);
    expect(shown(root)).toEqual([]);
  });

  it("does nothing on a second pass", () => {
    const { root } = box("<p>12 345</p>");
    compactNumbersIn(root);
    compactNumbersIn(root);
    expect(shown(root)).toEqual(["12,3K"]);
    expect(root.querySelectorAll(".optizzz-compact-full")).toHaveLength(1);
  });
});

describe("compactGameNumbers", () => {
  it("keeps the Ressources page readable by Optizzz", () => {
    const doc = parse(ressourcesHtml);
    const now = new Date(2026, 9, 19, 12, 0);
    const read = () => [readStock(doc), readIncome(doc, now)];
    const before = read();
    compactGameNumbers(doc, new URL("http://s5.fourmizzz.fr/Ressources.php"));
    expect(shown(doc).length).toBeGreaterThan(0);
    expect(read()).toEqual(before);
  });

  it("shortens the costs of Construction", () => {
    const doc = parse(constructionHtml);
    const before = readCosts(doc);
    compactGameNumbers(doc, new URL("http://s5.fourmizzz.fr/construction.php"));
    expect(shown(doc)).toContain("38,4K");
    expect(readCosts(doc)).toEqual(before);
  });

  it("keeps the alliance members readable by Optizzz", () => {
    const doc = parse(membersHtml);
    const read = () => [readMembersHuntingField(doc), readMembersScores(doc)];
    const before = read();
    compactGameNumbers(doc, new URL("http://s5.fourmizzz.fr/alliance.php?Membres"));
    expect(shown(doc)).toContain("1,23M");
    expect(read()).toEqual(before);
  });
});

describe("compactReports", () => {
  const MESSAGERIE = new URL("http://s5.fourmizzz.fr/messagerie.php");
  const details = (doc: Document) => [...doc.querySelectorAll("tr.contenu_conversation")];

  it("shortens the attack reports, which Optizzz still reads the same", () => {
    const doc = parse(combatHtml);
    const read = () => details(doc).map((conversation) => readCombatConversation(conversation));
    const before = read();
    compactReports(doc);
    expect(shown(doc)).toEqual(expect.arrayContaining(["1,59M", "4,93M", "19,2K", "28,9K"]));
    expect(read()).toEqual(before);
  });

  it("shortens the hunt reports, which Optizzz still reads the same", () => {
    const doc = parse(huntHtml.replaceAll("1 975 Jeunes", "21 975 Jeunes"));
    const read = () => details(doc).map((conversation) => readConversation(conversation));
    const before = read();
    compactReports(doc);
    expect(shown(doc)).toContain("22K");
    expect(read()).toEqual(before);
  });

  it("never touches what players write", () => {
    const doc = parse(`<table>
      <tr class="en_tete_message" data-type="Conversations"><td class="td_objet">Rendez-vous à 15 000 cm²</td></tr>
      <tr class="contenu_conversation"><td><div class="contenuJoueur">J'envoie 250 000 demain</div></td></tr>
      <tr class="en_tete_message" data-type="Alliance"><td class="td_objet">Objectif 2 000 000</td></tr>
      <tr class="en_tete_message" data-type="Combats"><td class="td_objet">Butin chez X : 16 044 cm²</td></tr>
    </table>`);
    compactReports(doc);
    expect(shown(doc)).toEqual(["16K"]);
  });

  it("shortens a report the player opens later (loaded by the game in AJAX)", async () => {
    const doc = parse(`<div id="centre"><table><tbody>
      <tr class="en_tete_message" data-type="Combats"><td class="td_objet">Attaque réussie</td></tr>
    </tbody></table></div>`);
    compactGameNumbers(doc, MESSAGERIE);
    const detail = doc.createElement("tr");
    detail.className = "contenu_conversation";
    detail.innerHTML =
      '<td><div class="contenuJoueur">Vous infligez <strong>1 589 060 (+ 4 926 086)</strong></div></td>';
    doc.querySelector("tr.en_tete_message")?.after(detail);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(shown(doc)).toEqual(["1,59M", "4,93M"]);
  });
});
