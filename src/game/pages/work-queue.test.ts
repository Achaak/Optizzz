import { describe, expect, it } from "vitest";
import constructionFullHtml from "@/features/work-queue/__fixtures__/construction-full.html?raw";
import constructionIdleHtml from "@/features/work-queue/__fixtures__/construction-idle.html?raw";
import laboratoryOneHtml from "@/features/work-queue/__fixtures__/laboratory-one.html?raw";
import { readWorkQueue } from "@/game/pages/work-queue";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date(2026, 9, 7, 12, 50, 0);
const inSeconds = (seconds: number) => new Date(now.getTime() + seconds * 1000);

describe("readWorkQueue", () => {
  it("reads queued buildings in order, with their target level and end time", () => {
    const queue = readWorkQueue(parse(constructionFullHtml), now);
    expect(queue.items.map(({ name, targetLevel, endsAt }) => ({ name, targetLevel, endsAt }))).toEqual([
      { name: "Champignonnière", targetLevel: 9, endsAt: inSeconds(5121) },
      { name: "Entrepôt de Nourriture", targetLevel: 6, endsAt: inSeconds(7008) },
    ]);
  });

  it("reads a running research and its cancel link", () => {
    const queue = readWorkQueue(parse(laboratoryOneHtml), now);
    expect(queue.kind).toBe("research");
    expect(queue.items).toMatchObject([
      {
        name: "Architecture",
        targetLevel: 1,
        endsAt: inSeconds(189),
        cancelHref: "laboratoire.php?annuler=1791371169&t=abcd",
      },
    ]);
  });

  it("reads the duration the game now shows for the level after each item", () => {
    const durations = (html: string) => readWorkQueue(parse(html), now).items.map((item) => item.nextLevelDuration);
    expect(durations(constructionFullHtml)).toEqual([(2 * 3600 + 16 * 60) * 1000, (50 * 60 + 20) * 1000]);
    expect(durations(laboratoryOneHtml)).toEqual([(5 * 60 + 40) * 1000]);
  });

  it("sees the queue as full when no row offers to start anything", () => {
    expect(readWorkQueue(parse(constructionFullHtml), now).full).toBe(true);
    expect(readWorkQueue(parse(laboratoryOneHtml), now).full).toBe(false);
  });

  it("reads an empty, not full queue when nothing is in progress", () => {
    expect(readWorkQueue(parse(constructionIdleHtml), now)).toEqual({
      kind: "construction",
      items: [],
      full: false,
    });
  });
});
