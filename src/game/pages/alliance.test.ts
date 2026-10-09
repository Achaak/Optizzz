import { describe, expect, it } from "vitest";
import laboratoryHtml from "@/features/alliance-map/__fixtures__/laboratory.html?raw";
import membersHtml from "@/features/alliance-map/__fixtures__/members.html?raw";
import { readLevels } from "@/data/levels";
import { readAllianceTag, readLoggedInPseudo, readMembersHuntingField } from "@/game/pages/alliance";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("members page", () => {
  it("reads each member's hunting field, by nickname", () => {
    expect(readMembersHuntingField(parse(membersHtml))).toEqual(
      new Map([
        ["Alpha", 8691],
        ["Me", 3778],
        ["Gros", 1234567],
      ]),
    );
  });

  it("returns an empty map outside the members page", () => {
    expect(readMembersHuntingField(parse(laboratoryHtml)).size).toBe(0);
  });
});

describe("header", () => {
  it("reads the logged-in player's nickname", () => {
    expect(readLoggedInPseudo(parse(membersHtml))).toBe("Me");
  });

  it("reads the player's alliance tag, none outside an alliance", () => {
    expect(readAllianceTag(parse(`<div id="data"><span id="tag_alliance">TAG</span></div>`))).toBe("TAG");
    expect(readAllianceTag(parse(`<div id="data"><span id="tag_alliance"> </span></div>`))).toBeNull();
    expect(readAllianceTag(parse(`<div id="data"></div>`))).toBeNull();
  });
});

describe("laboratory page", () => {
  it("is read by game-levels, the single reader of research levels", () => {
    expect(readLevels(parse(laboratoryHtml)).attackSpeed).toBe(7);
    expect(readLevels(parse(membersHtml)).attackSpeed).toBeUndefined();
  });
});
