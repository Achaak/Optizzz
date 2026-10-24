import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  decline,
  LINK_REQUEST_TTL,
  loadDeclined,
  loadLink,
  requestLink,
  storeCurrentPlayer,
  storeLink,
} from "@/data/optizzz-account";
import { accountService, answer, senderKind } from "./background";

const S5 = "https://s5.fourmizzz.fr";
const TOKEN = "T".repeat(43);
const OTHER_TOKEN = "U".repeat(43);
const NOW = new Date("2026-10-24T12:00:00Z");

interface Call {
  url: string;
  method: string;
  authorization: string | null;
  cookies: RequestCredentials | undefined;
  body: unknown;
}

/** optizzz.fr's API, in memory: the account's Players, and an answer to force per path. */
function fakeSite() {
  const calls: Call[] = [];
  let players: { server: string; pseudo: string }[] = [];
  const forced = new Map<string, Response | "offline">();
  const fetch = (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : null;
    calls.push({
      url,
      method: init.method ?? "GET",
      authorization: headers.get("authorization"),
      cookies: init.credentials,
      body,
    });
    const path = new URL(url).pathname;
    const answer = forced.get(path);
    if (answer === "offline") return Promise.reject(new TypeError("Failed to fetch"));
    if (answer) return Promise.resolve(answer);
    if (path === "/api/extension/players" && body && typeof body === "object") {
      players = [...players, body as { server: string; pseudo: string }];
      return Promise.resolve(Response.json({ players }, { status: 201 }));
    }
    if (path === "/api/extension/token") return Promise.resolve(new Response(null, { status: 204 }));
    return Promise.resolve(Response.json({ players }));
  };
  return { fetch, calls, forced, setPlayers: (list: typeof players) => (players = list) };
}

let site: ReturnType<typeof fakeSite>;
let permitted: boolean;
let now: Date;
let opened: number;
const service = () =>
  accountService({
    now: () => now,
    fetch: site.fetch,
    permitted: () => Promise.resolve(permitted),
    openConnectPage: () => {
      opened++;
      return Promise.resolve();
    },
  });

beforeEach(() => {
  fakeBrowser.reset();
  site = fakeSite();
  permitted = true;
  now = NOW;
  opened = 0;
});

describe("without a linked account", () => {
  it("sends nothing at all, and offers nothing, even on a game page", async () => {
    await storeCurrentPlayer(S5, "Calystene");
    const status = await service().status(S5, null, true);
    expect(status).toMatchObject({ linked: false, offer: null, players: [] });
    expect(await service().attach(S5)).toMatchObject({ linked: false });
    await service().disconnect(null);
    expect(site.calls).toEqual([]);
  });
});

describe("linking", () => {
  it("lets the link script take a token only after « Connecter mon Compte Optizzz », for 30 minutes", async () => {
    expect(await service().linkStart()).toEqual({ ok: false });
    await requestLink(NOW);
    expect(await service().linkStart()).toEqual({ ok: true });
    now = new Date(NOW.getTime() + LINK_REQUEST_TTL + 1);
    expect(await service().linkStart()).toEqual({ ok: false });
  });

  it("refuses without optizzz.fr granted", async () => {
    await requestLink(NOW);
    permitted = false;
    expect(await service().linkToken(TOKEN)).toEqual({ ok: false });
    expect(await loadLink()).toBeNull();
  });

  it("keeps the token, forgets the request and reads the account's Players with the token alone", async () => {
    await requestLink(NOW);
    site.setPlayers([{ server: "s5", pseudo: "Calystene" }]);
    expect(await service().linkToken(TOKEN)).toEqual({ ok: true });
    expect(await loadLink()).toEqual({ token: TOKEN, linkedAt: NOW.getTime() });
    expect(site.calls).toEqual([
      {
        url: "https://optizzz.fr/api/extension/account",
        method: "GET",
        authorization: `Bearer ${TOKEN}`,
        cookies: "omit",
        body: null,
      },
    ]);
    // Used once: a second token needs a new click.
    expect(await service().linkToken(OTHER_TOKEN)).toEqual({ ok: false });
  });

  it("keeps one token per browser: linking again removes the previous one from the site", async () => {
    await storeLink(TOKEN, NOW);
    await requestLink(NOW);
    await service().linkToken(OTHER_TOKEN);
    expect(site.calls[0]).toMatchObject({ method: "DELETE", authorization: `Bearer ${TOKEN}` });
    expect((await loadLink())?.token).toBe(OTHER_TOKEN);
  });
});

describe("linked", () => {
  beforeEach(async () => {
    await storeLink(TOKEN, NOW);
    await storeCurrentPlayer(S5, "Calystene");
  });

  it("offers to attach the Player of the game page", async () => {
    expect(await service().status(S5, null, true)).toMatchObject({
      linked: true,
      permitted: true,
      offer: { origin: S5, serverName: "S5", pseudo: "Calystene" },
    });
  });

  it("takes the last game tab's server in the popup", async () => {
    expect((await service().status(null)).offer?.pseudo).toBe("Calystene");
  });

  it("attaches the pseudo read in the game, not one a message would bring", async () => {
    const status = await service().attach(S5);
    expect(site.calls.at(-1)).toMatchObject({
      url: "https://optizzz.fr/api/extension/players",
      method: "POST",
      authorization: `Bearer ${TOKEN}`,
      body: { server: "s5", pseudo: "Calystene" },
    });
    expect(status).toMatchObject({
      offer: null,
      players: [{ server: "s5", pseudo: "Calystene" }],
      notice: { kind: "success", text: "Calystene (S5) est rattaché à votre Compte Optizzz." },
    });
  });

  it("shows the site's refusal of a Player another account has", async () => {
    const message = "Calystene (S5) est déjà rattaché à un autre Compte Optizzz ; contactez-nous.";
    site.forced.set("/api/extension/players", Response.json({ error: "taken", message }, { status: 409 }));
    expect(await service().attach(S5)).toMatchObject({ notice: { kind: "error", text: message } });
  });

  it("remembers a refusal: the offer is not made again", async () => {
    expect((await service().decline(S5)).offer).toBeNull();
    expect(await loadDeclined()).toEqual(["s5:Calystene"]);
    expect(site.calls).toEqual([]);
  });

  it("forgets a token removed from /account", async () => {
    site.forced.set("/api/extension/account", new Response(null, { status: 401 }));
    const status = await service().status(S5, null, true);
    expect(status).toMatchObject({ linked: false, offer: null, notice: { kind: "error" } });
    expect(await loadLink()).toBeNull();
  });

  it("asks nothing of the site when optizzz.fr was taken back, and offers nothing", async () => {
    permitted = false;
    expect(await service().status(S5, null, true)).toMatchObject({ linked: true, permitted: false, offer: null });
    expect(site.calls).toEqual([]);
  });

  it("« Déconnecter » removes the token on the site and here", async () => {
    const status = await service().disconnect(null);
    expect(site.calls).toEqual([expect.objectContaining({ method: "DELETE", authorization: `Bearer ${TOKEN}` })]);
    expect(status).toMatchObject({ linked: false, notice: { kind: "success" } });
    expect(await loadLink()).toBeNull();
  });

  it("« Déconnecter » forgets the token even when the site cannot be reached, and says so", async () => {
    site.forced.set("/api/extension/token", "offline");
    const status = await service().disconnect(null);
    expect(status.notice?.kind).toBe("error");
    expect(await loadLink()).toBeNull();
  });

  it("keeps the refusals after « Déconnecter »", async () => {
    await decline("s5", "Calystene");
    await service().disconnect(null);
    expect(await loadDeclined()).toEqual(["s5:Calystene"]);
  });
});

describe("who may send what", () => {
  const ID = "optizzz-id";
  const BASE = "chrome-extension://optizzz-id/";
  const tab = { id: 1 } as Browser.tabs.Tab;

  it("tells the extension's pages, its scripts on the game and the link script apart", () => {
    expect(senderKind({ id: ID, url: `${BASE}popup.html` }, ID, BASE)).toBe("page");
    expect(senderKind({ id: ID, url: `${S5}/Reine.php`, tab }, ID, BASE)).toBe("game");
    expect(senderKind({ id: ID, url: "https://optizzz.fr/connect-extension", tab }, ID, BASE)).toBe("link");
    expect(senderKind({ id: ID, url: "https://optizzz.fr/account", tab }, ID, BASE)).toBeNull();
    expect(senderKind({ id: "another-extension", url: `${BASE}popup.html` }, ID, BASE)).toBeNull();
    expect(senderKind({ id: ID, url: "https://evil.example/connect-extension", tab }, ID, BASE)).toBeNull();
  });

  it("takes a token only from the link script, and actions only from the settings", async () => {
    await requestLink(NOW);
    const token = { type: "optizzz-link", action: "token", token: TOKEN } as const;
    expect(answer(service(), token, "game")).toBeNull();
    expect(answer(service(), token, "page")).toBeNull();
    expect(answer(service(), { type: "optizzz-account", action: "disconnect" }, "link")).toBeNull();
    expect(await loadLink()).toBeNull();
    await answer(service(), { type: "optizzz-account", action: "connect" }, "game");
    expect(opened).toBe(1);
    expect(await answer(service(), token, "link")).toEqual({ ok: true });
  });
});
