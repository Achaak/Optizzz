import { discordSettingsText, type DiscordSettings } from "@optizzz/game/site-links/discord";
import type { EnvoiCrypto } from "@optizzz/game/site-links/envois";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { loadDiscordAnswer, loadWebhook } from "@/data/discord";
import { discordService } from "./discord";

const SPACE = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const TOKEN = "T".repeat(43);
const NOW = new Date("2026-10-26T12:00:00Z");
const WEBHOOK = "https://discord.com/api/webhooks/1234/secret-token";
const CONVOY = {
  kind: "convoy" as const,
  from: "Messor",
  to: "Lasius",
  food: 12_348,
  materials: 0,
  at: new Date("2026-10-26T17:12:00Z").getTime(),
};

/** A reversible stand-in for libsodium (tested in @optizzz/crypto): « sealed: » and the text. */
const crypto: EnvoiCrypto = {
  encrypt: (text) => Promise.resolve(`sealed:${text}`),
  decrypt: (blob) =>
    blob.startsWith("sealed:") ? Promise.resolve(blob.slice(7)) : Promise.reject(new Error("does not open")),
  fingerprint: (text) => Promise.resolve(text),
};

const sealed = (settings: Partial<DiscordSettings> = {}) =>
  `sealed:${discordSettingsText({ url: WEBHOOK, events: ["convoys"], urlSetAtVersion: 1, ...settings })}`;

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

/** optizzz.fr and Discord in memory: never a real webhook. */
function fakeNet() {
  const calls: Call[] = [];
  let webhooks: { spaceId: string; blob: string; revision: number }[] = [];
  let discordAnswers: (() => Response | Promise<Response>)[] = [];
  const fetch = (url: string, init: RequestInit) => {
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ url, method: init.method ?? "GET", body });
    if (url === "https://optizzz.fr/api/extension/discord")
      return Promise.resolve(
        init.method === "POST" ? new Response(null, { status: 204 }) : Response.json({ spaces: webhooks }),
      );
    if (url.startsWith("https://discord.com/")) {
      const next = discordAnswers.shift();
      return Promise.resolve(next ? next() : new Response(null, { status: 204 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  };
  return {
    fetch,
    calls,
    toDiscord: () => calls.filter((c) => c.url.startsWith("https://discord.com/")),
    reports: () => calls.filter((c) => c.url.endsWith("/api/extension/discord") && c.method === "POST"),
    setWebhooks: (rows: typeof webhooks) => (webhooks = rows),
    answerDiscord: (...answers: (() => Response | Promise<Response>)[]) => (discordAnswers = answers),
  };
}

describe("the alliance's Discord webhook, from the extension of the member who acts", () => {
  let net: ReturnType<typeof fakeNet>;
  let now: Date;
  let permitted: boolean;
  let timers: { ms: number; run: () => void }[];

  const service = discordService({
    now: () => now,
    fetch: (url, init) => net.fetch(url, init),
    permitted: () => Promise.resolve(permitted),
    later: (ms, run) => timers.push({ ms, run }),
  });
  const announce = (categories: string[] = ["convoys"], news = [CONVOY]) =>
    service.announce({ token: TOKEN, spaceId: SPACE, categories, crypto, event: "convoys", news });
  const settle = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const runTimers = async () => {
    const due = timers;
    timers = [];
    for (const timer of due) timer.run();
    await settle();
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    service.reset();
    net = fakeNet();
    now = NOW;
    permitted = true;
    timers = [];
    net.setWebhooks([{ spaceId: SPACE, blob: sealed(), revision: 1 }]);
    await service.refresh(TOKEN);
  });

  it("keeps the webhook of each space as the site hands it, still encrypted", async () => {
    expect(await loadWebhook(SPACE)).toEqual({ blob: sealed(), revision: 1 });
    net.setWebhooks([]);
    await service.refresh(TOKEN);
    expect(await loadWebhook(SPACE)).toBeNull();
  });

  it("posts the news to the webhook, without mentions, when an Admin switched the event on", async () => {
    await announce();
    await settle();
    expect(net.toDiscord()).toEqual([
      {
        url: WEBHOOK,
        method: "POST",
        body: {
          content: "Messor a envoyé un convoi à Lasius : 12 348 nourriture, arrivée 18 h 12",
          allowed_mentions: { parse: [] },
        },
      },
    ]);
  });

  it("posts nothing without the member's consent, the event, the address, the permission or the key", async () => {
    await announce(["floods"]);
    net.setWebhooks([{ spaceId: SPACE, blob: sealed({ events: [] }), revision: 2 }]);
    await service.refresh(TOKEN);
    await announce();
    net.setWebhooks([{ spaceId: SPACE, blob: sealed({ url: null }), revision: 3 }]);
    await service.refresh(TOKEN);
    await announce();
    net.setWebhooks([{ spaceId: SPACE, blob: "v2.other-key", revision: 4 }]);
    await service.refresh(TOKEN);
    await announce();
    net.setWebhooks([{ spaceId: SPACE, blob: sealed(), revision: 5 }]);
    await service.refresh(TOKEN);
    permitted = false;
    await announce();
    await settle();
    expect(net.toDiscord()).toEqual([]);
  });

  it("tells the site of a refused webhook, says it to the member, and does not try it again", async () => {
    net.answerDiscord(() => Response.json({ message: "Unknown Webhook", code: 10015 }, { status: 404 }));
    await announce();
    await settle();
    expect(net.reports().map((c) => c.body)).toEqual([{ spaceId: SPACE, revision: 1, status: 404 }]);
    expect((await service.status({ spaceId: SPACE, categories: ["convoys"], crypto }))?.problem).toBe(
      "Discord a refusé le dernier message : le webhook de l'alliance n'est plus valable. Les Admins de l'espace le voient sur optizzz.fr.",
    );
    await announce();
    await settle();
    expect(net.toDiscord()).toHaveLength(1);

    // An Admin saved another webhook: tried again.
    net.setWebhooks([{ spaceId: SPACE, blob: sealed(), revision: 2 }]);
    await service.refresh(TOKEN);
    await announce();
    await settle();
    expect(net.toDiscord()).toHaveLength(2);
    expect((await service.status({ spaceId: SPACE, categories: ["convoys"], crypto }))?.problem).toBeNull();
  });

  it("waits as long as Discord asks after a rate limit, then sends what waited in one message, once", async () => {
    net.answerDiscord(() =>
      Response.json({ message: "You are being rate limited.", retry_after: 2.5, global: false }, { status: 429 }),
    );
    await announce();
    await settle();
    await announce(["convoys"], [{ ...CONVOY, to: "Polyergus" }]);
    await settle();
    expect(net.toDiscord()).toHaveLength(1);
    expect(timers.map((t) => t.ms)).toEqual([2500]);
    now = new Date(NOW.getTime() + 2500);
    await runTimers();
    expect(net.toDiscord()).toHaveLength(2);
    expect(net.toDiscord()[1]?.body?.content).toBe(
      "Messor a envoyé un convoi à Lasius : 12 348 nourriture, arrivée 18 h 12\nMessor a envoyé un convoi à Polyergus : 12 348 nourriture, arrivée 18 h 12",
    );
    expect(timers).toEqual([]);
    expect(net.reports()).toEqual([]);
  });

  it("drops a message Discord did not answer, without trying again, and says so", async () => {
    net.answerDiscord(() => Promise.reject(new TypeError("Failed to fetch")));
    await announce();
    await settle();
    expect(timers).toEqual([]);
    expect(await loadDiscordAnswer(SPACE)).toEqual({ refused: null, failedAt: NOW.getTime() });
    expect((await service.status({ spaceId: SPACE, categories: ["convoys"], crypto }))?.problem).toBe(
      "Discord n'a pas répondu aujourd'hui 13 h 00 : ce message n'y est pas parti.",
    );
    await announce();
    await settle();
    expect((await service.status({ spaceId: SPACE, categories: ["convoys"], crypto }))?.problem).toBeNull();
  });

  it("says what goes to Discord, and whether the extension may write there", async () => {
    expect(await service.status({ spaceId: SPACE, categories: ["convoys"], crypto })).toEqual({
      events: [{ event: "convoys", label: "convois", consented: true }],
      permitted: true,
      problem: null,
    });
    permitted = false;
    expect(await service.status({ spaceId: SPACE, categories: [], crypto })).toMatchObject({
      events: [{ event: "convoys", consented: false }],
      permitted: false,
    });
    net.setWebhooks([{ spaceId: SPACE, blob: sealed({ events: [] }), revision: 2 }]);
    await service.refresh(TOKEN);
    expect(await service.status({ spaceId: SPACE, categories: ["convoys"], crypto })).toBeNull();
  });
});
