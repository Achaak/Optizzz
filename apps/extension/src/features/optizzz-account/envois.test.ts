import { NO_ENVOIS, type EnvoiCrypto } from "@optizzz/game/site-links/envois";
import { ALLIANCE_KEYS, type HandedKey } from "@optizzz/game/site-links/space-bridge";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { keepConvoyMessages } from "@/data/convoy-history";
import { storeConvoys, storeIncomingConvoys } from "@/data/convoys";
import { loadKeys, storeKeys } from "@/data/envois";
import { storeAttachedPlayers, storeCurrentPlayer, storeLink } from "@/data/optizzz-account";
import { ENVOI_DELAY_MS, envoiService, MISSING_KEY } from "./envois";

const S5 = "https://s5.fourmizzz.fr";
const SPACE = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const TOKEN = "T".repeat(43);
const NOW = new Date("2026-10-25T15:00:00Z");
const KEY_1: HandedKey = { version: 1, key: "A".repeat(43) };
const KEY_2: HandedKey = { version: 2, key: "B".repeat(43) };

/** A string hash, for the fingerprint's stand-in: it must not show its input. */
const hash = (text: string) =>
  Array.from({ length: text.length }, (_, i) => text.charCodeAt(i))
    .reduce((h, c) => (Math.imul(h, 31) + c) >>> 0, 7)
    .toString(36);

/**
 * libsodium is tested in @optizzz/crypto and on the site: here, a reversible stand-in that still says which version
 * sealed what, and fails to open with keys that do not hold it.
 */
const fakeCrypto = (keys: HandedKey[]): EnvoiCrypto => {
  const newest = Math.max(...keys.map((k) => k.version));
  return {
    encrypt: (text) => Promise.resolve(`v${String(newest)}.${btoa(encodeURIComponent(text))}`),
    decrypt: (blob) => {
      const [version, body = ""] = blob.split(".");
      if (!keys.some((k) => `v${String(k.version)}` === version)) return Promise.reject(new Error("missing version"));
      return Promise.resolve(decodeURIComponent(atob(body)));
    },
    fingerprint: (text) => Promise.resolve(`fp-v${String(newest)}-${hash(text)}`),
  };
};

interface Posted {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
}

/** optizzz.fr in memory: the account's spaces, the settings, and the Envois it keeps. */
function fakeSite() {
  const calls: Posted[] = [];
  let version = 1;
  let inSpace = true;
  let offline = false;
  const settings = new Map<number, string[]>();
  let rows: { id: string; server: string; playerId: number; category: string; fingerprint: string; blob: string }[] =
    [];
  let nextId = 1;
  const fetch = (url: string, init: RequestInit) => {
    const { pathname, searchParams } = new URL(url);
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ path: pathname, method, body });
    if (offline) return Promise.reject(new TypeError("Failed to fetch"));
    if (pathname === "/api/extension/spaces")
      return Promise.resolve(
        Response.json({
          players: [
            {
              server: "s5",
              playerId: 1,
              pseudo: "Messor",
              categories: settings.get(1) ?? [],
              space: inSpace
                ? {
                    id: SPACE,
                    name: "ABC sur S5",
                    tag: "ABC",
                    version: { version, createdAt: NOW.toISOString(), createdByPseudo: "Messor" },
                    members: [],
                  }
                : null,
            },
          ],
        }),
      );
    if (pathname === "/api/extension/envoi-settings") {
      settings.set(body?.playerId as number, body?.categories as string[]);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (pathname === "/api/extension/envois" && method === "POST") {
      if (!(settings.get(1) ?? []).includes("convoys"))
        return Promise.resolve(Response.json({ error: "category-off", message: "off" }, { status: 409 }));
      if (body?.keyVersion !== version)
        return Promise.resolve(Response.json({ error: "stale-key", message: MISSING_KEY }, { status: 409 }));
      const removed = body.removed as string[];
      rows = rows.filter((r) => !(r.playerId === body.playerId && removed.includes(r.fingerprint)));
      for (const item of body.items as { fingerprint: string; blob: string }[]) {
        const known = rows.find((r) => r.playerId === body.playerId && r.fingerprint === item.fingerprint);
        if (known) known.blob = item.blob;
        else
          rows.push({
            id: String(nextId++),
            server: "s5",
            playerId: body.playerId as number,
            category: "convoys",
            ...item,
          });
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (pathname === "/api/extension/envois")
      return Promise.resolve(
        Response.json({
          cursor: NOW.getTime(),
          items: searchParams.get("since") ? rows.filter((r) => Number(r.id) > 1000) : rows,
          live: searchParams.get("since") ? rows.map((r) => r.id) : null,
        }),
      );
    return Promise.resolve(new Response(null, { status: 404 }));
  };
  return {
    fetch,
    calls,
    posts: () => calls.filter((c) => c.path === "/api/extension/envois" && c.method === "POST"),
    rows: () => rows,
    addRow: (row: (typeof rows)[number]) => rows.push(row),
    setVersion: (v: number) => (version = v),
    setInSpace: (v: boolean) => (inSpace = v),
    setOffline: (v: boolean) => (offline = v),
  };
}

describe("the Envois of the convoys", () => {
  let site: ReturnType<typeof fakeSite>;
  let now: Date;
  let timers: { ms: number; run: () => void }[];
  let notices: { id: string; message: string }[];
  const service = () =>
    envoiService({
      now: () => now,
      fetch: site.fetch,
      permitted: () => Promise.resolve(true),
      crypto: fakeCrypto,
      notify: (notice) => {
        notices.push(notice);
        return Promise.resolve();
      },
      later: (ms, run) => timers.push({ ms, run }),
    });
  const flush = async () => {
    const due = timers;
    timers = [];
    for (const timer of due) timer.run();
    // Let the scheduled Envoi run to its end.
    for (let i = 0; i < 50; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const keysHanded = (keys: HandedKey[], expiresAt: number | null = null) =>
    service().receiveKeys({ type: ALLIANCE_KEYS, spaceId: SPACE, keys, expiresAt });

  beforeEach(async () => {
    fakeBrowser.reset();
    site = fakeSite();
    now = NOW;
    timers = [];
    notices = [];
    await storeLink(TOKEN, NOW);
    await storeAttachedPlayers([{ server: "s5", pseudo: "Messor" }]);
    await storeCurrentPlayer(S5, "Messor");
    await storeConvoys(
      S5,
      [{ recipient: "Lasius", food: 0, materials: 350_000, arrivesAt: new Date("2026-10-25T16:12:00Z") }],
      NOW,
    );
  });

  it("sends nothing while « Convois » is unchecked, even when the convoys kept change", async () => {
    await keysHanded([KEY_1]);
    service().changed("s5.fourmizzz.fr");
    await flush();
    expect(site.posts()).toEqual([]);
  });

  it("sends at once when « Convois » gets checked: only encrypted items, with the newest version", async () => {
    await keysHanded([KEY_1]);
    await service().choose("s5", "Messor", { ...NO_ENVOIS, convoys: true });
    const settings = site.calls.find((c) => c.path === "/api/extension/envoi-settings");
    expect(settings?.body).toEqual({ server: "s5", playerId: 1, categories: ["convoys"] });
    const [post] = site.posts();
    expect(post?.body).toMatchObject({ server: "s5", playerId: 1, category: "convoys", keyVersion: 1, removed: [] });
    const items = post?.body?.items as { fingerprint: string; blob: string }[];
    expect(items).toHaveLength(1);
    expect(items[0]?.blob).toMatch(/^v1\./);
    // Neither the recipient nor the amounts in clear.
    expect(JSON.stringify(items)).not.toMatch(/Lasius|350000/);
    expect((await service().status())[0]).toMatchObject({
      spaceName: "ABC sur S5",
      problem: null,
      lastSentAt: NOW.getTime(),
    });
  });

  it("sends again a few seconds after the convoys kept change, never before, and once for several changes", async () => {
    await keysHanded([KEY_1]);
    const envois = service();
    await envois.choose("s5", "Messor", { ...NO_ENVOIS, convoys: true });
    await storeIncomingConvoys(
      S5,
      [{ sender: "Polyergus", food: 2, materials: 1, arrivesAt: new Date("2026-10-25T17:00:00Z") }],
      NOW,
    );
    envois.changed("s5.fourmizzz.fr");
    envois.changed("s5.fourmizzz.fr");
    expect(timers.map((t) => t.ms)).toEqual([ENVOI_DELAY_MS]);
    expect(site.posts()).toHaveLength(1);
    await flush();
    expect(site.posts()).toHaveLength(2);
    expect(site.rows()).toHaveLength(2);
  });

  it("sends the same blob for a convoy that did not change, and says which ones are gone", async () => {
    await keysHanded([KEY_1]);
    const envois = service();
    await envois.choose("s5", "Messor", { ...NO_ENVOIS, convoys: true });
    const [first] = site.rows();
    await keepConvoyMessages(
      S5,
      [
        {
          id: 9,
          direction: "sent",
          player: "Lasius",
          food: 0,
          materials: 350_000,
          at: new Date("2026-10-25T14:00:00Z"),
        },
      ],
      NOW,
    );
    envois.changed("s5.fourmizzz.fr");
    await flush();
    expect(site.rows().find((r) => r.fingerprint === first?.fingerprint)?.blob).toBe(first?.blob);

    // The convoy arrived: gone from commerce.php.
    await storeConvoys(S5, [], NOW);
    envois.changed("s5.fourmizzz.fr");
    await flush();
    expect(site.posts().at(-1)?.body?.removed).toEqual([first?.fingerprint]);
    expect(site.rows()).toHaveLength(1);
  });

  it("refuses a Clé d'alliance older than a version already seen, and stops sending without the newest", async () => {
    expect(await keysHanded([KEY_1, KEY_2])).toEqual({ ok: true });
    expect(await keysHanded([KEY_1])).toEqual({ ok: false });
    expect(await loadKeys(SPACE, NOW)).toEqual([KEY_1, KEY_2]);

    // The site says version 3 exists (an exclusion): the versions held are not enough.
    site.setVersion(3);
    await service().choose("s5", "Messor", { ...NO_ENVOIS, convoys: true });
    expect(site.posts()).toEqual([]);
    expect((await service().status())[0]?.problem).toBe(MISSING_KEY);

    // The space page hands version 3: what waited leaves.
    expect(await keysHanded([KEY_1, KEY_2, { version: 3, key: "C".repeat(43) }])).toEqual({ ok: true });
    expect(site.posts()).toHaveLength(1);
    expect(site.posts()[0]?.body?.keyVersion).toBe(3);
  });

  it("keeps the Clé d'alliance for the session, or until its date, and forgets it on « Se déconnecter »", async () => {
    await storeKeys(SPACE, [KEY_1], NOW.getTime() + 1000);
    expect(await loadKeys(SPACE, NOW)).toEqual([KEY_1]);
    expect(await loadKeys(SPACE, new Date(NOW.getTime() + 2000))).toBeNull();
    await keysHanded([KEY_1]);
    expect(await loadKeys(SPACE, NOW)).toEqual([KEY_1]);
    await service().forget();
    expect(await loadKeys(SPACE, NOW)).toBeNull();
    await service().choose("s5", "Messor", { ...NO_ENVOIS, convoys: true });
    expect(site.posts()).toEqual([]);
  });

  it("sends what failed again at the next game page, not from a timer", async () => {
    await keysHanded([KEY_1]);
    const envois = service();
    await envois.refreshSpaces();
    site.setOffline(true);
    await envois.choose("s5", "Messor", { ...NO_ENVOIS, convoys: true });
    site.setOffline(false);
    await envois.releve("alarm");
    expect(site.posts()).toHaveLength(1);
    await envois.releve("page");
    // The site never got the choice either: told again, then the Envoi goes through.
    expect(site.posts().length).toBeGreaterThan(1);
    expect(site.rows()).toHaveLength(1);
    expect((await envois.status())[0]?.problem).toBeNull();
  });

  it("does not take a Joueur's data for another's: only the game's logged-in player sends", async () => {
    await keysHanded([KEY_1]);
    await storeCurrentPlayer(S5, "Lasius");
    await service().choose("s5", "Messor", { ...NO_ENVOIS, convoys: true });
    expect(site.posts()).toEqual([]);
  });
});

describe("the relève", () => {
  let site: ReturnType<typeof fakeSite>;
  let notices: { id: string; message: string }[];
  const service = (now = NOW) =>
    envoiService({
      now: () => now,
      fetch: site.fetch,
      permitted: () => Promise.resolve(true),
      crypto: fakeCrypto,
      notify: (notice) => {
        notices.push(notice);
        return Promise.resolve();
      },
      later: () => undefined,
    });
  const sealed = (playerId: number, fingerprint: string, item: Record<string, unknown>, observedAt = NOW.getTime()) =>
    fakeCrypto([KEY_1]).encrypt(
      JSON.stringify({ v: 1, server: "s5", playerId, category: "convoys", fingerprint, observedAt, item }),
    );
  const toMe = {
    kind: "transit",
    from: "Lasius",
    to: "Messor",
    food: 0,
    materials: 1000,
    at: Date.parse("2026-10-25T17:12:00Z"),
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    site = fakeSite();
    notices = [];
    await storeLink(TOKEN, NOW);
    await storeAttachedPlayers([{ server: "s5", pseudo: "Messor" }]);
    await storeCurrentPlayer(S5, "Messor");
  });

  it("asks nothing without the Clé d'alliance, and never the game", async () => {
    await service().releve("page");
    expect(site.calls.map((c) => c.path)).toEqual(["/api/extension/spaces"]);
    await service().releve("alarm");
    expect(site.calls.every((c) => new URL(`https://optizzz.fr${c.path}`).host === "optizzz.fr")).toBe(true);
    expect(site.calls.filter((c) => c.path === "/api/extension/envois")).toEqual([]);
  });

  it("opens the members' convoys, refuses one filed under another member, and shows those on their way to me", async () => {
    await storeKeys(SPACE, [KEY_1], null);
    site.addRow({
      id: "1",
      server: "s5",
      playerId: 2,
      category: "convoys",
      fingerprint: "a",
      blob: await sealed(2, "a", toMe),
    });
    // Lasius's Envoi, filed by the site under player 3.
    site.addRow({
      id: "2",
      server: "s5",
      playerId: 3,
      category: "convoys",
      fingerprint: "b",
      blob: await sealed(2, "b", { ...toMe, materials: 5 }),
    });
    await service().releve("page");
    expect(await service().incoming(S5)).toEqual({
      problem: null,
      convoys: [{ from: "Lasius", food: 0, materials: 1000, at: toMe.at }],
    });
    // The first relève does not notify what was already on its way.
    expect(notices).toEqual([]);
  });

  it("notifies a convoy newly on its way to me, once", async () => {
    await storeKeys(SPACE, [KEY_1], null);
    await service().releve("page");
    site.addRow({
      id: "1001",
      server: "s5",
      playerId: 2,
      category: "convoys",
      fingerprint: "c",
      blob: await sealed(2, "c", toMe),
    });
    await service().releve("alarm");
    await service().releve("alarm");
    expect(notices).toEqual([
      {
        id: "s5.fourmizzz.fr:alliance-convoy:c",
        message: "S5 : un convoi de Lasius vous arrive à 18 h 12",
        url: `${S5}/commerce.php`,
      },
    ]);
  });

  it("tells the game's page why it shows nothing", async () => {
    expect((await service().incoming(S5)).problem).toBe("no-space");
    await service().refreshSpaces();
    expect((await service().incoming(S5)).problem).toBe("no-key");
    site.setInSpace(false);
    await service().refreshSpaces();
    expect((await service().incoming(S5)).problem).toBe("no-space");
  });
});
