import { describe, expect, it } from "vitest";
import queenHtml from "./__fixtures__/reine.html?raw";
import { readLayableUnits, readLockedUnits } from "./queen";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readLayableUnits", () => {
  it("leaves out the units still locked", () => {
    expect(readLayableUnits(parse(queenHtml))).toEqual(["JSN"]);
  });
});

describe("readLockedUnits", () => {
  it("reads each locked unit and what it waits for", () => {
    const locked = readLockedUnits(parse(queenHtml));
    expect(locked.map(({ name, requirements }) => ({ name, requirements }))).toEqual([
      {
        name: "Concierge",
        requirements: [
          { name: "Génétique", level: 5 },
          { name: "Salle de combat", level: 10 },
        ],
      },
    ]);
    expect(locked[0]?.description.matches(".desciption_amelioration")).toBe(true);
  });
});
