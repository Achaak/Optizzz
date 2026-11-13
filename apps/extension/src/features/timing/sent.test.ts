import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { storage } from "wxt/utils/storage";
import armeeS5Html from "../flood/__fixtures__/armee-attacks-s5.html?raw";
import { renderAttacksOnWay } from "../attacks-on-way/mount";
import { checkTimedLaunches, labelTimedAttacks, loadTimedAttacks, queueTimedLaunch } from "./sent";

const origin = "https://s5.fourmizzz.fr";
// The page is read at 08:00:59 on the server: Cible_1's attack (reste 11700) arrives at 11:15:59 (10:15:59 UTC).
const serverDate = Date.parse("2026-11-04T07:00:59Z");
const arrival = Date.parse("2026-11-04T10:15:59Z");
const clock = { offsetMs: 0, errorMs: 200, oneWayMs: 100 };

function fakeIo(pc = Date.parse("2026-11-04T07:00:58.500Z")) {
  const waits: number[] = [];
  const urls: string[] = [];
  return {
    waits,
    urls,
    now: () => pc,
    wait: (ms: number) => {
      waits.push(ms);
      pc += ms;
      return Promise.resolve();
    },
    fetch: (url: string) => {
      urls.push(url);
      return Promise.resolve(
        new Response(armeeS5Html, {
          headers: { date: new Date(serverDate).toUTCString(), "content-type": "text/html" },
        }),
      );
    },
  };
}

const armee = () => new DOMParser().parseFromString(armeeS5Html, "text/html");

describe("checkTimedLaunches", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    sessionStorage.clear();
  });

  it("reads Armee.php once, at the start of a server second, and keeps the exact arrival of the attack", async () => {
    queueTimedLaunch(sessionStorage, { target: "Cible_1", aimedAt: arrival, clock, sentAt: serverDate - 2000 });
    const io = fakeIo();
    await checkTimedLaunches(origin, sessionStorage, io);
    // PC 58.500 + 100 ms on the way → 58.600 at the server: wait 600 ms to land at 59.200.
    expect(io.waits).toEqual([600]);
    expect(io.urls).toEqual(["/Armee.php"]);
    expect(await loadTimedAttacks(origin, serverDate)).toEqual([
      { attackId: 34250, aimedAt: arrival, arrivesAt: arrival },
    ]);
    // Done: no second reading.
    await checkTimedLaunches(origin, sessionStorage, io);
    expect(io.urls).toHaveLength(1);
  });

  it("reads nothing when no timed attack was sent", async () => {
    const io = fakeIo();
    await checkTimedLaunches(origin, sessionStorage, io);
    expect(io.urls).toEqual([]);
  });

  it("forgets a launch the game does not list after two minutes (refused or cancelled)", async () => {
    queueTimedLaunch(sessionStorage, { target: "Absent", aimedAt: arrival, clock, sentAt: serverDate - 2000 });
    await checkTimedLaunches(origin, sessionStorage, fakeIo());
    const later = fakeIo(serverDate + 3 * 60_000);
    await checkTimedLaunches(origin, sessionStorage, later);
    await checkTimedLaunches(origin, sessionStorage, later);
    expect(later.urls).toHaveLength(1);
    expect(await loadTimedAttacks(origin, serverDate)).toEqual([]);
  });

  it("reads nothing when what the page left is not a timed launch", async () => {
    sessionStorage.setItem(
      "optizzz-timing-queue",
      // The malformed launch last: the clock of the latest one sets the wait.
      JSON.stringify([
        { target: 5 },
        "x",
        null,
        {
          target: "Cible_1",
          aimedAt: arrival,
          sentAt: serverDate,
          clock: { offsetMs: 0, errorMs: 200, oneWayMs: "1e12" },
        },
      ]),
    );
    const io = fakeIo();
    await checkTimedLaunches(origin, sessionStorage, io);
    expect(io.waits).toEqual([]);
    expect(io.urls).toEqual([]);
  });

  it("takes twenty launches at most", async () => {
    const launches = Array.from({ length: 25 }, () => ({
      target: "Nobody",
      aimedAt: arrival,
      clock,
      sentAt: serverDate - 2000,
    }));
    sessionStorage.setItem("optizzz-timing-queue", JSON.stringify(launches));
    await checkTimedLaunches(origin, sessionStorage, fakeIo());
    expect(JSON.parse(sessionStorage.getItem("optizzz-timing-queue") ?? "[]")).toHaveLength(20);
  });

  it("drops the verdicts past their date when it stores a new one", async () => {
    await storage.setItem("local:timing:s5.fourmizzz.fr:attacks", [
      { attackId: 1, aimedAt: 0, arrivesAt: serverDate - 2 * 60 * 60_000 },
    ]);
    queueTimedLaunch(sessionStorage, { target: "Cible_1", aimedAt: arrival, clock, sentAt: serverDate - 2000 });
    await checkTimedLaunches(origin, sessionStorage, fakeIo());
    const stored = await storage.getItem<{ arrivesAt: number }[]>("local:timing:s5.fourmizzz.fr:attacks");
    expect(stored).toHaveLength(1);
    expect(stored?.[0]?.arrivesAt).toBe(arrival);
  });
});

describe("loadTimedAttacks", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    sessionStorage.clear();
  });

  it("forgets an attack an hour after its arrival", async () => {
    queueTimedLaunch(sessionStorage, { target: "Cible_1", aimedAt: arrival, clock, sentAt: serverDate - 2000 });
    await checkTimedLaunches(origin, sessionStorage, fakeIo());
    expect(await loadTimedAttacks(origin, arrival + 59 * 60_000)).toHaveLength(1);
    expect(await loadTimedAttacks(origin, arrival + 61 * 60_000)).toEqual([]);
  });
});

describe("labelTimedAttacks", () => {
  const timed = [{ attackId: 34250, aimedAt: arrival, arrivesAt: arrival + 1000 }];

  it("writes the exact arrival after the game's countdown", () => {
    const doc = armee();
    labelTimedAttacks(doc, timed);
    const label = doc.querySelector("#attaque_34250 ~ .optizzz-timing-verdict");
    expect(label?.textContent).toBe("Arrivée à 11:16:00 ✗ une seconde trop tard");
    expect(doc.querySelectorAll(".optizzz-timing-verdict")).toHaveLength(1);
  });

  it("writes it in the row of « Attaques en cours » when that list replaces the game's lines", () => {
    const doc = armee();
    renderAttacksOnWay(
      doc,
      () => new Date(serverDate),
      () => Promise.resolve(),
    )();
    labelTimedAttacks(doc, [{ attackId: 34250, aimedAt: arrival, arrivesAt: arrival }]);
    const row = doc.querySelector(".optizzz-on-way-row");
    expect(row?.querySelector(".optizzz-timing-verdict")?.textContent).toBe("Arrivée à 11:15:59 ✓ :59 visé");
    expect(doc.querySelectorAll(".optizzz-timing-verdict")).toHaveLength(1);
  });

  it("is written once however often it runs", () => {
    const doc = armee();
    labelTimedAttacks(doc, timed);
    labelTimedAttacks(doc, timed);
    expect(doc.querySelectorAll(".optizzz-timing-verdict")).toHaveLength(1);
  });
});
