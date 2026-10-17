import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  addToWatchlist,
  loadWatchlist,
  markSeen,
  removeFromWatchlist,
  WATCH_LIMIT,
  watchedHosts,
  watchKey,
  type WatchEntry,
} from "./watchlist";

const HOST = "s5.fourmizzz.fr";
const seen = { version: "202610170900", field: 1000 };
const rival: WatchEntry = { kind: "player", id: 12, pseudo: "Rival", seen };
const abc: WatchEntry = { kind: "alliance", tag: "ABC", seen };

describe("watchlist", () => {
  beforeEach(() => fakeBrowser.reset());

  it("keys players by id and alliances by tag, whatever its case", () => {
    expect(watchKey(rival)).toBe("player:12");
    expect(watchKey({ ...abc, tag: "Abc" })).toBe("alliance:abc");
  });

  it("adds, lists and removes the watched players and alliances of a server", async () => {
    expect(await addToWatchlist(HOST, rival)).toBe("added");
    expect(await addToWatchlist(HOST, abc)).toBe("added");
    expect(await addToWatchlist(HOST, { ...abc, tag: "abc" })).toBe("already");
    expect(await loadWatchlist(HOST)).toEqual([rival, abc]);
    expect(await loadWatchlist("s2.fourmizzz.fr")).toEqual([]);

    await removeFromWatchlist(HOST, "alliance:abc");
    expect(await loadWatchlist(HOST)).toEqual([rival]);
  });

  it("refuses an entry past the limit", async () => {
    for (let id = 1; id <= WATCH_LIMIT; id++) await addToWatchlist(HOST, { ...rival, id });
    expect(await addToWatchlist(HOST, abc)).toBe("full");
    expect(await loadWatchlist(HOST)).toHaveLength(WATCH_LIMIT);
  });

  it("moves the « seen » mark of the given entries only", async () => {
    await addToWatchlist(HOST, rival);
    await addToWatchlist(HOST, abc);
    const later = { version: "202610171500", field: 800 };
    await markSeen(HOST, { "player:12": later });
    expect(await loadWatchlist(HOST)).toEqual([{ ...rival, seen: later }, abc]);
  });

  it("does not lose a change when two are made at once", async () => {
    await Promise.all([addToWatchlist(HOST, rival), addToWatchlist(HOST, abc)]);
    expect(await loadWatchlist(HOST)).toHaveLength(2);
  });

  it("lists the servers whose list is not empty", async () => {
    await addToWatchlist(HOST, rival);
    await addToWatchlist("s2.fourmizzz.fr", abc);
    await removeFromWatchlist("s2.fourmizzz.fr", "alliance:abc");
    expect(await watchedHosts()).toEqual([HOST]);
  });
});
