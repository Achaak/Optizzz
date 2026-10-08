import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { armyFromKeys } from "@/game/army/units";
import {
  clearDefense,
  flushQueuedLaunches,
  loadDefense,
  loadDefenses,
  loadLaunches,
  queueLaunch,
  recordLaunch,
  saveDefense,
} from "./store";

const ORIGIN = "https://s5.fourmizzz.fr";
const at = (hour: number, minute = 0) => new Date(2026, 9, 8, hour, minute);
const launch = (target: string, arrivesAt: Date) => ({ targetId: 7, target, ants: 100, take: 100, arrivesAt });

describe("launches", () => {
  beforeEach(() => fakeBrowser.reset());

  it("remembers the attacks on their way and forgets them once arrived", async () => {
    await recordLaunch(ORIGIN, launch("Cible", at(10, 30)));
    await recordLaunch(ORIGIN, launch("Cible", at(12)));
    expect((await loadLaunches(ORIGIN, at(11))).map((sent) => sent.arrivesAt)).toEqual([at(12)]);
  });

  it("keeps one list per server", async () => {
    await recordLaunch(ORIGIN, launch("Cible", at(12)));
    expect(await loadLaunches("http://s2.fourmizzz.fr", at(11))).toEqual([]);
  });
});

describe("queued launches", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    sessionStorage.clear();
  });

  it("keeps a launch through the page change, then moves it to the extension's storage", async () => {
    queueLaunch(sessionStorage, launch("Cible", at(12)));
    await flushQueuedLaunches(sessionStorage, ORIGIN);
    await flushQueuedLaunches(sessionStorage, ORIGIN);
    expect(await loadLaunches(ORIGIN, at(11))).toEqual([launch("Cible", at(12))]);
  });
});

describe("defenses", () => {
  beforeEach(() => fakeBrowser.reset());

  it("remembers the army pasted for a target, with its date, until cleared", async () => {
    const army = armyFromKeys({ JSN: 100 });
    await saveDefense(ORIGIN, 7, army, at(9));
    expect(await loadDefense(ORIGIN, 7)).toEqual({ army, readAt: at(9) });
    expect(await loadDefense(ORIGIN, 8)).toBeNull();
    await clearDefense(ORIGIN, 7);
    expect(await loadDefense(ORIGIN, 7)).toBeNull();
  });

  it("lists every army remembered, by target", async () => {
    await saveDefense(ORIGIN, 7, armyFromKeys({ JSN: 100 }), at(9));
    await saveDefense(ORIGIN, 8, armyFromKeys({ S: 3 }), at(9));
    expect(await loadDefenses(ORIGIN)).toEqual(
      new Map([
        [7, armyFromKeys({ JSN: 100 })],
        [8, armyFromKeys({ S: 3 })],
      ]),
    );
  });
});
