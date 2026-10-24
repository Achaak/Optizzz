import { beforeEach, describe, expect, it } from "vitest";
import { account, declarePlayer, link, unlink, type DeclaredPlayerRow, type ExtensionStore } from "./extension-api";
import { hashToken } from "./tokens";

const SITE = "https://optizzz.fr";

/** The store in memory: tokens by hash, Players by « server:id », and one export player per server. */
function fakeStore() {
  const tokens = new Map<string, { userId: string; browser: string }>();
  const players = new Map<string, DeclaredPlayerRow & { userId: string }>();
  const exportPlayers = [
    { server: "s5", id: 42, pseudo: "Calystene" },
    { server: "s2", id: 7, pseudo: "Calystene" },
  ];
  const store: ExtensionStore = {
    createToken: (userId, hash, browser) => {
      tokens.set(hash, { userId, browser });
      return Promise.resolve();
    },
    userOfToken: (hash) => Promise.resolve(tokens.get(hash)?.userId ?? null),
    deleteToken: (hash) => {
      tokens.delete(hash);
      return Promise.resolve();
    },
    playersOf: (userId) => Promise.resolve([...players.values()].filter((player) => player.userId === userId)),
    exportPlayer: (server, pseudo) =>
      Promise.resolve(exportPlayers.find((player) => player.server === server && player.pseudo === pseudo) ?? null),
    declarePlayer: (userId, player) => {
      const key = `${player.server}:${String(player.playerId)}`;
      const current = players.get(key);
      if (current) return Promise.resolve(current.userId === userId ? "mine" : "taken");
      players.set(key, { ...player, userId, declaredAt: new Date("2026-10-24T10:00:00Z") });
      return Promise.resolve("declared");
    },
  };
  return { store, tokens, players };
}

const linkRequest = (headers: Record<string, string> = {}, body: unknown = { browser: "Firefox" }) =>
  new Request(`${SITE}/api/extension/link`, {
    method: "POST",
    headers: { origin: SITE, "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const withToken = (
  token: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
  path = "/api/extension/account",
) => new Request(`${SITE}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...init.headers } });

let fake: ReturnType<typeof fakeStore>;
beforeEach(() => {
  fake = fakeStore();
});

async function linkedToken(userId = "user-1"): Promise<string> {
  const response = await link(linkRequest(), { userId, siteOrigin: SITE, store: fake.store });
  return ((await response.json()) as { token: string }).token;
}

describe("link", () => {
  it("gives the signed-in account a token, and keeps only its hash", async () => {
    const response = await link(linkRequest(), { userId: "user-1", siteOrigin: SITE, store: fake.store });
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const { token } = (await response.json()) as { token: string };
    expect([...fake.tokens.keys()]).toEqual([hashToken(token)]);
    expect(fake.tokens.get(hashToken(token))).toEqual({ userId: "user-1", browser: "Firefox" });
  });

  it("refuses another site, a cross-site request and a form", async () => {
    const options = { userId: "user-1", siteOrigin: SITE, store: fake.store };
    expect((await link(linkRequest({ origin: "https://evil.example" }), options)).status).toBe(403);
    expect((await link(linkRequest({ "sec-fetch-site": "cross-site" }), options)).status).toBe(403);
    const withoutOrigin = (fetchSite: string | null) => {
      const request = linkRequest();
      request.headers.delete("origin");
      if (fetchSite === null) request.headers.delete("sec-fetch-site");
      else request.headers.set("sec-fetch-site", fetchSite);
      return request;
    };
    expect((await link(withoutOrigin(null), options)).status).toBe(403);
    expect((await link(withoutOrigin("same-site"), options)).status).toBe(403);
    expect((await link(linkRequest({ "content-type": "text/plain" }), options)).status).toBe(415);
    expect(fake.tokens.size).toBe(0);
  });

  it("takes Sec-Fetch-Site for proof when the browser leaves Origin out of a same-origin request", async () => {
    const request = linkRequest();
    request.headers.delete("origin");
    expect((await link(request, { userId: "user-1", siteOrigin: SITE, store: fake.store })).status).toBe(201);
  });

  it("asks to sign in first without a session", async () => {
    const response = await link(linkRequest(), { userId: null, siteOrigin: SITE, store: fake.store });
    expect(response.status).toBe(401);
    expect(fake.tokens.size).toBe(0);
  });

  it("names an unknown browser « Navigateur »", async () => {
    await link(linkRequest({}, { browser: "<b>x</b>" }), { userId: "user-1", siteOrigin: SITE, store: fake.store });
    expect([...fake.tokens.values()][0]?.browser).toBe("Navigateur");
  });
});

describe("the token's routes", () => {
  it("answer 401 without a token, with a wrong one or a removed one", async () => {
    const token = await linkedToken();
    expect((await account(new Request(`${SITE}/api/extension/account`), fake.store)).status).toBe(401);
    expect((await account(withToken("A".repeat(43)), fake.store)).status).toBe(401);
    fake.tokens.clear();
    expect((await account(withToken(token), fake.store)).status).toBe(401);
  });

  it("never take the site's session cookie for a token", async () => {
    const request = new Request(`${SITE}/api/extension/account`, {
      headers: { cookie: "better-auth.session_token=abc" },
    });
    expect((await account(request, fake.store)).status).toBe(401);
  });

  it("« Déconnecter » removes the extension's own token, and only it", async () => {
    const token = await linkedToken();
    const other = await linkedToken();
    expect((await unlink(withToken(token, { method: "DELETE" }), fake.store)).status).toBe(204);
    expect(fake.tokens.has(hashToken(token))).toBe(false);
    expect(fake.tokens.has(hashToken(other))).toBe(true);
    expect((await account(withToken(token), fake.store)).status).toBe(401);
  });
});

describe("declarePlayer", () => {
  const declare = (token: string, body: unknown) =>
    declarePlayer(
      withToken(token, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
      fake.store,
    );

  it("attaches the export's player to the account and lists it", async () => {
    const token = await linkedToken();
    const response = await declare(token, { server: "S5", pseudo: "Calystene" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      players: [{ server: "s5", playerId: 42, pseudo: "Calystene", declaredAt: "2026-10-24T10:00:00.000Z" }],
    });
    expect((await account(withToken(token), fake.store)).status).toBe(200);
  });

  it("says so when the account already has it", async () => {
    const token = await linkedToken();
    await declare(token, { server: "s5", pseudo: "Calystene" });
    expect((await declare(token, { server: "s5", pseudo: "Calystene" })).status).toBe(200);
  });

  it("refuses a Player another account declared", async () => {
    await declare(await linkedToken("user-1"), { server: "s5", pseudo: "Calystene" });
    const response = await declare(await linkedToken("user-2"), { server: "s5", pseudo: "Calystene" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "taken",
      message: "Calystene (S5) est déjà rattaché à un autre Compte Optizzz ; contactez-nous.",
    });
    expect(fake.players.get("s5:42")?.userId).toBe("user-1");
  });

  it("lets the same pseudo be attached on another server: a Player is a server and an id", async () => {
    await declare(await linkedToken("user-1"), { server: "s5", pseudo: "Calystene" });
    expect((await declare(await linkedToken("user-2"), { server: "s2", pseudo: "Calystene" })).status).toBe(201);
  });

  it("refuses a pseudo missing from the export, an unknown server and a broken body", async () => {
    const token = await linkedToken();
    expect((await declare(token, { server: "s5", pseudo: "Personne" })).status).toBe(404);
    expect((await declare(token, { server: "s9", pseudo: "Calystene" })).status).toBe(400);
    expect((await declare(token, { server: "s5" })).status).toBe(400);
    expect((await declare(token, "nope")).status).toBe(400);
    expect(fake.players.size).toBe(0);
  });

  it("does nothing without a valid token", async () => {
    expect((await declare("B".repeat(43), { server: "s5", pseudo: "Calystene" })).status).toBe(401);
    expect(fake.players.size).toBe(0);
  });
});
