import { NO_ENVOIS, type EnvoiCrypto } from "@optizzz/game/site-links/envois";
import { ALLIANCE_KEYS, type HandedKey } from "@optizzz/game/site-links/space-bridge";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { keepConvoyMessages } from "@/data/convoy-history";
import { storeConvoys, storeIncomingConvoys } from "@/data/convoys";
import { loadKeys, storeKeys } from "@/data/envois";
import { storeAttachedPlayers, storeCurrentPlayer, storeLink } from "@/data/optizzz-account";
import { armyFromKeys } from "@optizzz/game/army/units";
import { writeLaunches } from "@/data/launches";
import { storeSentAttacks } from "@/data/sent-attacks";
import { keepStatePages } from "@/data/state-pages";
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
  let rows: {
    id: string;
    server: string;
    playerId: number;
    category: string;
    fingerprint: string;
    blob: string;
    detail?: string;
  }[] = [];
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
                    members: [
                      { playerId: 1, pseudo: "Messor", categories: settings.get(1) ?? [] },
                      { playerId: 2, pseudo: "Lasius", categories: ["floods"] },
                      { playerId: 3, pseudo: "Formica", categories: [] },
                    ],
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
      const category = body?.category as string;
      const checked = settings.get(1) ?? [];
      const sends = (c: string) => checked.includes(c);
      if (!(sends(category) || (category === "army" && (sends("army-count") || sends("army-units")))))
        return Promise.resolve(Response.json({ error: "category-off", message: "off" }, { status: 409 }));
      if (body?.keyVersion !== version)
        return Promise.resolve(Response.json({ error: "stale-key", message: MISSING_KEY }, { status: 409 }));
      const removed = body.removed as string[];
      const mine = (r: (typeof rows)[number]) => r.playerId === body.playerId && r.category === category;
      rows = rows.filter((r) => !(mine(r) && removed.includes(r.fingerprint)));
      for (const item of body.items as { fingerprint: string; blob: string; detail?: string }[]) {
        const known = rows.find((r) => mine(r) && r.fingerprint === item.fingerprint);
        if (known) Object.assign(known, { blob: item.blob, detail: item.detail });
        else
          rows.push({
            id: String(nextId++),
            server: "s5",
            playerId: body.playerId as number,
            category,
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
  let notices: { kind: string; id: string; message: string }[];
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
    service().changed("s5.fourmizzz.fr", "convoys");
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
    envois.changed("s5.fourmizzz.fr", "convoys");
    envois.changed("s5.fourmizzz.fr", "convoys");
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
    envois.changed("s5.fourmizzz.fr", "convoys");
    await flush();
    expect(site.rows().find((r) => r.fingerprint === first?.fingerprint)?.blob).toBe(first?.blob);

    // The convoy arrived: gone from commerce.php.
    await storeConvoys(S5, [], NOW);
    envois.changed("s5.fourmizzz.fr", "convoys");
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
  let notices: { kind: string; id: string; message: string }[];
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
        kind: "alliance-convoy",
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

describe("the Envois of the floods", () => {
  let site: ReturnType<typeof fakeSite>;
  let now: Date;
  let timers: { ms: number; run: () => void }[];
  let notices: { kind: string; id: string; message: string }[];
  const ARRIVAL = new Date("2026-10-25T17:12:00Z");
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
    for (let i = 0; i < 50; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const opened = async (blob: string | undefined) =>
    JSON.parse(await fakeCrypto([KEY_1]).decrypt(blob ?? "")) as { item: unknown; fingerprint: string };
  const floodPosts = () => site.posts().filter((p) => p.body?.category === "floods");

  beforeEach(async () => {
    fakeBrowser.reset();
    site = fakeSite();
    now = NOW;
    timers = [];
    notices = [];
    await storeLink(TOKEN, NOW);
    await storeAttachedPlayers([{ server: "s5", pseudo: "Messor" }]);
    await storeCurrentPlayer(S5, "Messor");
    await storeKeys(SPACE, [KEY_1], null);
    await storeSentAttacks(
      S5,
      [
        { attackId: 34250, target: "Lasius", arrivesAt: ARRIVAL },
        { attackId: 34251, target: "Ennemi", arrivesAt: new Date(ARRIVAL.getTime() + 2 * 3600_000) },
      ],
      NOW,
    );
    // Noted by the Plan de flood when sent: only the first one.
    await writeLaunches(S5, [
      {
        targetId: 2,
        target: "Lasius",
        ants: 12_348,
        take: 12_348,
        arrivesAt: ARRIVAL,
        army: armyFromKeys({ JSN: 12_348 }),
      },
    ]);
  });

  it("sends each attack on its way, the take of the Plan de flood, and its army in the Admins' blob", async () => {
    await service().choose("s5", "Messor", { ...NO_ENVOIS, floods: true });
    expect(site.calls.find((c) => c.path === "/api/extension/envoi-settings")?.body?.categories).toEqual(["floods"]);
    const [post] = floodPosts();
    const items = post?.body?.items as { fingerprint: string; blob: string; detail?: string }[];
    expect(items).toHaveLength(2);
    // Nothing in clear: neither the targets, nor the take, nor the army.
    expect(JSON.stringify(items)).not.toMatch(/Lasius|Ennemi|12348|JSN/);
    expect((await opened(items[0]?.blob)).item).toEqual({
      from: "Messor",
      target: "Lasius",
      at: ARRIVAL.getTime(),
      take: 12_348,
    });
    const army = await opened(items[0]?.detail);
    expect(army.item).toEqual({ army: { JSN: 12_348 } });
    // The army names its own row: it cannot be moved under another flood.
    expect(army.fingerprint).toBe(items[0]?.fingerprint);
    expect((await opened(items[1]?.blob)).item).toMatchObject({ target: "Ennemi", take: null });
    expect(items[1]?.detail).toBeUndefined();
    // The convoys were not checked: nothing of them left.
    expect(site.posts().every((p) => p.body?.category === "floods")).toBe(true);
  });

  it("sends the floods a few seconds after the game's list changes, and forgets a cancelled one, not an arrived one", async () => {
    const envois = service();
    await envois.choose("s5", "Messor", { ...NO_ENVOIS, floods: true });
    const [lasius, ennemi] = site.rows().map((r) => r.fingerprint);

    // The attack on Ennemi was cancelled; the one on Lasius arrives, and the Plan de flood drops its launch.
    now = new Date(ARRIVAL.getTime() + 60_000);
    await storeSentAttacks(S5, [{ attackId: 34250, target: "Lasius", arrivesAt: ARRIVAL }], NOW);
    await writeLaunches(S5, []);
    envois.changed("s5.fourmizzz.fr", "floods");
    envois.changed("s5.fourmizzz.fr", "floods");
    expect(timers.map((t) => t.ms)).toEqual([ENVOI_DELAY_MS]);
    await flush();
    expect(floodPosts().at(-1)?.body?.removed).toEqual([ennemi]);
    const kept = site.rows().find((r) => r.fingerprint === lasius);
    // Arrived, it keeps what was sent: its take and its army stay on the site for 7 days.
    expect((await opened(kept?.blob)).item).toMatchObject({ take: 12_348 });
    expect(kept?.detail).toBeDefined();

    // Gone from the game's list after its arrival: not « removed ».
    await storeSentAttacks(S5, [], now);
    envois.changed("s5.fourmizzz.fr", "floods");
    await flush();
    expect(floodPosts().at(-1)?.body?.removed).toEqual([]);
    expect(site.rows().map((r) => r.fingerprint)).toEqual([lasius]);
  });

  it("shows the members' floods to the game's pages, and notifies one newly on its way to me, once", async () => {
    const sealedFlood = (playerId: number, fingerprint: string, item: Record<string, unknown>) =>
      fakeCrypto([KEY_1]).encrypt(
        JSON.stringify({ v: 1, server: "s5", playerId, category: "floods", fingerprint, observedAt: 1, item }),
      );
    const onMe = { from: "Lasius", target: "Messor", at: ARRIVAL.getTime(), take: 12_348 };
    site.addRow({
      id: "1",
      server: "s5",
      playerId: 2,
      category: "floods",
      fingerprint: "f1",
      blob: await sealedFlood(2, "f1", { ...onMe, target: "Formica", take: null }),
    });
    await service().releve("page");
    expect(await service().floods(S5)).toEqual({
      problem: null,
      me: "Messor",
      members: ["Messor", "Lasius", "Formica"],
      floods: [{ from: "Lasius", target: "Formica", at: ARRIVAL.getTime(), take: null }],
    });
    site.addRow({
      id: "1001",
      server: "s5",
      playerId: 2,
      category: "floods",
      fingerprint: "f2",
      blob: await sealedFlood(2, "f2", onMe),
    });
    await service().releve("alarm");
    await service().releve("alarm");
    expect(notices).toEqual([
      {
        kind: "alliance-flood",
        id: "s5.fourmizzz.fr:alliance-flood:f2",
        message: "Lasius vous floode : arrivée aujourd'hui 18 h 12 (S5)",
        url: `${S5}/Armee.php`,
      },
    ]);
    // Arrived: no longer on its way.
    now = new Date(ARRIVAL.getTime() + 1000);
    expect((await service().floods(S5)).floods).toEqual([]);
  });
});

describe("the Envois of the states", () => {
  let site: ReturnType<typeof fakeSite>;
  let now: Date;
  let timers: { ms: number; run: () => void }[];
  const service = () =>
    envoiService({
      now: () => now,
      fetch: site.fetch,
      permitted: () => Promise.resolve(true),
      crypto: fakeCrypto,
      notify: () => Promise.resolve(),
      later: (ms, run) => timers.push({ ms, run }),
    });
  const flush = async () => {
    const due = timers;
    timers = [];
    for (const timer of due) timer.run();
    for (let i = 0; i < 50; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const opened = async (blob: string | undefined) =>
    JSON.parse(await fakeCrypto([KEY_1]).decrypt(blob ?? "")) as {
      item: { pseudo: string; reading: Record<string, unknown>; previous: { reading: unknown } | null };
      observedAt: number;
    };
  const posts = (category: string) => site.posts().filter((p) => p.body?.category === category);
  const items = (category: string) =>
    (posts(category).at(-1)?.body?.items ?? []) as { fingerprint: string; blob: string; detail?: string }[];

  beforeEach(async () => {
    fakeBrowser.reset();
    site = fakeSite();
    now = NOW;
    timers = [];
    await storeLink(TOKEN, NOW);
    await storeAttachedPlayers([{ server: "s5", pseudo: "Messor" }]);
    await storeCurrentPlayer(S5, "Messor");
    await storeKeys(SPACE, [KEY_1], null);
    await keepStatePages(S5, {
      stock: { readAt: NOW.getTime(), huntingField: 10_000, workers: 12_000 },
      ressources: {
        readAt: NOW.getTime(),
        foodWorkers: 4_000,
        materialWorkers: 6_000,
        mushroomPerDay: 0,
        taxRate: 0,
        hunts: [],
      },
      armee: { readAt: NOW.getTime(), units: { JSN: 1_000 }, attackAnts: 0, unknownAttacks: 0, coming: [] },
    });
  });

  it("sends each checked state in one encrypted row, the army by unit in the Admins' blob only « Par unité »", async () => {
    await service().choose("s5", "Messor", { ...NO_ENVOIS, production: true, army: "count" });
    const settings = site.calls.filter((c) => c.path === "/api/extension/envoi-settings").at(-1);
    expect(settings?.body?.categories).toEqual(["production", "army-count"]);
    expect(items("production")).toHaveLength(1);
    expect((await opened(items("production")[0]?.blob)).item).toMatchObject({
      pseudo: "Messor",
      reading: { huntingField: 10_000, workers: 12_000, colonies: null },
      previous: null,
    });
    expect(items("army")[0]?.detail).toBeUndefined();
    expect(posts("hunts")).toEqual([]);

    await service().choose("s5", "Messor", { ...NO_ENVOIS, production: true, army: "units" });
    const detail = await opened(items("army")[0]?.detail);
    expect(detail.item).toEqual({ units: { JSN: 1_000 } });
  });

  it("sends nothing again while the reading does not change, and the previous reading when it does", async () => {
    const envois = service();
    await envois.choose("s5", "Messor", { ...NO_ENVOIS, production: true });
    now = new Date(NOW.getTime() + 60_000);
    await keepStatePages(S5, { stock: { readAt: now.getTime(), huntingField: 10_000, workers: 12_000 } });
    envois.changed("s5.fourmizzz.fr", "production");
    await flush();
    expect(posts("production")).toHaveLength(1);

    await keepStatePages(S5, { stock: { readAt: now.getTime(), huntingField: 10_500, workers: 12_000 } });
    envois.changed("s5.fourmizzz.fr", "production");
    await flush();
    expect(posts("production")).toHaveLength(2);
    const sent = await opened(items("production")[0]?.blob);
    expect(sent.observedAt).toBe(now.getTime());
    expect(sent.item.previous?.reading).toMatchObject({ huntingField: 10_000 });
    // Still the same row: a state is one row per Joueur and category.
    expect(site.rows().filter((r) => r.category === "production")).toHaveLength(1);
  });

  it("sends nothing before the pages a state needs were read", async () => {
    await service().choose("s5", "Messor", { ...NO_ENVOIS, levels: true });
    expect(posts("levels")).toEqual([]);
  });

  it("opens the members' states at the relève, their units for an Admin, for « Partage »", async () => {
    const sealed = (category: string, fingerprint: string, item: unknown) =>
      fakeCrypto([KEY_1]).encrypt(
        JSON.stringify({ v: 1, server: "s5", playerId: 2, category, fingerprint, observedAt: 5, item }),
      );
    const reading = { total: 50, incomplete: false, returnsAt: null };
    site.addRow({
      id: "1",
      server: "s5",
      playerId: 2,
      category: "army",
      fingerprint: "a2",
      blob: await sealed("army", "a2", { pseudo: "Lasius", reading, previous: null }),
      detail: await sealed("army", "a2", { units: { SN: 50 } }),
    });
    site.addRow({
      id: "2",
      server: "s5",
      playerId: 2,
      category: "hunts",
      fingerprint: "h2",
      // Filed under another row: refused.
      blob: await sealed("hunts", "h9", { pseudo: "Lasius", reading: { hunts: [] }, previous: null }),
    });
    await service().releve("page");
    expect(await service().states(S5)).toEqual({
      problem: null,
      tag: "ABC",
      rows: [
        { category: "army", observedAt: 5, item: { pseudo: "Lasius", reading, previous: null }, units: { SN: 50 } },
      ],
    });
  });
});
