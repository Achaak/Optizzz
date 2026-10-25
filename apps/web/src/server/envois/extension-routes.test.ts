import { createAllianceKeyring } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { describe, expect, it } from "vitest";
import { hashToken } from "~/server/extension/tokens";
import { envoiService } from "./envoi-service";
import { getEnvois, getSpaces, postEnvoi, putSettings } from "./extension-routes";
import { memoryEnvoiStore } from "./memory-store";

const SITE = "https://optizzz.fr";
const TOKEN = "T".repeat(43);
const SPACE = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const NOW = new Date("2026-10-25T12:00:00Z");

function setUp() {
  const memory = memoryEnvoiStore();
  memory.addPlayer({ server: "s5", playerId: 1, pseudo: "Messor", userId: "u1" });
  memory.addSpace({ id: SPACE, server: "s5", tag: "ABC", name: "ABC sur S5" }, [{ server: "s5", playerId: 1 }]);
  const deps = {
    tokens: { userOfToken: (hash: string) => Promise.resolve(hash === hashToken(TOKEN) ? "u1" : null) },
    service: envoiService(memory.store, () => NOW),
  };
  return { memory, deps };
}

const request = (path: string, init: { method?: string; body?: unknown; token?: string } = {}) =>
  new Request(`${SITE}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${init.token ?? TOKEN}`, "content-type": "application/json" },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });

describe("the Envois in the extension's API", () => {
  it("answers only a linked extension's token", async () => {
    const { deps } = setUp();
    expect((await getSpaces(request("/api/extension/spaces", { token: "x".repeat(43) }), deps)).status).toBe(401);
    const response = await getSpaces(request("/api/extension/spaces"), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(await response.json()).toMatchObject({ players: [{ pseudo: "Messor", space: { id: SPACE } }] });
  });

  it("takes the settings, then an Envoi, and gives it back to the relève", async () => {
    const { deps } = setUp();
    const off = await postEnvoi(
      request("/api/extension/envois", {
        method: "POST",
        body: { server: "s5", playerId: 1, category: "convoys", keyVersion: 1, items: [], removed: [] },
      }),
      deps,
    );
    expect(off.status).toBe(409);
    expect(await off.json()).toMatchObject({ error: "category-off" });

    const settings = request("/api/extension/envoi-settings", {
      method: "PUT",
      body: { server: "s5", playerId: 1, categories: ["convoys"] },
    });
    expect((await putSettings(settings, deps)).status).toBe(204);

    const blob = await encryptData("convoi", await createAllianceKeyring());
    const item = { fingerprint: "f".repeat(22), blob, expiresAt: NOW.getTime() + 86_400_000 };
    const sent = await postEnvoi(
      request("/api/extension/envois", {
        method: "POST",
        body: { server: "s5", playerId: 1, category: "convoys", keyVersion: 1, items: [item], removed: [] },
      }),
      deps,
    );
    expect(sent.status).toBe(204);

    const read = await getEnvois(request(`/api/extension/envois?space=${SPACE}&since=0`), deps);
    expect(await read.json()).toMatchObject({
      items: [{ fingerprint: item.fingerprint, blob }],
      live: [expect.any(String)],
    });
    expect((await getEnvois(request("/api/extension/envois?space=nope"), deps)).status).toBe(404);
  });
});
