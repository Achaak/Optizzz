import { createAllianceKeyring } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { describe, expect, it } from "vitest";
import { hashToken } from "~/server/extension/tokens";
import { demandeService } from "./demande-service";
import { getDemandes, postDemandes } from "./extension-routes";
import { memoryDemandeStore } from "./memory-store";

const SITE = "https://optizzz.fr";
const TOKEN = "T".repeat(43);
const SPACE = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const NOW = new Date("2026-10-26T12:00:00Z");

async function setUp() {
  const memory = memoryDemandeStore();
  memory.addPlayer({ server: "s5", playerId: 1, pseudo: "Messor", userId: "u1" });
  memory.addSpace({ id: SPACE, server: "s5", tag: "ABC", name: "ABC sur S5" }, [{ server: "s5", playerId: 1 }]);
  await memory.saveSettings({ server: "s5", playerId: 1 }, ["production", "convoys"]);
  const service = demandeService(memory.store, () => NOW);
  await service.create("u1", {
    server: "s5",
    playerId: 1,
    id: ID,
    blob: await encryptData("Dôme 3", await createAllianceKeyring()),
    keyVersion: 1,
  });
  const deps = {
    tokens: { userOfToken: (hash: string) => Promise.resolve(hash === hashToken(TOKEN) ? "u1" : null) },
    service,
  };
  return { deps };
}

const request = (path: string, init: { method?: string; body?: unknown; token?: string } = {}) =>
  new Request(`${SITE}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${init.token ?? TOKEN}`, "content-type": "application/json" },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });

describe("the Demandes in the extension's API", () => {
  it("gives a linked extension its space's Demandes, and nothing without the token", async () => {
    const { deps } = await setUp();
    const path = `/api/extension/demandes?space=${SPACE}`;
    expect((await getDemandes(request(path, { token: "x".repeat(43) }), deps)).status).toBe(401);
    const response = await getDemandes(request(path), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(await response.json()).toMatchObject({ demandes: [{ id: ID, status: "pending" }], live: null });
    const since = await getDemandes(request(`${path}&since=${String(NOW.getTime())}`), deps);
    expect(await since.json()).toMatchObject({ demandes: [], live: [ID] });
  });

  it("closes what the requester's extension saw reached", async () => {
    const { deps } = await setUp();
    const response = await postDemandes(
      request("/api/extension/demandes", { method: "POST", body: { server: "s5", playerId: 1, close: [ID] } }),
      deps,
    );
    expect(await response.json()).toEqual({ closed: [ID] });
    const refused = await postDemandes(
      request("/api/extension/demandes", { method: "POST", body: { server: "s5", playerId: 9, close: [ID] } }),
      deps,
    );
    expect(refused.status).toBe(403);
  });
});
