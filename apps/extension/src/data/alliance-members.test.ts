import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import membersHtml from "@optizzz/game/pages/__fixtures__/members.html?raw";
import { loadAllianceMembers, readAllianceMembers, storeAllianceMembers } from "./alliance-members";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const READ_AT = new Date("2026-10-24T12:00:00Z");

beforeEach(() => {
  fakeBrowser.reset();
});

describe("alliance members", () => {
  it("reads the members of the Members page, with the alliance's tag when the page has it", () => {
    const doc = parse(membersHtml.concat('<div id="data"><span id="tag_alliance">TAG</span></div>'));
    expect(readAllianceMembers(doc, READ_AT)).toEqual({
      tag: "TAG",
      pseudos: ["Alpha", "Me", "Gros"],
      readAt: READ_AT,
    });
  });

  it("reads nothing on another page", () => {
    expect(readAllianceMembers(parse("<p>Reine</p>"), READ_AT)).toBeNull();
  });

  it("keeps the last list per server, with its date", async () => {
    const members = { tag: "TAG", pseudos: ["Alpha"], readAt: READ_AT };
    await storeAllianceMembers("https://s5.fourmizzz.fr", members);
    expect(await loadAllianceMembers("https://s5.fourmizzz.fr")).toEqual(members);
    expect(await loadAllianceMembers("http://s2.fourmizzz.fr")).toBeNull();
  });
});
