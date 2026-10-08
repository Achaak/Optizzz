import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readMembersScores, readProfile } from "@/game/pages/scores";

const load = (path: string) => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = readFileSync(new URL(path, import.meta.url), "utf8");
  return doc;
};

describe("readProfile", () => {
  it("reads the nickname and the live scores of the profile", () => {
    expect(readProfile(load("../../features/history/__fixtures__/profile.html"))).toEqual({
      pseudo: "Autre",
      scores: { field: 1206299, building: 39, technology: 20, trophy: 4 },
    });
  });

  it("leaves out a score whose row is missing, instead of reading 0", () => {
    const doc = load("../../features/history/__fixtures__/profile.html");
    const combat = [...doc.querySelectorAll(".tableau_score tr")].find((row) => row.textContent.includes("Combat"));
    combat?.remove();
    expect(readProfile(doc)?.scores).toEqual({ field: 1206299, building: 39, technology: 20 });
  });

  it("is null on a page without a scores table", () => {
    expect(readProfile(load("../../features/alliance-map/__fixtures__/members.html"))).toBeNull();
  });
});

describe("readMembersScores", () => {
  it("reads each member's field, technology and building, by nickname", () => {
    const scores = readMembersScores(load("../../features/alliance-map/__fixtures__/members.html"));
    expect(scores.get("Alpha")).toEqual({ field: 8691, technology: 19, building: 47 });
    expect(scores.get("Gros")?.field).toBe(1234567);
  });
});
