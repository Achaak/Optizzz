import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  decline,
  LINK_REQUEST_TTL,
  loadDeclined,
  loadLink,
  requestLink,
  storeCurrentPlayer,
  storeAttachedPlayers,
  storeLink,
} from "@/data/optizzz-account";
import { storeAllianceMembers } from "@/data/alliance-members";
import { accountService, answer, senderKind } from "./background";
import type { SpaceMessage } from "./messages";

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
/** What reached the Envois (envois.ts has its own tests). */
let envoiCalls: string[];
const envois = {
  status: () => Promise.resolve([]),
  choose: () => {
    envoiCalls.push("choose");
    return Promise.resolve();
  },
  forget: () => {
    envoiCalls.push("forget");
    return Promise.resolve();
  },
  receiveKeys: () => {
    envoiCalls.push("keys");
    return Promise.resolve({ ok: true });
  },
  releve: () => {
    envoiCalls.push("releve");
    return Promise.resolve();
  },
  incoming: () => Promise.resolve({ problem: null, convoys: [] }),
};
const service = () =>
  accountService({
    now: () => now,
    fetch: site.fetch,
    permitted: () => Promise.resolve(permitted),
    openConnectPage: () => {
      opened++;
      return Promise.resolve();
    },
    envois,
  });

beforeEach(() => {
  fakeBrowser.reset();
  site = fakeSite();
  permitted = true;
  now = NOW;
  opened = 0;
  envoiCalls = [];
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

  it("« Déconnecter » removes the token on the site and here, and forgets the Clé d'alliance", async () => {
    const status = await service().disconnect(null);
    expect(site.calls).toEqual([expect.objectContaining({ method: "DELETE", authorization: `Bearer ${TOKEN}` })]);
    expect(status).toMatchObject({ linked: false, notice: { kind: "success" } });
    expect(await loadLink()).toBeNull();
    expect(envoiCalls).toEqual(["forget"]);
  });

  it("changes the categories of an attached Joueur only", async () => {
    const choices = {
      production: false,
      convoys: true,
      floods: false,
      hunts: false,
      army: "none" as const,
      levels: false,
    };
    const choose = { type: "optizzz-account", action: "choose", server: "s5", pseudo: "Calystene", choices } as const;
    await answer(service(), choose, "page");
    expect(envoiCalls).toEqual([]);
    await storeAttachedPlayers([{ server: "s5", pseudo: "Calystene" }]);
    await answer(service(), choose, "page");
    expect(envoiCalls).toEqual(["choose"]);
    expect(answer(service(), choose, "space")).toBeNull();
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
    // « Se déconnecter » is on /account: the space script runs there too, to forget the Clé d'alliance.
    expect(senderKind({ id: ID, url: "https://optizzz.fr/account", tab }, ID, BASE)).toBe("space");
    expect(senderKind({ id: ID, url: "https://optizzz.fr/accounts", tab }, ID, BASE)).toBeNull();
    expect(senderKind({ id: ID, url: "https://optizzz.fr/spaces/0b8f6c1e", tab }, ID, BASE)).toBe("space");
    expect(senderKind({ id: ID, url: "https://optizzz.fr/spaces", tab }, ID, BASE)).toBeNull();
    expect(senderKind({ id: ID, url: "https://evil.example/spaces/0b8f6c1e", tab }, ID, BASE)).toBeNull();
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

describe("the Clé d'alliance and the game's pages", () => {
  const keys: SpaceMessage = {
    type: "optizzz-space",
    action: "keys",
    spaceId: "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b",
    keys: [{ version: 1, key: "A".repeat(43) }],
    expiresAt: null,
  };

  it("takes the Clé d'alliance and « Se déconnecter » from the space script only", async () => {
    expect(answer(service(), keys, "game")).toBeNull();
    expect(answer(service(), keys, "page")).toBeNull();
    expect(answer(service(), { type: "optizzz-space", action: "forget" }, "game")).toBeNull();
    await answer(service(), keys, "space");
    await answer(service(), { type: "optizzz-space", action: "forget" }, "space");
    expect(envoiCalls).toEqual(["keys", "forget"]);
  });

  it("starts the relève and answers the alliance's convoys for the game's pages only", async () => {
    expect(answer(service(), { type: "optizzz-envois", action: "page-open" }, "space")).toBeNull();
    await answer(service(), { type: "optizzz-envois", action: "page-open" }, "game");
    expect(envoiCalls).toEqual(["releve"]);
    expect(await answer(service(), { type: "optizzz-envois", action: "incoming", origin: S5 }, "game")).toEqual({
      problem: null,
      convoys: [],
    });
  });
});

describe("the Members page for « Donner l'accès »", () => {
  const ask = { type: "optizzz-space", action: "members", server: "s5" } as const;
  const list = { tag: "ABC", pseudos: ["Bruno", "Alice"], readAt: new Date("2026-10-24T11:00:00Z") };

  it("goes only to the space script, and only while the extension is linked", async () => {
    await storeAllianceMembers(S5, list);
    expect(answer(service(), ask, "game")).toBeNull();
    expect(answer(service(), ask, "link")).toBeNull();
    expect(await answer(service(), ask, "space")).toEqual({ status: "unlinked" });
    await storeLink(TOKEN, NOW);
    permitted = false;
    expect(await answer(service(), ask, "space")).toEqual({ status: "unlinked" });
  });

  it("hands the last list kept for the server, read from storage without any request", async () => {
    await storeLink(TOKEN, NOW);
    expect(await answer(service(), ask, "space")).toEqual({ status: "linked", members: null });
    await storeAllianceMembers(S5, list);
    expect(await answer(service(), ask, "space")).toEqual({
      status: "linked",
      members: { tag: "ABC", pseudos: ["Bruno", "Alice"], readAt: list.readAt.getTime() },
    });
    expect(await answer(service(), { ...ask, server: "s9" }, "space")).toEqual({ status: "unlinked" });
    expect(site.calls).toEqual([]);
  });
});
