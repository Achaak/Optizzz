import { describe, expect, it } from "vitest";
import messagerieHtml from "./__fixtures__/messagerie-convoys.html?raw";
import { parseMessageDate, readConvoyMessages } from "./messages";
import { compactNumbersIn } from "@/features/compact-numbers/game-numbers";

// Monday 19 October 2026, Paris time.
const now = new Date(2026, 9, 19, 12, 30);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("parseMessageDate", () => {
  it("reads today's time alone, « hier », a weekday of this week and a day of the month", () => {
    expect(parseMessageDate("05h48", now)).toEqual(new Date(2026, 9, 19, 5, 48));
    expect(parseMessageDate("hier 21h03", now)).toEqual(new Date(2026, 9, 18, 21, 3));
    expect(parseMessageDate("samedi 05h53", now)).toEqual(new Date(2026, 9, 17, 5, 53));
    expect(parseMessageDate("mardi 23h50", now)).toEqual(new Date(2026, 9, 13, 23, 50));
    expect(parseMessageDate("13 octobre 23h50", now)).toEqual(new Date(2026, 9, 13, 23, 50));
  });

  it("takes a day of the month written in early January as last December's", () => {
    expect(parseMessageDate("28 décembre 10h00", new Date(2027, 0, 2, 9, 0))).toEqual(new Date(2026, 11, 28, 10, 0));
  });

  it("returns null for what it cannot read", () => {
    expect(parseMessageDate("", now)).toBeNull();
    expect(parseMessageDate("13 brumaire 10h00", now)).toBeNull();
    expect(parseMessageDate("bientôt", now)).toBeNull();
  });
});

describe("readConvoyMessages", () => {
  it("reads each convoy conversation of the inbox: who, which way, what, when", () => {
    expect(readConvoyMessages(parse(messagerieHtml), now)).toEqual([
      {
        id: 9005,
        direction: "sent",
        player: "Fourmi_Alpha",
        food: 0,
        materials: 381_000,
        at: new Date(2026, 9, 19, 5, 48),
      },
      { id: 9004, direction: "received", player: "Beta-42", food: 2, materials: 1, at: new Date(2026, 9, 19, 2, 16) },
      {
        id: 9002,
        direction: "sent",
        player: "Beta-42",
        food: 0,
        materials: 249_999,
        at: new Date(2026, 9, 18, 21, 3),
      },
      {
        id: 9001,
        direction: "sent",
        player: "Fourmi_Alpha",
        food: 180_000,
        materials: 75_000,
        at: new Date(2026, 9, 14, 22, 19),
      },
      { id: 9000, direction: "sent", player: "Atta", food: 0, materials: 35_000, at: new Date(2026, 9, 12, 6, 35) },
    ]);
  });

  it("tells food from materials by the icon, whatever the order", () => {
    const html = `<table><tr id="conversation_7" class="en_tete_message" data-type="Commerce"><td class="td_objet">
      <span class="message_affiche">05h00</span><a class="intitule_message">Convoi livré à X : 1 200
      <img alt="nourriture"></a></td></tr></table>`;
    expect(readConvoyMessages(parse(html), now)[0]).toMatchObject({ food: 1200, materials: 0 });
  });

  it("skips a conversation it cannot read rather than guessing", () => {
    const html = `<table><tr id="conversation_7" class="en_tete_message" data-type="Commerce"><td class="td_objet">
      <span class="message_affiche">plus tard</span><a class="intitule_message">Convoi livré à X : 1 200
      <img alt="nourriture"></a></td></tr></table>`;
    expect(readConvoyMessages(parse(html), now)).toEqual([]);
    expect(readConvoyMessages(parse("<p>Connexion</p>"), now)).toEqual([]);
  });

  it("reads the same amounts once « Nombres arrondis » has shortened the titles", () => {
    const doc = parse(messagerieHtml);
    const before = readConvoyMessages(doc, now);
    for (const row of doc.querySelectorAll("tr.en_tete_message")) compactNumbersIn(row);
    expect(doc.querySelectorAll(".optizzz-compact").length).toBeGreaterThan(0);
    expect(readConvoyMessages(doc, now)).toEqual(before);
  });
});
