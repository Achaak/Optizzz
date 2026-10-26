import { describe, expect, it } from "vitest";
import {
  DISCORD_MESSAGE_MAX,
  discordLine,
  discordMessages,
  discordSettingsFrom,
  escapeDiscord,
  eventConsented,
  normalizeWebhookUrl,
  sendableEvents,
  type DiscordSettings,
} from "./discord";

const NOW = new Date("2026-10-26T13:36:00+01:00");
const URL_OK = "https://discord.com/api/webhooks/123456789012345678/AbC-def_GHI";

describe("normalizeWebhookUrl", () => {
  it("accepts a Discord webhook address, trimmed and without a trailing slash", () => {
    expect(normalizeWebhookUrl(`  ${URL_OK}/ `)).toBe(URL_OK);
  });

  it("accepts discordapp.com, written as discord.com", () => {
    expect(normalizeWebhookUrl("https://discordapp.com/api/webhooks/1234/tok")).toBe(
      "https://discord.com/api/webhooks/1234/tok",
    );
  });

  it.each([
    ["http://discord.com/api/webhooks/1/t"],
    ["https://discord.com.evil.fr/api/webhooks/1/t"],
    ["https://evil.fr/api/webhooks/1/t"],
    ["https://discord.com/api/webhooks/abc/t"],
    ["https://discord.com/api/webhooks/1"],
    ["https://discord.com/api/webhooks/1/t?wait=true"],
    ["https://discord.com/api/webhooks/1/t#x"],
    ["https://user:pw@discord.com/api/webhooks/1/t"],
    ["https://discord.com:8443/api/webhooks/1/t"],
    ["https://discord.com/api/webhooks/1/t/slack"],
    ["pas une adresse"],
    [""],
  ])("refuses %s", (text) => {
    expect(normalizeWebhookUrl(text)).toBeNull();
  });
});

describe("discordSettingsFrom", () => {
  it("reads the settings, with only the events it knows and their address checked", () => {
    expect(discordSettingsFrom({ v: 1, url: URL_OK, events: ["convoys", "later"], urlSetAtVersion: 2 })).toEqual({
      url: URL_OK,
      events: ["convoys"],
      urlSetAtVersion: 2,
    });
  });

  it("refuses an address that is not a Discord webhook", () => {
    expect(() => discordSettingsFrom({ v: 1, url: "https://evil.fr/x", events: [], urlSetAtVersion: 1 })).toThrow();
  });

  it("refuses another shape", () => {
    expect(() => discordSettingsFrom({ url: URL_OK })).toThrow();
  });
});

describe("sendableEvents and eventConsented", () => {
  const settings: DiscordSettings = { url: URL_OK, events: ["convoys"], urlSetAtVersion: 1 };

  it("needs an address and the event switched on by an Admin", () => {
    expect(sendableEvents(settings)).toEqual(["convoys"]);
    expect(sendableEvents({ ...settings, url: null })).toEqual([]);
    expect(sendableEvents({ ...settings, events: [] })).toEqual([]);
    expect(sendableEvents(null)).toEqual([]);
  });

  it("needs the member to send the event's category", () => {
    expect(eventConsented("convoys", ["convoys"])).toBe(true);
    expect(eventConsented("convoys", ["floods"])).toBe(false);
  });
});

describe("discordLine", () => {
  it("writes a convoy as the game counts, Paris time", () => {
    expect(
      discordLine(
        {
          kind: "convoy",
          from: "Messor",
          to: "Lasius",
          food: 12348,
          materials: 0,
          at: new Date("2026-10-26T18:12:00+01:00").getTime(),
        },
        NOW,
      ),
    ).toBe("Messor a envoyé un convoi à Lasius : 12 348 nourriture, arrivée 18 h 12");
  });

  it("names both resources, and the day when it is not today", () => {
    expect(
      discordLine(
        {
          kind: "convoy",
          from: "Messor",
          to: "Lasius",
          food: 1000,
          materials: 2500,
          at: new Date("2026-10-27T02:05:00+01:00").getTime(),
        },
        NOW,
      ),
    ).toBe("Messor a envoyé un convoi à Lasius : 1 000 nourriture et 2 500 matériaux, arrivée demain 2 h 05");
  });

  it("keeps the pseudos as written, without Discord formatting", () => {
    expect(
      discordLine({ kind: "convoy", from: "_x_", to: "**y**", food: 0, materials: 5, at: NOW.getTime() + 60_000 }, NOW),
    ).toBe("\\_x\\_ a envoyé un convoi à \\*\\*y\\*\\* : 5 matériaux, arrivée 13 h 37");
  });
});

describe("escapeDiscord", () => {
  it("escapes Discord's markdown and links", () => {
    expect(escapeDiscord("a*b_c~d`e|f>g\\h[i](j)#-")).toBe("a\\*b\\_c\\~d\\`e\\|f\\>g\\\\h\\[i\\]\\(j\\)\\#\\-");
  });
});

describe("discordMessages", () => {
  it("joins the lines in as few messages as Discord takes", () => {
    expect(discordMessages(["a", "b"])).toEqual(["a\nb"]);
    const long = "x".repeat(1500);
    expect(discordMessages([long, long, "y"])).toEqual([long, `${long}\ny`]);
  });

  it("cuts a line longer than a message", () => {
    const messages = discordMessages(["z".repeat(DISCORD_MESSAGE_MAX + 10)]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toHaveLength(DISCORD_MESSAGE_MAX);
  });
});
