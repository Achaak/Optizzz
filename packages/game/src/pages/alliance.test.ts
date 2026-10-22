import { describe, expect, it } from "vitest";
import laboratoryHtml from "./__fixtures__/laboratory-alliance.html?raw";
import membersHtml from "./__fixtures__/members.html?raw";
import { readAllianceTag, readLoggedInPseudo, readMembersHuntingField } from "./alliance";

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
