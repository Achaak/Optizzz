import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import messagerieHtml from "@/game/pages/__fixtures__/messagerie-convoys.html?raw";
import type { ConvoyMessage } from "@/game/pages/messages";
import { forgetGamePages } from "@/utils/game-page";
import {
  CONVOY_HISTORY_MAX_AGE,
  convoyHistoryOutdated,
  GAME_KEEPS_MESSAGES,
  keepConvoyMessages,
  loadConvoyHistory,
  mergeConvoyHistory,
  refreshConvoyHistory,
} from "./convoy-history";

const ORIGIN = "https://s5.fourmizzz.fr";
const DAY = 24 * 3600_000;
const now = new Date(2026, 9, 19, 12, 30);
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const message = (id: number, at: Date, materials = 1000): ConvoyMessage => ({
  id,
  direction: "sent",
  player: "Fourmi_Alpha",
  food: 0,
  materials,
  at,
});

beforeEach(() => {
  fakeBrowser.reset();
  forgetGamePages();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mergeConvoyHistory", () => {
  it("covers the days the game still shows when nothing was kept", () => {
    const history = mergeConvoyHistory(null, [message(1, ago(2))], now);
    expect(history.messages).toEqual([message(1, ago(2))]);
    expect(history.readAt).toEqual(now);
    expect(history.coveredFrom).toEqual(new Date(now.getTime() - GAME_KEEPS_MESSAGES));
  });

  it("keeps what the game deleted since, takes a conversation's new sum, and forgets after 30 days", () => {
    const kept = {
      messages: [message(1, ago(31)), message(2, ago(10)), message(3, ago(1), 500)],
      readAt: ago(5),
      coveredFrom: ago(12),
    };
    const history = mergeConvoyHistory(kept, [message(3, ago(0.5), 800), message(4, ago(0.2))], now);
    expect(history.messages).toEqual([message(4, ago(0.2)), message(3, ago(0.5), 800), message(2, ago(10))]);
    // Read again before the game deleted anything unseen: the coverage goes on.
    expect(history.coveredFrom).toEqual(ago(12));
  });

  it("starts the coverage again after a gap longer than the game keeps its messages", () => {
    const kept = { messages: [message(2, ago(20))], readAt: ago(9), coveredFrom: ago(25) };
    const history = mergeConvoyHistory(kept, [], now);
    expect(history.messages).toEqual([message(2, ago(20))]);
    expect(history.coveredFrom).toEqual(new Date(now.getTime() - GAME_KEEPS_MESSAGES));
  });
});

describe("convoy history storage", () => {
  it("keeps the messages per server, dates included", async () => {
    await keepConvoyMessages(ORIGIN, [message(1, ago(1))], now);
    expect(await loadConvoyHistory(ORIGIN)).toEqual({
      messages: [message(1, ago(1))],
      readAt: now,
      coveredFrom: new Date(now.getTime() - GAME_KEEPS_MESSAGES),
    });
    expect(await loadConvoyHistory("https://s2.fourmizzz.fr")).toBeNull();
  });

  it("reads messagerie.php again in the background, and keeps what it had when the page is not the inbox", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const fetchMock = vi.fn(() => Promise.resolve(new Response(messagerieHtml)));
    vi.stubGlobal("fetch", fetchMock);
    const history = await refreshConvoyHistory(ORIGIN);
    expect(fetchMock).toHaveBeenCalledWith(`${ORIGIN}/messagerie.php`);
    expect(history?.messages.map((kept) => kept.id)).toEqual([9005, 9004, 9002, 9001, 9000]);

    forgetGamePages();
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("<p>Connexion</p>")));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await refreshConvoyHistory(ORIGIN))?.messages).toHaveLength(5);
    vi.useRealTimers();
  });

  it("is read again when nothing is kept or once older than a quarter of an hour", () => {
    const kept = (readAt: Date) => ({ messages: [], readAt, coveredFrom: ago(7) });
    expect(convoyHistoryOutdated(null, now)).toBe(true);
    expect(convoyHistoryOutdated(kept(new Date(now.getTime() - CONVOY_HISTORY_MAX_AGE + 1000)), now)).toBe(false);
    expect(convoyHistoryOutdated(kept(new Date(now.getTime() - CONVOY_HISTORY_MAX_AGE - 1000)), now)).toBe(true);
  });
});
