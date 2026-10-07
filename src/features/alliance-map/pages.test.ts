import { describe, expect, it } from "vitest";
import laboratoryHtml from "./__fixtures__/laboratory.html?raw";
import membersHtml from "./__fixtures__/members.html?raw";
import { readAttackSpeedLevel, readLoggedInPseudo, readMembersHuntingField } from "./pages";

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
});

describe("laboratory page", () => {
  it("reads the Attack Speed level", () => {
    expect(readAttackSpeedLevel(parse(laboratoryHtml))).toBe(7);
  });

  it("returns null when the research is missing", () => {
    expect(readAttackSpeedLevel(parse(membersHtml))).toBeNull();
  });
});
