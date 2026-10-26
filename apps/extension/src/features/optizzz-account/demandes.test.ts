import { sealDemande, type DemandeContent } from "@optizzz/game/site-links/demandes";
import { NO_ENVOIS, type EnvoiCrypto } from "@optizzz/game/site-links/envois";
import { ALLIANCE_KEYS, type HandedKey } from "@optizzz/game/site-links/space-bridge";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { storeConvoys } from "@/data/convoys";
import { storeAttachedPlayers, storeCurrentPlayer, storeLink } from "@/data/optizzz-account";
import { envoiService } from "./envois";

const S5 = "https://s5.fourmizzz.fr";
const SPACE = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const TOKEN = "T".repeat(43);
const NOW = new Date("2026-10-26T12:00:00Z");
const HOUR = 3600_000;
const KEY: HandedKey = { version: 1, key: "A".repeat(43) };
const MUSHROOM = "6f1c2d3e-4b5a-4c7d-8e9f-000000000001";
const DOME = "6f1c2d3e-4b5a-4c7d-8e9f-000000000002";
const MINE = "6f1c2d3e-4b5a-4c7d-8e9f-000000000003";

/** A reversible stand-in for libsodium (tested in @optizzz/crypto and on the site). */
const fakeCrypto = (): EnvoiCrypto => ({
  encrypt: (text) => Promise.resolve(`v1.${btoa(encodeURIComponent(text))}`),
  decrypt: (blob) => Promise.resolve(decodeURIComponent(atob(blob.slice(3)))),
  fingerprint: (text) => Promise.resolve(`fp-${btoa(encodeURIComponent(text)).slice(0, 20)}`),
});

const content = (key: DemandeContent["key"], level: number, materials: number): DemandeContent => ({
  key,
  from: level - 1,
  level,
  cost: { food: 0, materials },
  typed: false,
});

/** optizzz.fr in memory: Messor (1) in a space with Lasius (2), the Demandes it serves, the Envois it keeps. */
function fakeSite() {
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  const demandes: { id: string; server: string; playerId: number; status: string; rank: number; blob: string }[] = [];
  const settings: string[] = [];
  const fetch = (url: string, init: RequestInit) => {
    const { pathname } = new URL(url);
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    if (body) posts.push({ path: pathname, body });
    if (pathname === "/api/extension/spaces")
      return Promise.resolve(
        Response.json({
          players: [
            {
              server: "s5",
              playerId: 1,
              pseudo: "Messor",
              categories: settings,
              space: {
                id: SPACE,
                name: "ABC sur S5",
                tag: "ABC",
                version: { version: 1, createdAt: NOW.toISOString(), createdByPseudo: "Lasius" },
                members: [
                  { playerId: 1, pseudo: "Messor", categories: settings },
                  { playerId: 2, pseudo: "Lasius", categories: ["production", "convoys"] },
                ],
              },
            },
          ],
        }),
      );
    if (pathname === "/api/extension/envoi-settings") {
      settings.splice(0, settings.length, ...(body?.categories as string[]));
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (pathname === "/api/extension/envois" && body) return Promise.resolve(new Response(null, { status: 204 }));
    if (pathname === "/api/extension/envois")
      return Promise.resolve(Response.json({ cursor: NOW.getTime(), items: [], live: null }));
    if (pathname === "/api/extension/demandes" && body) {
      const closed = demandes.filter((d) => (body.close as string[]).includes(d.id) && d.playerId === body.playerId);
      for (const d of closed) d.status = "closed";
      return Promise.resolve(Response.json({ closed: closed.map((d) => d.id) }));
    }
    if (pathname === "/api/extension/demandes")
      return Promise.resolve(
        Response.json({
          cursor: NOW.getTime(),
          demandes: demandes
            .filter((d) => d.status === "validated" || d.status === "pending")
            .map((d) => ({ ...d, createdAt: NOW.getTime() })),
          live: null,
        }),
      );
    return Promise.resolve(new Response(null, { status: 404 }));
  };
  const add = async (id: string, playerId: number, status: string, demande: DemandeContent) =>
    demandes.push({
      id,
      server: "s5",
      playerId,
      status,
      rank: demandes.length,
      blob: await sealDemande({ id, server: "s5", playerId, content: demande }, fakeCrypto()),
    });
  return { fetch, posts, demandes, add };
}

describe("the Demandes in the game", () => {
  let site: ReturnType<typeof fakeSite>;
  let now: Date;
  const service = () =>
    envoiService({
      now: () => now,
      fetch: site.fetch,
      permitted: () => Promise.resolve(true),
      crypto: fakeCrypto,
      notify: () => Promise.resolve(),
      later: () => undefined,
      discord: {
        refresh: () => Promise.resolve(),
        announce: () => Promise.resolve(),
        status: () => Promise.resolve(null),
        forget: () => Promise.resolve(),
      },
    });

  beforeEach(async () => {
    fakeBrowser.reset();
    site = fakeSite();
    now = NOW;
    await storeLink(TOKEN, NOW);
    await storeAttachedPlayers([{ server: "s5", pseudo: "Messor" }]);
    await storeCurrentPlayer(S5, "Messor");
    await service().receiveKeys({ type: ALLIANCE_KEYS, spaceId: SPACE, keys: [KEY], expiresAt: null });
    await site.add(MUSHROOM, 2, "validated", content("mushroom", 12, 120_000));
    await site.add(DOME, 2, "pending", content("dome", 3, 14_000));
    await site.add(MINE, 1, "validated", content("laboratory", 9, 358_400));
  });

  it("shows the others' validated Demandes with what remains, the Joueur's own, and those to validate", async () => {
    await service().releve("page");
    expect(await service().demandes(S5)).toMatchObject({
      problem: null,
      spaceUrl: `https://optizzz.fr/spaces/${SPACE}`,
      open: [
        {
          id: MUSHROOM,
          requester: "Lasius",
          label: "Champignonnière niveau 12",
          status: "validated",
          remaining: { food: 0, materials: 120_000 },
        },
      ],
      mine: [{ id: MINE, label: "Laboratoire niveau 9" }],
      toValidate: 1,
      attaches: false,
    });
  });

  it("fills the Convoi page for a Demande, attaches the convoy launched from it, and sends it with « Convois »", async () => {
    const envois = service();
    await envois.choose("s5", "Messor", { ...NO_ENVOIS, convoys: true, production: true });
    await envois.releve("page");
    expect(await envois.prepareConvoy(S5, MUSHROOM, { food: 50_000, materials: 80_000 })).toEqual({
      ok: true,
      recipient: "Lasius",
      label: "Champignonnière niveau 12",
      food: 0,
      materials: 80_000,
      short: true,
      attaches: true,
    });
    expect(await envois.prepareConvoy(S5, MINE, null)).toMatchObject({ ok: false });
    expect(await envois.prepareConvoy(S5, DOME, null)).toMatchObject({ ok: false });

    // The player clicked « Lancer le convoi »: the game lists it, collect keeps the list.
    now = new Date(NOW.getTime() + 60_000);
    await storeConvoys(
      S5,
      [{ recipient: "Lasius", food: 0, materials: 80_000, arrivesAt: new Date(NOW.getTime() + 2 * HOUR) }],
      now,
    );
    await envois.attachLaunched(S5);
    await envois.sendList("s5", "Messor", "demande-convoys");
    const sent = site.posts.find((p) => p.body.category === "demande-convoys");
    expect(sent?.body).toMatchObject({ category: "demande-convoys", keyVersion: 1, removed: [] });
    const items = sent?.body.items as { blob: string }[];
    expect(items).toHaveLength(1);
    const inside = JSON.parse(decodeURIComponent(atob(items[0]?.blob.slice(3) ?? ""))) as { item: unknown };
    expect(inside.item).toEqual({
      demande: MUSHROOM,
      from: "Messor",
      to: "Lasius",
      food: 0,
      materials: 80_000,
      at: NOW.getTime() + 2 * HOUR,
    });
  });

  it("closes the Joueur's own Demandes their game shows reached or under way", async () => {
    const envois = service();
    await envois.releve("page");
    await envois.levelsSeen(S5, {
      levels: { laboratory: 8, mushroom: 12 },
      works: [{ name: "Laboratoire", level: 9 }],
    });
    expect(site.posts.filter((p) => p.path === "/api/extension/demandes").map((p) => p.body)).toEqual([
      { server: "s5", playerId: 1, close: [MINE] },
    ]);
    expect((await envois.demandes(S5)) as { mine: unknown[] }).toMatchObject({ mine: [] });
  });

  it("says why nothing shows without the Clé d'alliance", async () => {
    fakeBrowser.reset();
    await storeLink(TOKEN, NOW);
    await storeCurrentPlayer(S5, "Messor");
    const envois = service();
    await envois.refreshSpaces();
    expect(await envois.demandes(S5)).toEqual({ problem: "no-key" });
  });
});
