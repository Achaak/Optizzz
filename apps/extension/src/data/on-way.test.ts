import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import armeeHtml from "@/features/flood/__fixtures__/armee-attacks.html?raw";
import { loadLaunches, recordLaunch } from "@/data/launches";
import { afterOnWay, checkLaunches } from "@/data/on-way";
import { fetchGamePage } from "@/utils/game-page";

vi.mock("@/utils/game-page", () => ({ fetchGamePage: vi.fn() }));

const ORIGIN = "https://s5.fourmizzz.fr";
const now = new Date(2026, 9, 8, 10, 0, 0);
const at = (minutes: number, seconds = 0) => new Date(now.getTime() + (minutes * 60 + seconds) * 1000);
const sent = (target: string, arrivesAt: Date, targetId = 1) => ({ targetId, target, ants: 100, take: 100, arrivesAt });
const parse = () => new DOMParser().parseFromString(armeeHtml, "text/html");

const launch = (targetId: number, take: number) => ({
  targetId,
  target: `Cible_${String(targetId)}`,
  ants: take,
  take,
  arrivesAt: new Date(2026, 9, 8, 12, 0),
});

describe("checkLaunches", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it("drops a launch the game no longer lists", async () => {
    await recordLaunch(ORIGIN, sent("Cible_1", at(9, 7)));
    await recordLaunch(ORIGIN, sent("Absente", at(30), 3));
    const checked = await checkLaunches(ORIGIN, now, parse());
    expect(checked.launches.map((kept) => kept.target)).toEqual(["Cible_1"]);
    expect((await loadLaunches(ORIGIN, now)).map((kept) => kept.target)).toEqual(["Cible_1"]);
  });

  it("keeps a launch recorded while the page was being read", async () => {
    await recordLaunch(ORIGIN, sent("Cible_1", at(9, 7)));
    vi.mocked(fetchGamePage).mockImplementationOnce(async () => {
      await recordLaunch(ORIGIN, sent("Autre", at(40), 5));
      return parse();
    });
    await checkLaunches(ORIGIN, now);
    expect((await loadLaunches(ORIGIN, now)).map((kept) => kept.target)).toEqual(["Cible_1", "Autre"]);
  });
});

describe("afterOnWay", () => {
  it("adds every take on its way to my field, removes this target's, and counts every attack as a slot", () => {
    const onWay = { launches: [launch(1, 200), launch(2, 100)], unknown: 1 };
    expect(afterOnWay(1000, { id: 1, field: 2000 }, onWay, 3)).toEqual({
      myField: 1300,
      targetField: 1800,
      slots: 1,
      onTarget: 1,
    });
  });
});
