import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
} from "@/data/launches";

const ORIGIN = "https://s5.fourmizzz.fr";
const at = (hour: number, minute = 0) => new Date(2026, 9, 8, hour, minute);
const launch = (target: string, arrivesAt: Date) => ({ targetId: 7, target, ants: 100, take: 100, arrivesAt });

// Writes drop the launches arrived by the real clock: pin it before the dates used here.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(9));
});
afterEach(() => vi.useRealTimers());

describe("launches", () => {
  beforeEach(() => fakeBrowser.reset());

  it("remembers the attacks on their way and forgets them once arrived", async () => {
    await recordLaunch(ORIGIN, launch("Cible", at(10, 30)));
    await recordLaunch(ORIGIN, launch("Cible", at(12)));
    expect((await loadLaunches(ORIGIN, at(11))).map((sent) => sent.arrivesAt)).toEqual([at(12)]);
  });

  it("does not write when read", async () => {
    await recordLaunch(ORIGIN, launch("Cible", at(10, 30)));
    const set = vi.spyOn(fakeBrowser.storage.local, "set");
    await loadLaunches(ORIGIN, at(11));
    expect(set).not.toHaveBeenCalled();
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

  it("keeps the queue when storing fails", async () => {
    queueLaunch(sessionStorage, launch("Cible", at(12)));
    vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("quota"));
    await expect(flushQueuedLaunches(sessionStorage, ORIGIN)).rejects.toThrow("quota");
    expect(sessionStorage.getItem("optizzz-flood-queue")).not.toBeNull();
    await flushQueuedLaunches(sessionStorage, ORIGIN);
    expect(await loadLaunches(ORIGIN, at(11))).toEqual([launch("Cible", at(12))]);
  });

  const stored = (target: string, arrivesAt: Date) => ({
    ...launch(target, arrivesAt),
    arrivesAt: arrivesAt.getTime(),
  });

  it("ignores entries that are not launches", async () => {
    sessionStorage.setItem(
      "optizzz-flood-queue",
      JSON.stringify([{ targetId: "x" }, 5, null, stored("Cible", at(12))]),
    );
    await flushQueuedLaunches(sessionStorage, ORIGIN);
    expect(await loadLaunches(ORIGIN, at(11))).toEqual([launch("Cible", at(12))]);
  });

  it("ignores a queue that is not a list", async () => {
    sessionStorage.setItem("optizzz-flood-queue", '{"a":1}');
    await expect(flushQueuedLaunches(sessionStorage, ORIGIN)).resolves.toBeUndefined();
    expect(await loadLaunches(ORIGIN, at(11))).toEqual([]);
  });

  it("keeps at most 20 queued launches", async () => {
    sessionStorage.setItem(
      "optizzz-flood-queue",
      JSON.stringify(Array.from({ length: 25 }, () => stored("Cible", at(12)))),
    );
    await flushQueuedLaunches(sessionStorage, ORIGIN);
    expect(await loadLaunches(ORIGIN, at(11))).toHaveLength(20);
  });

  it("ignores a launch arriving more than 30 days ahead", async () => {
    const far = new Date(at(9).getTime() + 31 * 24 * 60 * 60_000);
    sessionStorage.setItem("optizzz-flood-queue", JSON.stringify([stored("Cible", at(12)), stored("Loin", far)]));
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
